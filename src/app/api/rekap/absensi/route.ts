import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSchoolDays, getSemesterRange, getMonthRange, getCalendar } from "@/lib/schoolCalendar"

export const dynamic = 'force-dynamic'

// GET rekap absensi
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const type = searchParams.get("type") || "month" // "month" or "semester"
        const month = parseInt(searchParams.get("month") || new Date().getMonth().toString())
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
        const tahunAjaranParam = searchParams.get("tahunAjaran")

        // Fetch school settings upfront for academic year and default semester
        const schoolSettings = await prisma.schoolSettings.findFirst()
        const currentAcademicYear = tahunAjaranParam || schoolSettings?.tahunAjaran || "2026/2027"
        const defaultSemester = schoolSettings?.semesterAktif || 1
        const semester = parseInt(searchParams.get("semester") || String(defaultSemester))

        // Fetch dynamic kalender config
        const kalenderConfig = await prisma.kalenderConfig.findUnique({
            where: { tahunAjaran: currentAcademicYear },
        })

        let startDate: Date, endDate: Date

        if (type === "month") {
            const range = getMonthRange(month, year)
            startDate = range.start
            endDate = range.end
        } else {
            // Semester: use DB config if available, otherwise fallback to static
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

        // Get students: use RiwayatKelas if available (for exact historical roster), fallback to active students
        const riwayat = await prisma.riwayatKelas.findMany({
            where: { kelas, tahunAjaran: currentAcademicYear },
            include: {
                siswa: { select: { id: true, nis: true, nama: true } }
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

        // Get all attendance records in the date range for these students and class
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

        // Get school days using dynamic DB calendar (excludes weekends AND holidays)
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
            // Fallback to static calendar
            const schoolDays = getSchoolDays(startDate, endDate, currentAcademicYear)
            totalSchoolDays = schoolDays.length
        }

        // Get all unique dates attendance was actually recorded for this class in the period
        const recordedDates = new Set(absensi.map((a) => {
            const d = a.tanggal
            const y = d.getUTCFullYear()
            const m = String(d.getUTCMonth() + 1).padStart(2, '0')
            const day = String(d.getUTCDate()).padStart(2, '0')
            return `${y}-${m}-${day}`
        }))
        const totalRecordedDays = recordedDates.size

        // Effective school days: at least calendar days, or follows actual conducted meeting days
        const effectiveSchoolDays = Math.max(totalSchoolDays, totalRecordedDays)

        // Build recap data
        const recap = students.map((student) => {
            const studentAbsensi = absensi.filter((a) => a.siswaId === student.id)
            const counts = { H: 0, S: 0, I: 0, A: 0 }
            const dailyLogs: Record<string, string> = {}

            studentAbsensi.forEach((a) => {
                if (counts[a.status as keyof typeof counts] !== undefined) {
                    counts[a.status as keyof typeof counts]++
                }
                // Use UTC components since DB stores dates as UTC midnight
                const d = a.tanggal
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, '0')
                const day = String(d.getUTCDate()).padStart(2, '0')
                const dateStr = `${y}-${m}-${day}`
                dailyLogs[dateStr] = a.status
            })

            const totalRecorded = counts.H + counts.S + counts.I + counts.A

            // Divisor ensures percentage represents valid attendance rate and never exceeds 100%
            const divisor = Math.max(effectiveSchoolDays, totalRecorded, counts.H)
            const percentage = divisor > 0
                ? Math.min(100, Math.round((counts.H / divisor) * 100))
                : 0

            return {
                id: student.id,
                nis: student.nis,
                nama: student.nama,
                hadir: counts.H,
                sakit: counts.S,
                izin: counts.I,
                alpha: counts.A,
                totalRecorded,
                totalSchoolDays: effectiveSchoolDays,
                percentage,
                dailyLogs,
            }
        })

        const calendar = getCalendar(currentAcademicYear)

        // Get list of holidays in the period for reference
        const holidaysInPeriod = calendar.holidays.filter(h => {
            const hDate = new Date(h)
            if (type === "month") {
                // Exact match for month and year
                return hDate.getFullYear() === year && hDate.getMonth() === month
            } else {
                // For semester, ensure we include the full end date
                // Create a new date for end of day comparison
                const endOfDay = new Date(endDate)
                endOfDay.setHours(23, 59, 59, 999)
                return hDate >= startDate && hDate <= endOfDay
            }
        })

        return NextResponse.json({
            recap,
            meta: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalSchoolDays: effectiveSchoolDays,
                holidaysInPeriod,
                type,
                month: type === "month" ? month : undefined,
                semester: type === "semester" ? semester : undefined,
                tahunAjaran: currentAcademicYear,
                year,
                kelas,
            },
        })
    } catch (error) {
        console.error("Error fetching rekap absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
