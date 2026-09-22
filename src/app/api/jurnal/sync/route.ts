import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST /api/jurnal/sync
// Sinkronkan data kehadiran siswa (S/I/A dan nama siswa) dari tabel Absensi ke Agenda Mengajar (Jurnal)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { kelas, tanggal } = body

        if (!kelas || !tanggal) {
            return NextResponse.json({ error: "kelas dan tanggal wajib disertakan" }, { status: 400 })
        }

        const kelasNum = parseInt(kelas)
        const [y, m, d] = tanggal.split("-").map(Number)
        const queryDateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
        const queryDateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))

        // Ambil data absensi siswa aktif pada tanggal dan kelas tersebut
        const absensiList = await prisma.absensi.findMany({
            where: {
                siswa: { kelas: kelasNum, status: "aktif" },
                tanggal: {
                    gte: queryDateStart,
                    lte: queryDateEnd,
                },
            },
            include: {
                siswa: { select: { id: true, nama: true } },
            },
        })

        const sNames = absensiList.filter(a => a.status === "S").map(a => a.siswa.nama)
        const iNames = absensiList.filter(a => a.status === "I").map(a => a.siswa.nama)
        const aNames = absensiList.filter(a => a.status === "A").map(a => a.siswa.nama)

        const s = sNames.length
        const i = iNames.length
        const a = aNames.length
        const tdkHadir = s + i + a
        const totalSiswa = await prisma.siswa.count({ where: { kelas: kelasNum, status: "aktif" } })
        const hadir = Math.max(0, totalSiswa - tdkHadir)

        const parts: string[] = []
        if (sNames.length > 0) parts.push(`Sakit: ${sNames.join(", ")}`)
        if (iNames.length > 0) parts.push(`Izin: ${iNames.join(", ")}`)
        if (aNames.length > 0) parts.push(`Alpa: ${aNames.join(", ")}`)
        const siswaAbsenText = parts.length > 0 ? parts.join(" | ") : null

        // Update semua record Jurnal pada kelas dan tanggal ini
        const updateResult = await prisma.jurnal.updateMany({
            where: {
                kelas: kelasNum,
                tanggal: {
                    gte: queryDateStart,
                    lte: queryDateEnd,
                },
            },
            data: {
                jmlSakit: s,
                jmlIzin: i,
                jmlAlpha: a,
                jmlHadir: hadir,
                jmlTdkHadir: tdkHadir,
                siswaAbsen: siswaAbsenText,
            },
        })

        return NextResponse.json({
            success: true,
            updatedCount: updateResult.count,
            attendance: {
                s,
                i,
                a,
                hadir,
                tdkHadir,
                totalSiswa,
                sNames,
                iNames,
                aNames,
                siswaAbsenText,
            },
        })
    } catch (error) {
        console.error("Error syncing absensi to jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
