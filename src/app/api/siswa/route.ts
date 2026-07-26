import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

        const whereClause: any = {}
        if (kelasParam) {
            whereClause.kelas = parseInt(kelasParam)
        }
        // Filter by status: "aktif", "alumni", or "all"
        if (statusParam !== "all") {
            whereClause.status = statusParam
        }

        const siswa = await prisma.siswa.findMany({
            where: whereClause,
            orderBy: { nama: "asc" },
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

        const body = await request.json()
        const { nis, nama, jenisKelamin, kelas, alamat, namaOrtu, noHp } = body

        // Check if NIS already exists
        const existing = await prisma.siswa.findUnique({ where: { nis } })
        if (existing) {
            return NextResponse.json({ error: "NIS sudah terdaftar" }, { status: 400 })
        }

        const siswa = await prisma.siswa.create({
            data: {
                nis,
                nama,
                jenisKelamin,
                kelas: parseInt(kelas),
                alamat,
                namaOrtu,
                noHp,
            },
        })

        return NextResponse.json(siswa, { status: 201 })
    } catch (error) {
        console.error("Error creating siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
