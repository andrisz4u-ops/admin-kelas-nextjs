import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

        const { id } = await params
        const existingStudent = await prisma.siswa.findUnique({ where: { id } })
        if (!existingStudent) {
            return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 })
        }

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Hak akses: Admin bebas mengedit; Wali kelas hanya boleh mengedit siswa di kelasnya sendiri
        if (userRole !== "admin") {
            const isOwnStudent = userRole === "guru" && userKelas && existingStudent.kelas === userKelas
            if (!isOwnStudent) {
                return NextResponse.json({
                    error: "Akses ditolak. Anda hanya berhak mengedit data siswa di kelas yang Anda ampu."
                }, { status: 403 })
            }
        }

        const body = await request.json()
        const { nis, nama, jenisKelamin, alamat, namaOrtu, noHp } = body

        // Wali kelas tidak diizinkan mengubah NIS (kunci unik siswa)
        const updateData: any = {
            nama: nama !== undefined ? String(nama).trim() : existingStudent.nama,
            jenisKelamin: jenisKelamin !== undefined ? String(jenisKelamin).toUpperCase() : existingStudent.jenisKelamin,
            alamat: alamat !== undefined ? alamat : existingStudent.alamat,
            namaOrtu: namaOrtu !== undefined ? namaOrtu : existingStudent.namaOrtu,
            noHp: noHp !== undefined ? noHp : existingStudent.noHp,
        }

        // Hanya admin yang diizinkan mengubah NIS
        if (userRole === "admin" && nis) {
            const cleanNis = String(nis).trim()
            if (cleanNis !== existingStudent.nis) {
                const duplicateNis = await prisma.siswa.findUnique({ where: { nis: cleanNis } })
                if (duplicateNis) {
                    return NextResponse.json({ error: "NIS sudah digunakan oleh siswa lain" }, { status: 400 })
                }
                updateData.nis = cleanNis
            }
        }

        const siswa = await prisma.siswa.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json(siswa)
    } catch (error) {
        console.error("Error updating siswa:", error)
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
        await prisma.siswa.delete({ where: { id } })

        return NextResponse.json({ message: "Siswa berhasil dihapus" })
    } catch (error) {
        console.error("Error deleting siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
