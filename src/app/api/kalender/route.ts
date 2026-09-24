import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Helper: format Date to "YYYY-MM-DD"
function formatDateStr(date: Date): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

// Helper: expand date range into array of "YYYY-MM-DD"
function expandDateRange(start: Date, end: Date | null): string[] {
    const dates: string[] = []
    const cur = new Date(start)
    const stop = end ? new Date(end) : new Date(start)

    while (cur <= stop) {
        dates.push(formatDateStr(cur))
        cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
}

// GET /api/kalender?tahunAjaran=2026/2027
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        let tahunAjaran = searchParams.get("tahunAjaran")

        // If not specified, get from school settings
        if (!tahunAjaran) {
            const schoolSettings = await prisma.schoolSettings.findFirst()
            tahunAjaran = schoolSettings?.tahunAjaran || "2026/2027"
        }

        // Fetch config & events in parallel
        const [config, events, configsAll, eventsAll] = await Promise.all([
            prisma.kalenderConfig.findUnique({
                where: { tahunAjaran },
            }),
            prisma.kalenderEvent.findMany({
                where: { tahunAjaran },
                orderBy: { tanggalMulai: "asc" },
            }),
            prisma.kalenderConfig.findMany({
                select: { tahunAjaran: true },
            }),
            prisma.kalenderEvent.findMany({
                select: { tahunAjaran: true },
                distinct: ["tahunAjaran"],
            }),
        ])

        // Collect all distinct academic years available
        const yearSet = new Set<string>()
        configsAll.forEach((c) => yearSet.add(c.tahunAjaran))
        eventsAll.forEach((e) => yearSet.add(e.tahunAjaran))
        // Ensure default years exist in list
        yearSet.add("2025/2026")
        yearSet.add("2026/2027")
        if (tahunAjaran) yearSet.add(tahunAjaran)
        const availableYears = Array.from(yearSet).sort()

        // Build list of holiday dates (expanded from single days and ranges)
        const holidaySet = new Set<string>()
        for (const ev of events) {
            if (ev.isLibur || ev.tipe === "holiday") {
                const dates = expandDateRange(ev.tanggalMulai, ev.tanggalSelesai)
                dates.forEach((d) => holidaySet.add(d))
            }
        }

        return NextResponse.json({
            tahunAjaran,
            config,
            events,
            holidays: Array.from(holidaySet),
            availableYears,
        })
    } catch (error) {
        console.error("Error fetching kalender:", error)
        return NextResponse.json({ error: "Gagal memuat kalender akademik" }, { status: 500 })
    }
}

// POST /api/kalender - Create new event (Admin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const body = await request.json()
        const { tahunAjaran, judul, tanggalMulai, tanggalSelesai, tipe, isLibur, semester, deskripsi } = body

        if (!tahunAjaran || !judul || !tanggalMulai) {
            return NextResponse.json({ error: "tahunAjaran, judul, dan tanggalMulai wajib diisi" }, { status: 400 })
        }

        const startDate = new Date(tanggalMulai)
        const endDate = tanggalSelesai ? new Date(tanggalSelesai) : null

        if (endDate && endDate < startDate) {
            return NextResponse.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" }, { status: 400 })
        }

        const newEvent = await prisma.kalenderEvent.create({
            data: {
                tahunAjaran,
                judul,
                tanggalMulai: startDate,
                tanggalSelesai: endDate,
                tipe: tipe || "event",
                isLibur: isLibur !== undefined ? Boolean(isLibur) : tipe === "holiday",
                semester: semester ? Number(semester) : null,
                deskripsi: deskripsi || null,
            },
        })

        return NextResponse.json(newEvent, { status: 201 })
    } catch (error) {
        console.error("Error creating kalender event:", error)
        return NextResponse.json({ error: "Gagal menambahkan agenda kalender" }, { status: 500 })
    }
}
