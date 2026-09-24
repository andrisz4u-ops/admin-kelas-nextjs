import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - List buku with optional search & pagination
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q") || searchParams.get("search") || undefined
        const kategori = searchParams.get("kategori") || undefined
        const kelas = searchParams.get("kelas") ? parseInt(searchParams.get("kelas")!) : undefined
        const pageParam = searchParams.get("page")
        const limitParam = searchParams.get("limit")

        const where: any = {}
        if (kategori && kategori !== "all") where.kategori = kategori
        if (kelas) where.kelas = kelas
        if (q) {
            where.OR = [
                { judul: { contains: q, mode: "insensitive" } },
                { penulis: { contains: q, mode: "insensitive" } },
                { penerbit: { contains: q, mode: "insensitive" } },
                { isbn: { contains: q, mode: "insensitive" } },
            ]
        }

        if (pageParam || limitParam) {
            const page = Math.max(1, parseInt(pageParam || "1"))
            const limit = Math.max(1, parseInt(limitParam || "20"))
            const skip = (page - 1) * limit

            const [total, data] = await Promise.all([
                prisma.buku.count({ where }),
                prisma.buku.findMany({
                    where,
                    orderBy: { judul: "asc" },
                    skip,
                    take: limit,
                }),
            ])

            return NextResponse.json({
                data,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            })
        }

        const buku = await prisma.buku.findMany({
            where,
            orderBy: { judul: "asc" }
        })

        return NextResponse.json(buku)
    } catch (error) {
        console.error("Error fetching buku:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST - Create new buku (admin only)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { judul, penulis, penerbit, tahunTerbit, isbn, kategori, kelas, jumlahCopy, lokasi } = body

        if (!judul || !penulis || !kategori) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const buku = await prisma.buku.create({
            data: {
                judul,
                penulis,
                penerbit,
                tahunTerbit,
                isbn,
                kategori,
                kelas,
                jumlahCopy: jumlahCopy || 1,
                lokasi
            }
        })

        return NextResponse.json(buku, { status: 201 })
    } catch (error) {
        console.error("Error creating buku:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
