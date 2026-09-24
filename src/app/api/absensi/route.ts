import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseToUTCMidnight } from "@/lib/dateUtils"

export const dynamic = 'force-dynamic'

// Helper: determine tahunAjaran & semester from a date
function determineTahunAjaranSemester(date: Date): { tahunAjaran: string; semester: number } {
    const month = date.getUTCMonth() // 0-indexed
    const year = date.getUTCFullYear()
    if (month >= 6) { // Juli-Desember = Semester 1
        return { tahunAjaran: `${year}/${year + 1}`, semester: 1 }
    } else { // Januari-Juni = Semester 2
        return { tahunAjaran: `${year - 1}/${year}`, semester: 2 }
    }
}

// GET absensi for a class and date
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const tanggal = searchParams.get("tanggal")

        if (!tanggal) {
            return NextResponse.json({ error: "Tanggal required" }, { status: 400 })
        }

        const queryDate = parseToUTCMidnight(tanggal)
        const queryDateEnd = new Date(queryDate.getTime() + 24 * 60 * 60 * 1000 - 1)

        const absensi = await prisma.absensi.findMany({
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

        return NextResponse.json(absensi)
    } catch (error) {
        console.error("Error fetching absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST save absensi
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Kepsek & Pengawas bersifat Read-Only untuk absensi harian
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        const body = await request.json()
        const entries = body.entries
        const kelasParam = body.kelas ? parseInt(body.kelas) : null
        const bodyTahunAjaran = body.tahunAjaran
        const bodySemester = body.semester ? parseInt(body.semester) : null

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: "Entries harus berupa array yang tidak kosong" }, { status: 400 })
        }

        // Tentukan kelas sasaran
        const targetKelas = kelasParam || userKelas

        // Otorisasi BOLA: Guru wali kelas hanya boleh mengubah absensi kelasnya sendiri
        if (userRole === "guru" && userKelas && targetKelas && targetKelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak mengubah absensi kelas ${targetKelas}.`
            }, { status: 403 })
        }

        // Resolve tahunAjaran default: from body, or from school settings
        let defaultTahunAjaran = bodyTahunAjaran
        let defaultSemester = bodySemester
        if (!defaultTahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            defaultTahunAjaran = settings?.tahunAjaran || "2026/2027"
            if (!defaultSemester) {
                defaultSemester = settings?.semesterAktif || 1
            }
        }

        let targetDateNormalized: Date | null = null

        // Siapkan batch operasi upsert
        const upsertOps = entries.map((entry) => {
            const dateNormalized = parseToUTCMidnight(entry.tanggal)
            if (!targetDateNormalized) targetDateNormalized = dateNormalized

            // Auto-determine tahunAjaran & semester from the date if not provided
            const autoDetected = determineTahunAjaranSemester(dateNormalized)
            const entryTahunAjaran = entry.tahunAjaran || defaultTahunAjaran || autoDetected.tahunAjaran
            const entrySemester = entry.semester ? parseInt(entry.semester) : (defaultSemester || autoDetected.semester)

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

        // Jalankan seluruh upsert dalam 1 transaksi batch (anti N+1 round-trips)
        await prisma.$transaction(upsertOps)

        // Sinkronisasi otomatis ke Agenda Mengajar (Jurnal) untuk kelas & tanggal ini
        if (targetDateNormalized && targetKelas) {
            try {
                const absentList = await prisma.absensi.findMany({
                    where: {
                        kelas: targetKelas,
                        tanggal: targetDateNormalized,
                    },
                    include: {
                        siswa: { select: { nama: true } }
                    }
                })

                const sNames = absentList.filter(a => a.status === "S").map(a => a.siswa.nama)
                const iNames = absentList.filter(a => a.status === "I").map(a => a.siswa.nama)
                const aNames = absentList.filter(a => a.status === "A").map(a => a.siswa.nama)

                const s = sNames.length
                const i = iNames.length
                const a = aNames.length
                const tdkHadir = s + i + a
                const totalSiswa = await prisma.siswa.count({ where: { kelas: targetKelas, status: "aktif" } })
                const hadir = Math.max(0, totalSiswa - tdkHadir)

                const parts: string[] = []
                if (sNames.length > 0) parts.push(`Sakit: ${sNames.join(", ")}`)
                if (iNames.length > 0) parts.push(`Izin: ${iNames.join(", ")}`)
                if (aNames.length > 0) parts.push(`Alpa: ${aNames.join(", ")}`)
                const siswaAbsenText = parts.length > 0 ? parts.join(" | ") : null

                // Update semua jurnal pada kelas dan tanggal bersangkutan
                await prisma.jurnal.updateMany({
                    where: {
                        kelas: targetKelas,
                        tanggal: targetDateNormalized,
                    },
                    data: {
                        jmlSakit: s,
                        jmlIzin: i,
                        jmlAlpha: a,
                        jmlHadir: hadir,
                        jmlTdkHadir: tdkHadir,
                        siswaAbsen: siswaAbsenText,
                    }
                })
            } catch (syncErr) {
                console.warn("Auto-sync absensi to jurnal warning:", syncErr)
            }
        }

        return NextResponse.json({ success: true, message: `${entries.length} data absensi berhasil disimpan dan disinkronkan ke Jurnal.` })
    } catch (error) {
        console.error("Error saving absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
