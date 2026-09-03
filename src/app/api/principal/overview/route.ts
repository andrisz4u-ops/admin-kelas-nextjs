import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

// GET overview data for principal dashboard
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get today's date range (start to end of day)
        // Force WIB/Local perspective for "Today" calculation
        const now = new Date()
        const wibOffset = 7 * 60 * 60 * 1000
        const wibDate = new Date(now.getTime() + wibOffset)

        const y = wibDate.getUTCFullYear()
        const m = wibDate.getUTCMonth()
        const d = wibDate.getUTCDate()

        const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
        const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999))

        const today = wibDate // Use WIB date as 'today' base for month calculations

        // Get student count per class (only active students)
        const studentsByClass = await prisma.siswa.groupBy({
            by: ['kelas'],
            where: {
                status: 'aktif',
                kelas: { in: [1, 2, 3, 4, 5, 6] }
            },
            _count: { id: true },
            orderBy: { kelas: 'asc' }
        })

        const todayAttendance = await prisma.absensi.findMany({
            where: {
                tanggal: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                siswa: {
                    status: 'aktif',
                    kelas: { in: [1, 2, 3, 4, 5, 6] }
                }
            },
            select: {
                siswaId: true,
                status: true,
                siswa: {
                    select: { kelas: true }
                }
            }
        })

        // Process attendance by class
        const attendanceByClass: Record<number, { H: number; S: number; I: number; A: number; total: number }> = {}
        for (let kelas = 1; kelas <= 6; kelas++) {
            attendanceByClass[kelas] = { H: 0, S: 0, I: 0, A: 0, total: 0 }
        }

        const seenStudents = new Set<string>()

        todayAttendance.forEach(a => {
            const kelas = a.siswa.kelas
            // Robustness: Deduplicate count per student for this day
            if (seenStudents.has(a.siswaId)) return
            seenStudents.add(a.siswaId)

            if (attendanceByClass[kelas]) {
                const status = a.status as 'H' | 'S' | 'I' | 'A'
                if (['H', 'S', 'I', 'A'].includes(status)) {
                    attendanceByClass[kelas][status]++
                    attendanceByClass[kelas].total++
                }
            }
        })

        // Get journal count per class for this month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

        const journalsByClass = await prisma.jurnal.groupBy({
            by: ['kelas'],
            _count: { id: true },
            where: {
                tanggal: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                kelas: { in: [1, 2, 3, 4, 5, 6] }
            }
        })

        // Get grade summary per class
        const gradesByClass = await prisma.nilai.findMany({
            where: {
                siswa: {
                    status: 'aktif',
                    kelas: { in: [1, 2, 3, 4, 5, 6] }
                }
            },
            select: {
                nilai: true,
                siswa: {
                    select: { kelas: true }
                }
            }
        })

        const gradeAverageByClass: Record<number, { total: number; count: number; avg: number }> = {}
        for (let kelas = 1; kelas <= 6; kelas++) {
            gradeAverageByClass[kelas] = { total: 0, count: 0, avg: 0 }
        }

        gradesByClass.forEach(n => {
            const kelas = n.siswa.kelas
            if (gradeAverageByClass[kelas]) {
                gradeAverageByClass[kelas].total += n.nilai
                gradeAverageByClass[kelas].count++
            }
        })

        // Calculate averages
        Object.keys(gradeAverageByClass).forEach(k => {
            const kelas = parseInt(k)
            if (gradeAverageByClass[kelas].count > 0) {
                gradeAverageByClass[kelas].avg = Math.round(
                    gradeAverageByClass[kelas].total / gradeAverageByClass[kelas].count
                )
            }
        })

        // Build summary data
        const classSummary = []
        for (let kelas = 1; kelas <= 6; kelas++) {
            const studentCount = studentsByClass.find(s => s.kelas === kelas)?._count?.id || 0
            const journalCount = journalsByClass.find(j => j.kelas === kelas)?._count?.id || 0

            classSummary.push({
                kelas,
                totalSiswa: studentCount,
                hadir: attendanceByClass[kelas]?.H || 0,
                sakit: attendanceByClass[kelas]?.S || 0,
                izin: attendanceByClass[kelas]?.I || 0,
                alpha: attendanceByClass[kelas]?.A || 0,
                jurnalBulanIni: journalCount,
                rataRataNilai: gradeAverageByClass[kelas]?.avg || 0,
            })
        }

        // Get total overview
        const totalStudents = studentsByClass.reduce((sum, s) => sum + s._count.id, 0)
        const totalHadir = Object.values(attendanceByClass).reduce((sum, a) => sum + a.H, 0)
        const totalTidakHadir = Object.values(attendanceByClass).reduce((sum, a) => sum + a.S + a.I + a.A, 0)
        const totalJurnal = journalsByClass.reduce((sum, j) => sum + j._count.id, 0)

        return NextResponse.json({
            overview: {
                totalStudents,
                totalHadir,
                totalTidakHadir,
                totalJurnal,
                date: today.toISOString(),
            },
            classSummary,
        })
    } catch (error) {
        console.error("Error fetching principal overview:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
