import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

        // Parse YYYY-MM-DD and create UTC date boundaries
        // This ensures consistent querying regardless of server timezone
        const [year, month, day] = tanggal.split('-').map(Number)

        // Start of day: 00:00:00.000 Z
        const queryDateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

        // End of day: 23:59:59.999 Z
        const queryDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))

        const absensi = await prisma.absensi.findMany({
            where: {
                siswa: { kelas, status: "aktif" },
                tanggal: {
                    gte: queryDateStart,
                    lte: queryDateEnd
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

        const body = await request.json()
        const entries = body.entries
        const kelasParam = body.kelas ? parseInt(body.kelas) : null

        if (!Array.isArray(entries)) {
            return NextResponse.json({ error: "Entries harus berupa array" }, { status: 400 })
        }

        let targetDateNormalized: Date | null = null

        for (const entry of entries) {
            // Strict Date Parsing: YYYY-MM-DD -> UTC Midnight
            const dateStr = new Date(entry.tanggal).toISOString().split('T')[0]
            const [y, m, d] = dateStr.split('-').map(Number)
            const dateNormalized = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
            if (!targetDateNormalized) targetDateNormalized = dateNormalized

            await prisma.absensi.upsert({
                where: {
                    siswaId_tanggal: {
                        siswaId: entry.siswaId,
                        tanggal: dateNormalized,
                    },
                },
                update: { status: entry.status },
                create: {
                    siswaId: entry.siswaId,
                    tanggal: dateNormalized,
                    status: entry.status,
                },
            })
        }

        // Sinkronisasi otomatis ke Agenda Mengajar (Jurnal) untuk kelas & tanggal ini
        if (targetDateNormalized && kelasParam) {
            try {
                const absentList = await prisma.absensi.findMany({
                    where: {
                        siswa: { kelas: kelasParam, status: "aktif" },
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
                const totalSiswa = await prisma.siswa.count({ where: { kelas: kelasParam, status: "aktif" } })
                const hadir = Math.max(0, totalSiswa - tdkHadir)

                const parts: string[] = []
                if (sNames.length > 0) parts.push(`Sakit: ${sNames.join(", ")}`)
                if (iNames.length > 0) parts.push(`Izin: ${iNames.join(", ")}`)
                if (aNames.length > 0) parts.push(`Alpa: ${aNames.join(", ")}`)
                const siswaAbsenText = parts.length > 0 ? parts.join(" | ") : null

                // Update semua jurnal pada kelas dan tanggal bersangkutan
                await prisma.jurnal.updateMany({
                    where: {
                        kelas: kelasParam,
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

        return NextResponse.json({ message: "Absensi saved and synced to Jurnal" })
    } catch (error) {
        console.error("Error saving absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
