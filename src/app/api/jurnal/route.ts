import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET jurnal for a class
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelasParam = searchParams.get("kelas")
        const mapelParam = searchParams.get("mapel")

        const whereClause: any = {}
        if (kelasParam && kelasParam !== "ALL") {
            whereClause.kelas = parseInt(kelasParam)
        } else if (!kelasParam) {
            whereClause.kelas = 5
        }
        if (mapelParam) {
            whereClause.mapel = { contains: mapelParam, mode: "insensitive" }
        }

        const jurnal = await prisma.jurnal.findMany({
            where: whereClause,
            orderBy: { tanggal: "desc" },
        })

        return NextResponse.json(jurnal)
    } catch (error) {
        console.error("Error fetching jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST create jurnal
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        // Batch creation support
        if (Array.isArray(body)) {
            const createdList = await prisma.$transaction(
                body.map(item =>
                    prisma.jurnal.create({
                        data: {
                            tanggal: new Date(item.tanggal),
                            jamKe: item.jamKe,
                            mapel: item.mapel,
                            materi: item.materi || "Pembelajaran sesuai modul / silabus",
                            metode: item.metode || "-",
                            catatan: item.catatan || null,
                            siswaAbsen: item.siswaAbsen || null,
                            kategori: item.kategori || "KBM",
                            jmlSakit: item.jmlSakit !== undefined ? Number(item.jmlSakit) : 0,
                            jmlIzin: item.jmlIzin !== undefined ? Number(item.jmlIzin) : 0,
                            jmlAlpha: item.jmlAlpha !== undefined ? Number(item.jmlAlpha) : 0,
                            jmlHadir: item.jmlHadir !== undefined ? Number(item.jmlHadir) : null,
                            jmlTdkHadir: item.jmlTdkHadir !== undefined ? Number(item.jmlTdkHadir) : 0,
                            paraf: item.paraf || null,
                            kelas: parseInt(item.kelas),
                        }
                    })
                )
            )
            return NextResponse.json(createdList, { status: 201 })
        }

        const {
            tanggal,
            jamKe,
            mapel,
            materi,
            metode,
            catatan,
            siswaAbsen,
            kelas,
            kategori,
            jmlSakit,
            jmlIzin,
            jmlAlpha,
            jmlHadir,
            jmlTdkHadir,
            paraf
        } = body

        const jurnal = await prisma.jurnal.create({
            data: {
                tanggal: new Date(tanggal),
                jamKe,
                mapel,
                materi,
                metode: metode || "-",
                catatan,
                siswaAbsen,
                kategori: kategori || "KBM",
                jmlSakit: jmlSakit !== undefined ? Number(jmlSakit) : 0,
                jmlIzin: jmlIzin !== undefined ? Number(jmlIzin) : 0,
                jmlAlpha: jmlAlpha !== undefined ? Number(jmlAlpha) : 0,
                jmlHadir: jmlHadir !== undefined ? Number(jmlHadir) : null,
                jmlTdkHadir: jmlTdkHadir !== undefined ? Number(jmlTdkHadir) : 0,
                paraf: paraf || null,
                kelas: parseInt(kelas),
            },
        })

        return NextResponse.json(jurnal, { status: 201 })
    } catch (error) {
        console.error("Error creating jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
