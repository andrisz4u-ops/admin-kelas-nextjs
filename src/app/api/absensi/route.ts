import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET absensi for a class and date
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const tanggal = searchParams.get("tanggal")

        if (!tanggal) {
            return NextResponse.json({ error: "Tanggal required" }, { status: 400 })
        }

        // Parse YYYY-MM-DD and create UTC date boundaries
        // This ensures consistent querying regardless of server timezone
        const [year, month, day] = tanggal.split('-').map(Number)

        // Start of day: 00:00:00.000 Z
        const queryDateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

        // End of day: 23:59:59.999 Z
        const queryDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))

        const absensi = await prisma.absensi.findMany({
            where: {
                siswa: { kelas, status: "aktif" },
                tanggal: {
                    gte: queryDateStart,
                    lte: queryDateEnd
                },
            },
            select: {
                siswaId: true,
                status: true,
            },
        })

        return NextResponse.json(absensi)
    } catch (error) {
        console.error("Error fetching absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST save absensi
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { entries } = await request.json()

        if (!Array.isArray(entries)) {
            return NextResponse.json({ error: "Entries harus berupa array" }, { status: 400 })
        }

        for (const entry of entries) {
            // Strict Date Parsing: YYYY-MM-DD -> UTC Midnight
            const dateStr = new Date(entry.tanggal).toISOString().split('T')[0]
            const [y, m, d] = dateStr.split('-').map(Number)
            const dateNormalized = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))

            await prisma.absensi.upsert({
                where: {
                    siswaId_tanggal: {
                        siswaId: entry.siswaId,
                        tanggal: dateNormalized,
                    },
                },
                update: { status: entry.status },
                create: {
                    siswaId: entry.siswaId,
                    tanggal: dateNormalized,
                    status: entry.status,
                },
            })
        }

        return NextResponse.json({ message: "Absensi saved" })
    } catch (error) {
        console.error("Error saving absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
