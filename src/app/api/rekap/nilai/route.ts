import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getMapelByKelas } from "@/lib/mapelConfig"

export const dynamic = 'force-dynamic'

const jenisNilaiList = ["UH1", "UH2", "UH3", "UTS", "UAS"]

// GET rekap nilai
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const semester = parseInt(searchParams.get("semester") || "1")
        const mapel = searchParams.get("mapel") || "" // Optional: specific mapel
        const tahunAjaranParam = searchParams.get("tahunAjaran")

        // Ambil tahun ajaran aktif dari master setting jika tidak diberikan
        let tahunAjaran = tahunAjaranParam
        if (!tahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            tahunAjaran = settings?.tahunAjaran || "2025/2026"
        }

        // Get all active students in the class
        const students = await prisma.siswa.findMany({
            where: { kelas, status: "aktif" },
            orderBy: { nama: "asc" },
            select: { id: true, nis: true, nama: true },
        })

        // Get all nilai for active students in the class filtered by semester, kelas, and tahunAjaran
        const whereClause: any = {
            siswa: { kelas, status: "aktif" },
            kelas,
            tahunAjaran,
            semester,
        }
        if (mapel) {
            whereClause.mapel = mapel
        }

        const nilai = await prisma.nilai.findMany({
            where: whereClause,
            select: {
                siswaId: true,
                mapel: true,
                jenisNilai: true,
                nilai: true,
            },
        })

        // Build recap data per student
        const recap = students.map((student) => {
            const studentNilai = nilai.filter((n) => n.siswaId === student.id)

            // Group by mapel
            const nilaiByMapel: { [mapel: string]: { [jenis: string]: number } } = {}

            studentNilai.forEach((n) => {
                if (!nilaiByMapel[n.mapel]) {
                    nilaiByMapel[n.mapel] = {}
                }
                nilaiByMapel[n.mapel][n.jenisNilai] = n.nilai
            })

            // Calculate averages per mapel
            const mapelAverages: { [mapel: string]: number } = {}
            Object.keys(nilaiByMapel).forEach((m) => {
                const vals = Object.values(nilaiByMapel[m])
                if (vals.length > 0) {
                    mapelAverages[m] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                }
            })

            // Overall average
            const allVals = Object.values(mapelAverages)
            const overallAverage = allVals.length > 0
                ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length)
                : 0

            return {
                id: student.id,
                nis: student.nis,
                nama: student.nama,
                nilaiByMapel,
                mapelAverages,
                overallAverage,
            }
        })

        // Get mapel list for this class
        const mapelList = getMapelByKelas(kelas)

        return NextResponse.json({
            recap,
            meta: {
                kelas,
                semester,
                tahunAjaran,
                mapelList,
                jenisNilaiList,
                selectedMapel: mapel || "all",
            },
        })
    } catch (error) {
        console.error("Error fetching rekap nilai:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
