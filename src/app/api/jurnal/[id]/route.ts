import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

import { parseToUTCMidnight } from "@/lib/dateUtils"

// PUT update jurnal
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
        const {
            tanggal,
            jamKe,
            mapel,
            materi,
            metode,
            catatan,
            siswaAbsen,
            kategori,
            jmlSakit,
            jmlIzin,
            jmlAlpha,
            jmlHadir,
            jmlTdkHadir,
            paraf
        } = body

        const jurnal = await prisma.jurnal.update({
            where: { id },
            data: {
                tanggal: parseToUTCMidnight(tanggal),
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
            },
        })

        return NextResponse.json(jurnal)
    } catch (error) {
        console.error("Error updating jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE jurnal
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        await prisma.jurnal.delete({ where: { id } })

        return NextResponse.json({ message: "Jurnal deleted" })
    } catch (error) {
        console.error("Error deleting jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
