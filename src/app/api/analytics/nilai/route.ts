import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

// GET analytics data for grades
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const siswaId = searchParams.get("siswaId") || null

        // Get all active students in class
        const students = await prisma.siswa.findMany({
            where: { kelas, status: "aktif" },
            orderBy: { nama: "asc" },
            select: { id: true, nis: true, nama: true }
        })

        // Get all grades for active students in the class
        const grades = await prisma.nilai.findMany({
            where: { siswa: { kelas, status: "aktif" } },
            include: { siswa: { select: { id: true, nama: true } } }
        })

        // Get unique subjects
        const subjects = [...new Set(grades.map(g => g.mapel))].sort()
        const gradeTypes = ["UH1", "UH2", "UH3", "UTS", "UAS"]

        // Calculate class statistics per subject
        const subjectStats: Record<string, { avg: number; min: number; max: number; count: number }> = {}
        subjects.forEach(mapel => {
            const subjectGrades = grades.filter(g => g.mapel === mapel).map(g => g.nilai)
            if (subjectGrades.length > 0) {
                subjectStats[mapel] = {
                    avg: Math.round(subjectGrades.reduce((a, b) => a + b, 0) / subjectGrades.length),
                    min: Math.min(...subjectGrades),
                    max: Math.max(...subjectGrades),
                    count: subjectGrades.length
                }
            }
        })

        // Calculate student rankings based on average
        const studentAverages: { id: string; nama: string; avg: number; gradeCount: number }[] = []
        students.forEach(student => {
            const studentGrades = grades.filter(g => g.siswaId === student.id)
            if (studentGrades.length > 0) {
                const avg = studentGrades.reduce((sum, g) => sum + g.nilai, 0) / studentGrades.length
                studentAverages.push({
                    id: student.id,
                    nama: student.nama,
                    avg: Math.round(avg * 10) / 10,
                    gradeCount: studentGrades.length
                })
            }
        })
        studentAverages.sort((a, b) => b.avg - a.avg)

        // Top 5 and Bottom 5 students
        const topStudents = studentAverages.slice(0, 5)
        const bottomStudents = studentAverages.slice(-5).reverse()

        // Grade distribution
        const distribution = {
            excellent: 0,  // >= 90
            good: 0,       // 80-89
            average: 0,    // 70-79
            belowAverage: 0, // 60-69
            poor: 0        // < 60
        }

        grades.forEach(g => {
            if (g.nilai >= 90) distribution.excellent++
            else if (g.nilai >= 80) distribution.good++
            else if (g.nilai >= 70) distribution.average++
            else if (g.nilai >= 60) distribution.belowAverage++
            else distribution.poor++
        })

        // If specific student requested
        let studentDetail = null
        if (siswaId) {
            const student = students.find(s => s.id === siswaId)
            const studentGrades = grades.filter(g => g.siswaId === siswaId)

            // Group by subject
            const bySubject: Record<string, Record<string, number>> = {}
            studentGrades.forEach(g => {
                if (!bySubject[g.mapel]) bySubject[g.mapel] = {}
                bySubject[g.mapel][g.jenisNilai] = g.nilai
            })

            // Calculate subject averages
            const subjectAverages: { mapel: string; avg: number; grades: Record<string, number> }[] = []
            Object.entries(bySubject).forEach(([mapel, gradesByType]) => {
                const values = Object.values(gradesByType)
                subjectAverages.push({
                    mapel,
                    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
                    grades: gradesByType
                })
            })
            subjectAverages.sort((a, b) => a.mapel.localeCompare(b.mapel))

            const rank = studentAverages.findIndex(s => s.id === siswaId) + 1

            studentDetail = {
                ...student,
                rank,
                totalStudents: studentAverages.length,
                overallAvg: studentAverages.find(s => s.id === siswaId)?.avg || 0,
                subjectAverages
            }
        }

        // Overall class average
        const overallClassAvg = grades.length > 0
            ? Math.round(grades.reduce((sum, g) => sum + g.nilai, 0) / grades.length)
            : 0

        return NextResponse.json({
            kelas,
            totalStudents: students.length,
            totalGrades: grades.length,
            overallClassAvg,
            subjects,
            gradeTypes,
            subjectStats,
            topStudents,
            bottomStudents,
            distribution,
            studentDetail,
            students: students.map(s => ({ id: s.id, nama: s.nama }))
        })
    } catch (error) {
        console.error("Error fetching grade analytics:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
