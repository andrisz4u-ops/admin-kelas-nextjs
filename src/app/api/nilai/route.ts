import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET nilai for a class, mapel, and jenisNilai
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const mapel = searchParams.get("mapel")
        const jenisNilai = searchParams.get("jenisNilai")
        const semester = parseInt(searchParams.get("semester") || "1")

        if (!mapel || !jenisNilai) {
            return NextResponse.json({ error: "Mapel and jenisNilai required" }, { status: 400 })
        }

        const nilai = await prisma.nilai.findMany({
            where: {
                siswa: { kelas },
                mapel,
                jenisNilai,
                semester,
            },
            select: {
                siswaId: true,
                nilai: true,
            },
        })

        return NextResponse.json(nilai)
    } catch (error) {
        console.error("Error fetching nilai:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST save nilai
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { entries, semester } = await request.json()
        const fallbackSemester = semester ? parseInt(String(semester)) : 1

        for (const entry of entries) {
            const entrySemester = entry.semester ? parseInt(String(entry.semester)) : fallbackSemester
            await prisma.nilai.upsert({
                where: {
                    siswaId_mapel_jenisNilai_semester: {
                        siswaId: entry.siswaId,
                        mapel: entry.mapel,
                        jenisNilai: entry.jenisNilai,
                        semester: entrySemester,
                    },
                },
                update: { nilai: entry.nilai },
                create: {
                    siswaId: entry.siswaId,
                    mapel: entry.mapel,
                    jenisNilai: entry.jenisNilai,
                    semester: entrySemester,
                    nilai: entry.nilai,
                },
            })
        }

        return NextResponse.json({ message: "Nilai saved" })
    } catch (error) {
        console.error("Error saving nilai:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
