import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { kalenderService } from "@/services/kalenderService"

export const dynamic = "force-dynamic"

// PUT /api/kalender/event/[id] - Update event (Admin only)
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const { id } = params
        const body = await request.json()
        const { judul, tanggalMulai, tanggalSelesai, tipe, isLibur, semester, deskripsi } = body

        if (!judul || !tanggalMulai) {
            return NextResponse.json({ error: "Judul dan tanggalMulai wajib diisi" }, { status: 400 })
        }

        const updated = await kalenderService.updateEvent(id, {
            judul,
            tanggalMulai,
            tanggalSelesai,
            tipe,
            isLibur,
            semester,
            deskripsi,
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Error updating kalender event:", error)
        return NextResponse.json({ error: "Gagal memperbarui agenda kalender" }, { status: 500 })
    }
}

// DELETE /api/kalender/event/[id] - Delete event (Admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const { id } = params
        await kalenderService.deleteEvent(id)

        return NextResponse.json({ success: true, message: "Agenda berhasil dihapus" })
    } catch (error) {
        console.error("Error deleting kalender event:", error)
        return NextResponse.json({ error: "Gagal menghapus agenda kalender" }, { status: 500 })
    }
}
