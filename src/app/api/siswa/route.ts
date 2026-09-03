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
        const tahunLulusParam = searchParams.get("tahunLulus")

        const whereClause: any = {}
        // If searching specifically for alumni, don't restrict to kelas 1-6 unless explicitly passed
        if (kelasParam && statusParam !== "alumni") {
            whereClause.kelas = parseInt(kelasParam)
        } else if (kelasParam && statusParam === "alumni") {
            whereClause.kelas = parseInt(kelasParam)
        }

        // Filter by status: "aktif", "alumni", or "all"
        if (statusParam !== "all") {
            whereClause.status = statusParam
        }

        if (tahunLulusParam && tahunLulusParam !== "all") {
            whereClause.tahunLulus = tahunLulusParam
        }

        const siswa = await prisma.siswa.findMany({
            where: whereClause,
            orderBy: [{ nama: "asc" }],
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

        // Check if NIS already exists
        const existing = await prisma.siswa.findUnique({ where: { nis } })
        if (existing) {
            return NextResponse.json({ error: "NIS sudah terdaftar" }, { status: 400 })
        }

        const parsedKelas = parseInt(kelas) || 1
        const siswa = await prisma.siswa.create({
            data: {
                nis: String(nis).trim(),
                nama: String(nama).trim(),
                jenisKelamin: String(jenisKelamin || "L").toUpperCase(),
                kelas: parsedKelas,
                alamat: alamat || null,
                namaOrtu: namaOrtu || null,
                noHp: noHp || null,
                status: "aktif"
            },
        })

        return NextResponse.json(siswa, { status: 201 })
    } catch (error) {
        console.error("Error creating siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
