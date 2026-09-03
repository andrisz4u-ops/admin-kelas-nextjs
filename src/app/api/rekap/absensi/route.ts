import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSchoolDays, getSemesterRange, getMonthRange, getCalendar } from "@/lib/schoolCalendar"

export const dynamic = 'force-dynamic'

// GET rekap absensi
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const type = searchParams.get("type") || "month" // "month" or "semester"
        const month = parseInt(searchParams.get("month") || new Date().getMonth().toString())
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
        const semester = parseInt(searchParams.get("semester") || "2")

        let startDate: Date, endDate: Date

        if (type === "month") {
            const range = getMonthRange(month, year)
            startDate = range.start
            endDate = range.end
        } else {
            // Semester
            // For 2025/2026: Semester 1 starts July 2025, Semester 2 starts Jan 2026
            const range = getSemesterRange(semester, semester === 1 ? year : year - 1)
            startDate = range.start
            endDate = range.end
        }

        // Get all active students in the class
        const students = await prisma.siswa.findMany({
            where: { kelas, status: "aktif" },
            orderBy: { nama: "asc" },
            select: { id: true, nis: true, nama: true },
        })

        // Get all attendance records in the date range for active students
        const absensi = await prisma.absensi.findMany({
            where: {
                siswa: { kelas, status: "aktif" },
                tanggal: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                siswaId: true,
                tanggal: true,
                status: true,
            },
        })

        // Get school days using the calendar (excludes weekends AND holidays)
        const schoolDays = getSchoolDays(startDate, endDate)
        const totalSchoolDays = schoolDays.length

        // Build recap data
        const recap = students.map((student) => {
            const studentAbsensi = absensi.filter((a) => a.siswaId === student.id)
            const counts = { H: 0, S: 0, I: 0, A: 0 }
            const dailyLogs: Record<string, string> = {}

            studentAbsensi.forEach((a) => {
                if (counts[a.status as keyof typeof counts] !== undefined) {
                    counts[a.status as keyof typeof counts]++
                }
                // Use UTC components since DB stores dates as UTC midnight
                const d = a.tanggal
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, '0')
                const day = String(d.getUTCDate()).padStart(2, '0')
                const dateStr = `${y}-${m}-${day}`
                dailyLogs[dateStr] = a.status
            })

            const totalRecorded = counts.H + counts.S + counts.I + counts.A
            const percentage = totalSchoolDays > 0
                ? Math.round((counts.H / totalSchoolDays) * 100)
                : 0

            return {
                id: student.id,
                nis: student.nis,
                nama: student.nama,
                hadir: counts.H,
                sakit: counts.S,
                izin: counts.I,
                alpha: counts.A,
                totalRecorded,
                totalSchoolDays,
                percentage,
                dailyLogs,
            }
        })

        // Fetch school settings to know which calendar to use
        const schoolSettings = await prisma.schoolSettings.findFirst()
        const currentAcademicYear = schoolSettings?.tahunAjaran || "2026/2027"
        const calendar = getCalendar(currentAcademicYear)

        // Get list of holidays in the period for reference
        const holidaysInPeriod = calendar.holidays.filter(h => {
            const hDate = new Date(h)
            if (type === "month") {
                // Exact match for month and year
                return hDate.getFullYear() === year && hDate.getMonth() === month
            } else {
                // For semester, ensure we include the full end date
                // Create a new date for end of day comparison
                const endOfDay = new Date(endDate)
                endOfDay.setHours(23, 59, 59, 999)
                return hDate >= startDate && hDate <= endOfDay
            }
        })

        return NextResponse.json({
            recap,
            meta: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalSchoolDays,
                holidaysInPeriod,
                type,
                month: type === "month" ? month : undefined,
                semester: type === "semester" ? semester : undefined,
                year,
                kelas,
            },
        })
    } catch (error) {
        console.error("Error fetching rekap absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
