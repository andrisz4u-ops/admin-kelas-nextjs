import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

        const startDate = new Date(tanggalMulai)
        const endDate = tanggalSelesai ? new Date(tanggalSelesai) : null

        if (endDate && endDate < startDate) {
            return NextResponse.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" }, { status: 400 })
        }

        const updated = await prisma.kalenderEvent.update({
            where: { id },
            data: {
                judul,
                tanggalMulai: startDate,
                tanggalSelesai: endDate,
                tipe: tipe || "event",
                isLibur: isLibur !== undefined ? Boolean(isLibur) : tipe === "holiday",
                semester: semester ? Number(semester) : null,
                deskripsi: deskripsi || null,
            },
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
        await prisma.kalenderEvent.delete({
            where: { id },
        })

        return NextResponse.json({ success: true, message: "Agenda berhasil dihapus" })
    } catch (error) {
        console.error("Error deleting kalender event:", error)
        return NextResponse.json({ error: "Gagal menghapus agenda kalender" }, { status: 500 })
    }
}
