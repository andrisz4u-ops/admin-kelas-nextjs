import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { kalenderService } from "@/services/kalenderService"

export const dynamic = "force-dynamic"

// GET /api/kalender?tahunAjaran=2026/2027
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const tahunAjaran = searchParams.get("tahunAjaran") || undefined

        const data = await kalenderService.getKalenderData(tahunAjaran)
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error fetching kalender:", error)
        return NextResponse.json({ error: "Gagal memuat kalender akademik" }, { status: 500 })
    }
}

// POST /api/kalender - Create new event (Admin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const body = await request.json()
        const { tahunAjaran, judul, tanggalMulai, tanggalSelesai, tipe, isLibur, semester, deskripsi } = body

        if (!tahunAjaran || !judul || !tanggalMulai) {
            return NextResponse.json({ error: "tahunAjaran, judul, dan tanggalMulai wajib diisi" }, { status: 400 })
        }

        const newEvent = await kalenderService.createEvent({
            tahunAjaran,
            judul,
            tanggalMulai,
            tanggalSelesai,
            tipe,
            isLibur,
            semester,
            deskripsi,
        })

        return NextResponse.json(newEvent, { status: 201 })
    } catch (error) {
        console.error("Error creating kalender event:", error)
        return NextResponse.json({ error: "Gagal menambahkan agenda kalender" }, { status: 500 })
    }
}
