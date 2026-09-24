import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { siswaService } from "@/services/siswaService"

// GET all students for a class
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelasParam = searchParams.get("kelas")
        const statusParam = searchParams.get("status") || "aktif" // default: hanya aktif
        const tahunLulusParam = searchParams.get("tahunLulus") || undefined
        const search = searchParams.get("search") || undefined
        const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined
        const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined

        const siswa = await siswaService.getSiswaList({
            kelas: kelasParam ? parseInt(kelasParam) : undefined,
            status: statusParam,
            tahunLulus: tahunLulusParam,
            search,
            page,
            limit,
        })

        return NextResponse.json(siswa)
    } catch (error) {
        console.error("Error fetching siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST create new student
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat menambah siswa" }, { status: 403 })
        }

        const body = await request.json()
        const { nis, nama, jenisKelamin, kelas, alamat, namaOrtu, noHp } = body

        if (!nis || !nama) {
            return NextResponse.json({ error: "NIS dan Nama wajib diisi" }, { status: 400 })
        }

        const siswa = await siswaService.createSiswa({
            nis,
            nama,
            jenisKelamin,
            kelas: parseInt(kelas) || 1,
            alamat,
            namaOrtu,
            noHp,
        })

        return NextResponse.json(siswa, { status: 201 })
    } catch (error: any) {
        console.error("Error creating siswa:", error)
        if (error.message === "NIS sudah terdaftar") {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
