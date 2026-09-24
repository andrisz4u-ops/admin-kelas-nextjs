import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseToUTCMidnight } from "@/lib/dateUtils"

export const dynamic = 'force-dynamic'

// GET teacher attendance by date
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const tanggal = searchParams.get("tanggal")
        const bulan = searchParams.get("bulan") // Format: YYYY-MM

        if (tanggal) {
            const dateObj = parseToUTCMidnight(tanggal)

            const attendance = await prisma.absensiGuru.findMany({
                where: {
                    tanggal: dateObj
                }
            })

            // Get user names
            const userIds = attendance.map(a => a.userId)
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            })

            const result = attendance.map(a => ({
                userId: a.userId,
                userName: users.find(u => u.id === a.userId)?.name || "",
                waktuDatang: a.waktuDatang || "",
                ttdDatang: a.ttdDatang || "",
                waktuPulang: a.waktuPulang || "",
                ttdPulang: a.ttdPulang || "",
            }))

            return NextResponse.json(result)
        }

        if (bulan) {
            // Monthly recap
            const [year, month] = bulan.split("-").map(Number)
            const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

            const attendance = await prisma.absensiGuru.findMany({
                where: {
                    tanggal: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            })

            return NextResponse.json(attendance)
        }

        return NextResponse.json({ error: "Parameter tanggal atau bulan required" }, { status: 400 })
    } catch (error) {
        console.error("Error fetching teacher attendance:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST save teacher attendance
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { tanggal, attendance } = body

        if (!tanggal || !Array.isArray(attendance) || attendance.length === 0) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        const dateObj = parseToUTCMidnight(tanggal)

        // Batch execution with prisma.$transaction
        await prisma.$transaction(
            attendance.map((att: any) => {
                const { userId, waktuDatang, ttdDatang, waktuPulang, ttdPulang } = att
                return prisma.absensiGuru.upsert({
                    where: {
                        userId_tanggal: { userId, tanggal: dateObj }
                    },
                    update: {
                        waktuDatang: waktuDatang || null,
                        ttdDatang: ttdDatang || null,
                        waktuPulang: waktuPulang || null,
                        ttdPulang: ttdPulang || null,
                    },
                    create: {
                        userId,
                        tanggal: dateObj,
                        waktuDatang: waktuDatang || null,
                        ttdDatang: ttdDatang || null,
                        waktuPulang: waktuPulang || null,
                        ttdPulang: ttdPulang || null,
                    }
                })
            })
        )

        return NextResponse.json({ success: true, count: attendance.length })
    } catch (error) {
        console.error("Error saving teacher attendance:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
