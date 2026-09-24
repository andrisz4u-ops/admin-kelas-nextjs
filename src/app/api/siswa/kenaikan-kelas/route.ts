import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hitungTahunAjaranBaru, siswaService } from "@/services/siswaService"

export const dynamic = "force-dynamic"

// GET: preview jumlah siswa aktif per kelas
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Count active students per class
        const counts = await prisma.siswa.groupBy({
            by: ["kelas"],
            where: { status: "aktif" },
            _count: { id: true },
            orderBy: { kelas: "asc" },
        })

        const perKelas: Record<number, number> = {}
        for (const c of counts) {
            perKelas[c.kelas] = c._count.id
        }

        const settings = await prisma.schoolSettings.findFirst()
        const tahunAjaranSekarang = settings?.tahunAjaran || "2025/2026"
        const tahunAjaranBaru = hitungTahunAjaranBaru(tahunAjaranSekarang)

        return NextResponse.json({
            perKelas,
            tahunAjaranSekarang,
            tahunAjaranBaru,
        })
    } catch (error) {
        console.error("Error fetching preview:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST: proses kenaikan kelas
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat memproses kenaikan kelas" }, { status: 403 })
        }

        const body = await request.json()
        const { tahunAjaranBaru } = body

        if (!tahunAjaranBaru) {
            return NextResponse.json({ error: "Tahun ajaran baru harus diisi" }, { status: 400 })
        }

        const result = await siswaService.prosesKenaikanKelas(tahunAjaranBaru, session.user?.id)

        return NextResponse.json({
            success: true,
            message: `Kenaikan kelas berhasil diproses. ${result.alumni} siswa kelas 6 diarsipkan sebagai alumni.`,
            ...result,
        })
    } catch (error) {
        console.error("Error processing kenaikan kelas:", error)
        return NextResponse.json({ error: "Gagal memproses kenaikan kelas" }, { status: 500 })
    }
}
