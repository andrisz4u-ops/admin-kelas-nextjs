import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - List aset with optional search & pagination
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q") || searchParams.get("search") || undefined
        const kategori = searchParams.get("kategori") || undefined
        const kib = searchParams.get("kib") || undefined
        const kondisi = searchParams.get("kondisi") || undefined
        const pageParam = searchParams.get("page")
        const limitParam = searchParams.get("limit")

        const where: any = {}
        if (kategori && kategori !== "all") where.kategori = kategori
        if (kib && kib !== "all") where.kib = kib
        if (kondisi && kondisi !== "all") where.kondisi = kondisi
        if (q) {
            where.OR = [
                { namaAset: { contains: q, mode: "insensitive" } },
                { lokasi: { contains: q, mode: "insensitive" } },
                { keterangan: { contains: q, mode: "insensitive" } },
            ]
        }

        if (pageParam || limitParam) {
            const page = Math.max(1, parseInt(pageParam || "1"))
            const limit = Math.max(1, parseInt(limitParam || "20"))
            const skip = (page - 1) * limit

            const [total, data] = await Promise.all([
                prisma.aset.count({ where }),
                prisma.aset.findMany({
                    where,
                    orderBy: { namaAset: "asc" },
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

        const aset = await prisma.aset.findMany({
            where,
            orderBy: { namaAset: "asc" }
        })

        return NextResponse.json(aset)
    } catch (error) {
        console.error("Error fetching aset:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST - Create new aset (admin only)
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
        const {
            namaAset, kib, kategori, jumlah, kondisi, lokasi,
            tahunPerolehan, sumberDana, hargaPerolehan,
            nilaiPerUnit, buktiKepemilikan, tanggalBeli, keterangan
        } = body

        if (!namaAset || !kib || !kategori || !kondisi || !tahunPerolehan || !sumberDana || hargaPerolehan === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const aset = await prisma.aset.create({
            data: {
                namaAset,
                kib,
                kategori,
                jumlah: jumlah || 1,
                kondisi,
                lokasi,
                tahunPerolehan: parseInt(tahunPerolehan),
                sumberDana,
                hargaPerolehan: parseFloat(hargaPerolehan),
                nilaiPerUnit: nilaiPerUnit ? parseFloat(nilaiPerUnit) : null,
                buktiKepemilikan,
                tanggalBeli: tanggalBeli ? new Date(tanggalBeli) : null,
                keterangan
            }
        })

        return NextResponse.json(aset, { status: 201 })
    } catch (error) {
        console.error("Error creating aset:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
