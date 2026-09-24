import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { siswaService } from "@/services/siswaService"

export const dynamic = 'force-dynamic'

// GET single student
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const siswa = await siswaService.getSiswaById(id)

        if (!siswa) {
            return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 })
        }

        return NextResponse.json(siswa)
    } catch (error) {
        console.error("Error fetching siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PUT update student
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        const siswa = await siswaService.updateSiswa(
            id,
            body,
            session.user.role,
            session.user.kelas
        )

        return NextResponse.json(siswa)
    } catch (error: any) {
        console.error("Error updating siswa:", error)
        if (error.message === "Siswa tidak ditemukan") {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error.message.includes("Akses ditolak")) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error.message.includes("sudah digunakan")) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE student (Tetap eksklusif Admin)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat menghapus siswa" }, { status: 403 })
        }

        const { id } = await params
        await siswaService.deleteSiswa(id)

        return NextResponse.json({ message: "Siswa berhasil dihapus" })
    } catch (error) {
        console.error("Error deleting siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
