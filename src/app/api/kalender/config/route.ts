import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

// POST /api/kalender/config - Upsert semester range config for academic year (Admin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const body = await request.json()
        const {
            tahunAjaran,
            semester1Mulai,
            semester1Selesai,
            semester2Mulai,
            semester2Selesai,
        } = body

        if (!tahunAjaran || !semester1Mulai || !semester1Selesai || !semester2Mulai || !semester2Selesai) {
            return NextResponse.json(
                { error: "Semua tanggal semester (mulai & selesai Semester 1 & 2) wajib diisi" },
                { status: 400 }
            )
        }

        const config = await prisma.kalenderConfig.upsert({
            where: { tahunAjaran },
            update: {
                semester1Mulai: new Date(semester1Mulai),
                semester1Selesai: new Date(semester1Selesai),
                semester2Mulai: new Date(semester2Mulai),
                semester2Selesai: new Date(semester2Selesai),
            },
            create: {
                tahunAjaran,
                semester1Mulai: new Date(semester1Mulai),
                semester1Selesai: new Date(semester1Selesai),
                semester2Mulai: new Date(semester2Mulai),
                semester2Selesai: new Date(semester2Selesai),
            },
        })

        return NextResponse.json(config)
    } catch (error) {
        console.error("Error updating kalender config:", error)
        return NextResponse.json({ error: "Gagal menyimpan konfigurasi semester kalender" }, { status: 500 })
    }
}
