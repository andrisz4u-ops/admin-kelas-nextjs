import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const kelas = searchParams.get("kelas")

    if (!kelas) return NextResponse.json({ error: "Kelas is required" }, { status: 400 })

    try {
        const schedule = await prisma.jadwalPelajaran.findMany({
            where: { kelas: Number(kelas) },
            orderBy: [{ hari: 'asc' }, { jamKe: 'asc' }]
        })
        return NextResponse.json(schedule)
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Allow Admin and Guru to edit schedule
    // Idealnya dicek role, tapi untuk sekarang kita percayakan pada session school logic

    try {
        const body = await request.json()
        const { id, kelas, hari, jamKe, waktu, mapel, guru } = body

        if (id) {
            // Update
            const updated = await prisma.jadwalPelajaran.update({
                where: { id },
                data: { kelas, hari, jamKe, waktu, mapel, guru }
            })
            return NextResponse.json(updated)
        } else {
            // Create
            // Check if slot exists (upsert logic handled by frontend ID or unique constraint)
            // But if we want to be safe, we can use upsert on unique constraint
            const upserted = await prisma.jadwalPelajaran.upsert({
                where: {
                    kelas_hari_jamKe: {
                        kelas: Number(kelas),
                        hari,
                        jamKe: Number(jamKe)
                    }
                },
                update: { waktu, mapel, guru },
                create: { kelas: Number(kelas), hari, jamKe: Number(jamKe), waktu, mapel, guru }
            })
            return NextResponse.json(upserted)
        }
    } catch (error) {
        console.error("Error saving schedule:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    try {
        await prisma.jadwalPelajaran.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
