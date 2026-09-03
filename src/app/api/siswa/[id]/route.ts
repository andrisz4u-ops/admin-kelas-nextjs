import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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
        const siswa = await prisma.siswa.findUnique({ where: { id } })

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

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat mengedit siswa" }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { nis, nama, jenisKelamin, alamat, namaOrtu, noHp } = body

        const siswa = await prisma.siswa.update({
            where: { id },
            data: { nis, nama, jenisKelamin, alamat, namaOrtu, noHp },
        })

        return NextResponse.json(siswa)
    } catch (error) {
        console.error("Error updating siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE student
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
        await prisma.siswa.delete({ where: { id } })

        return NextResponse.json({ message: "Siswa berhasil dihapus" })
    } catch (error) {
        console.error("Error deleting siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
