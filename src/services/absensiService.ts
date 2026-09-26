import { prisma } from "@/lib/prisma"
import { parseToUTCMidnight } from "@/lib/dateUtils"
import { getSchoolDays, getSemesterRange, getMonthRange } from "@/lib/schoolCalendar"
import { getDefaultAcademicYear } from "@/lib/academicYear"

// Helper: tentukan tahunAjaran & semester dari tanggal
export function determineTahunAjaranSemester(date: Date): { tahunAjaran: string; semester: number } {
    const month = date.getUTCMonth() // 0-indexed
    const year = date.getUTCFullYear()
    if (month >= 6) { // Juli-Desember = Semester 1
        return { tahunAjaran: `${year}/${year + 1}`, semester: 1 }
    } else { // Januari-Juni = Semester 2
        return { tahunAjaran: `${year - 1}/${year}`, semester: 2 }
    }
}

export const absensiService = {
    // Ambil data absensi harian per kelas dan tanggal
    async getAbsensiByKelasDanTanggal(kelas: number, tanggalStr: string) {
        const queryDate = parseToUTCMidnight(tanggalStr)
        const queryDateEnd = new Date(queryDate.getTime() + 24 * 60 * 60 * 1000 - 1)

        return prisma.absensi.findMany({
            where: {
                OR: [
                    { kelas },
                    { siswa: { kelas, status: "aktif" } },
                ],
                tanggal: {
                    gte: queryDate,
                    lte: queryDateEnd,
                },
            },
            select: {
                siswaId: true,
                status: true,
                siswa: {
                    select: {
                        nama: true,
                        nis: true,
                    },
                },
            },
        })
    },

    // Simpan absensi dalam batch transaction beserta auto-sync ke jurnal agenda
    async saveBatchAbsensi(params: {
        entries: Array<{ siswaId: string; status: string; tanggal?: string }>
        targetKelas: number
        bodyTahunAjaran?: string
        bodySemester?: number
    }) {
        const { entries, targetKelas, bodyTahunAjaran, bodySemester } = params

        // Ambil data sekolah untuk default tahun ajaran dan semester aktif
        let defaultTahunAjaran = bodyTahunAjaran
        let defaultSemester = bodySemester
        if (!defaultTahunAjaran || !defaultSemester) {
            const schoolSettings = await prisma.schoolSettings.findFirst()
            if (!defaultTahunAjaran) defaultTahunAjaran = schoolSettings?.tahunAjaran || getDefaultAcademicYear()
            if (!defaultSemester) defaultSemester = schoolSettings?.semesterAktif || 1
        }

        let targetDateNormalized: Date | null = null

        const upsertOps = entries.map((entry) => {
            const dateNormalized = parseToUTCMidnight(entry.tanggal)
            if (!targetDateNormalized) targetDateNormalized = dateNormalized

            const autoDetected = determineTahunAjaranSemester(dateNormalized)
            const entryTahunAjaran = defaultTahunAjaran || autoDetected.tahunAjaran
            const entrySemester = defaultSemester || autoDetected.semester

            return prisma.absensi.upsert({
                where: {
                    siswaId_tanggal: {
                        siswaId: entry.siswaId,
                        tanggal: dateNormalized,
                    },
                },
                update: {
                    status: entry.status,
                    tahunAjaran: entryTahunAjaran,
                    semester: entrySemester,
                    kelas: targetKelas || 1,
                },
                create: {
                    siswaId: entry.siswaId,
                    tanggal: dateNormalized,
                    status: entry.status,
                    tahunAjaran: entryTahunAjaran,
                    semester: entrySemester,
                    kelas: targetKelas || 1,
                },
            })
        })

        // Batch execution
        await prisma.$transaction(upsertOps)

        // Sinkronisasi otomatis ke Jurnal jika ada agenda pada tanggal dan kelas ini
        if (targetDateNormalized && targetKelas) {
            try {
                const absentList = await prisma.absensi.findMany({
                    where: {
                        kelas: targetKelas,
                        tanggal: targetDateNormalized,
                    },
                    include: {
                        siswa: { select: { nama: true } },
                    },
                })

                const sNames = absentList.filter((a) => a.status === "S").map((a) => a.siswa.nama)
                const iNames = absentList.filter((a) => a.status === "I").map((a) => a.siswa.nama)
                const aNames = absentList.filter((a) => a.status === "A").map((a) => a.siswa.nama)

                const s = sNames.length
                const i = iNames.length
                const a = aNames.length
                const tdkHadir = s + i + a

                const allActiveStudents = await prisma.siswa.count({
                    where: { kelas: targetKelas, status: "aktif" },
                })
                const jmlHadir = Math.max(0, allActiveStudents - tdkHadir)

                const notes = []
                if (s > 0) notes.push(`Sakit: ${sNames.join(", ")}`)
                if (i > 0) notes.push(`Izin: ${iNames.join(", ")}`)
                if (a > 0) notes.push(`Alpa: ${aNames.join(", ")}`)
                const siswaAbsenStr = notes.join(" | ") || null

                await prisma.jurnal.updateMany({
                    where: {
                        kelas: targetKelas,
                        tanggal: targetDateNormalized,
                    },
                    data: {
                        siswaAbsen: siswaAbsenStr,
                        jmlSakit: s,
                        jmlIzin: i,
                        jmlAlpha: a,
                        jmlHadir,
                        jmlTdkHadir: tdkHadir,
                    },
                })
            } catch (err) {
                console.error("Auto-sync jurnal error:", err)
            }
        }

        return { count: entries.length }
    },

    // Hitung rekap absensi per kelas (bulanan atau semesteran)
    async getRekapAbsensi(params: {
        kelas: number
        type: string // "month" | "semester"
        month: number
        year: number
        semester: number
        tahunAjaranParam?: string | null
    }) {
        const { kelas, type, month, year, semester, tahunAjaranParam } = params

        const defaultYear = getDefaultAcademicYear()
        const [schoolSettings, kalenderConfig] = await Promise.all([
            prisma.schoolSettings.findFirst(),
            prisma.kalenderConfig.findUnique({
                where: { tahunAjaran: tahunAjaranParam || defaultYear },
            }),
        ])

        const currentAcademicYear = tahunAjaranParam || schoolSettings?.tahunAjaran || defaultYear

        let startDate: Date, endDate: Date

        if (type === "month") {
            const range = getMonthRange(month, year)
            startDate = range.start
            endDate = range.end
        } else {
            if (kalenderConfig) {
                if (semester === 1) {
                    startDate = kalenderConfig.semester1Mulai
                    endDate = kalenderConfig.semester1Selesai
                } else {
                    startDate = kalenderConfig.semester2Mulai
                    endDate = kalenderConfig.semester2Selesai
                }
            } else {
                const range = getSemesterRange(semester, semester === 1 ? year : year - 1, currentAcademicYear)
                startDate = range.start
                endDate = range.end
            }
        }

        // Ambil data siswa: prioritaskan RiwayatKelas historis, fallback ke Siswa aktif
        const riwayat = await prisma.riwayatKelas.findMany({
            where: { kelas, tahunAjaran: currentAcademicYear },
            include: {
                siswa: { select: { id: true, nis: true, nama: true } },
            },
            orderBy: { siswa: { nama: "asc" } },
        })

        let students: { id: string; nis: string; nama: string }[] = []
        if (riwayat.length > 0) {
            students = riwayat.map((r) => r.siswa)
        } else {
            students = await prisma.siswa.findMany({
                where: { kelas, status: "aktif" },
                orderBy: { nama: "asc" },
                select: { id: true, nis: true, nama: true },
            })
        }

        const studentIds = students.map((s) => s.id)

        const absensi = await prisma.absensi.findMany({
            where: {
                OR: [
                    { kelas, tahunAjaran: currentAcademicYear },
                    { siswaId: { in: studentIds } },
                ],
                tanggal: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                siswaId: true,
                tanggal: true,
                status: true,
            },
        })

        // Hitung total hari efektif KBM dari DB kalender
        const dbHolidayEvents = await prisma.kalenderEvent.findMany({
            where: {
                tahunAjaran: currentAcademicYear,
                OR: [{ isLibur: true }, { tipe: "holiday" }],
            },
        })

        let totalSchoolDays = 0
        if (dbHolidayEvents.length > 0) {
            const holidaySet = new Set<string>()
            for (const ev of dbHolidayEvents) {
                const cur = new Date(ev.tanggalMulai)
                const stop = ev.tanggalSelesai ? new Date(ev.tanggalSelesai) : new Date(ev.tanggalMulai)
                while (cur <= stop) {
                    holidaySet.add(cur.toISOString().split("T")[0])
                    cur.setDate(cur.getDate() + 1)
                }
            }
            const curDate = new Date(startDate)
            while (curDate <= endDate) {
                const day = curDate.getDay()
                const dateStr = curDate.toISOString().split("T")[0]
                if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
                    totalSchoolDays++
                }
                curDate.setDate(curDate.getDate() + 1)
            }
        } else {
            const schoolDays = getSchoolDays(startDate, endDate, currentAcademicYear)
            totalSchoolDays = schoolDays.length
        }

        const recordedDates = new Set(
            absensi.map((a) => {
                const d = a.tanggal
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, "0")
                const day = String(d.getUTCDate()).padStart(2, "0")
                return `${y}-${m}-${day}`
            })
        )

        // Agregasi per siswa
        const recap = students.map((student) => {
            const studentAbsensi = absensi.filter((a) => a.siswaId === student.id)
            const dailyLogs: Record<string, string> = {}
            studentAbsensi.forEach((a) => {
                const d = a.tanggal
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, "0")
                const day = String(d.getUTCDate()).padStart(2, "0")
                dailyLogs[`${y}-${m}-${day}`] = a.status
            })

            const counts = { H: 0, S: 0, I: 0, A: 0 }
            studentAbsensi.forEach((a) => {
                if (a.status in counts) {
                    counts[a.status as keyof typeof counts]++
                }
            })

            const totalRecorded = counts.H + counts.S + counts.I + counts.A
            const percentage = totalSchoolDays > 0 ? Math.round((counts.H / totalSchoolDays) * 100) : 0

            return {
                id: student.id,
                nis: student.nis,
                nama: student.nama,
                hadir: counts.H,
                sakit: counts.S,
                izin: counts.I,
                alpha: counts.A,
                totalRecorded,
                totalSchoolDays,
                percentage,
                dailyLogs,
            }
        })

        return {
            recap,
            meta: {
                type,
                month,
                year,
                semester,
                kelas,
                tahunAjaran: currentAcademicYear,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalSchoolDays,
                recordedDaysCount: recordedDates.size,
                recordedDates: Array.from(recordedDates).sort(),
            },
        }
    },
}
