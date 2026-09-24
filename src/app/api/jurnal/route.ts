import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseToUTCMidnight } from "@/lib/dateUtils"

export const dynamic = 'force-dynamic'

// Helper: determine tahunAjaran & semester from a date
function determineTahunAjaranSemester(date: Date): { tahunAjaran: string; semester: number } {
    const month = date.getUTCMonth() // 0-indexed
    const year = date.getUTCFullYear()
    if (month >= 6) { // Juli-Desember = Semester 1
        return { tahunAjaran: `${year}/${year + 1}`, semester: 1 }
    } else { // Januari-Juni = Semester 2
        return { tahunAjaran: `${year - 1}/${year}`, semester: 2 }
    }
}

// GET jurnal for a class
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelasParam = searchParams.get("kelas")
        const mapelParam = searchParams.get("mapel")
        const tahunAjaranParam = searchParams.get("tahunAjaran")
        const semesterParam = searchParams.get("semester")

        const whereClause: any = {}
        if (kelasParam && kelasParam !== "ALL") {
            whereClause.kelas = parseInt(kelasParam)
        } else if (!kelasParam) {
            whereClause.kelas = 5
        }
        if (mapelParam) {
            whereClause.mapel = { contains: mapelParam, mode: "insensitive" }
        }

        // Filter by tahunAjaran if provided, otherwise use school settings
        if (tahunAjaranParam) {
            whereClause.tahunAjaran = tahunAjaranParam
        }
        if (semesterParam) {
            whereClause.semester = parseInt(semesterParam)
        }

        const jurnal = await prisma.jurnal.findMany({
            where: whereClause,
            orderBy: { tanggal: "desc" },
        })

        return NextResponse.json(jurnal)
    } catch (error) {
        console.error("Error fetching jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST create jurnal
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = session.user.role

        // Kepsek & Pengawas bersifat Read-Only untuk jurnal
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        // Resolve default tahunAjaran from school settings
        const settings = await prisma.schoolSettings.findFirst()
        const defaultTahunAjaran = settings?.tahunAjaran || "2026/2027"
        const defaultSemester = settings?.semesterAktif || 1

        const body = await request.json()

        // Batch creation support
        if (Array.isArray(body)) {
            const createdList = await prisma.$transaction(
                body.map(item => {
                    const tanggal = parseToUTCMidnight(item.tanggal)
                    const autoDetected = determineTahunAjaranSemester(tanggal)
                    const tahunAjaran = item.tahunAjaran || defaultTahunAjaran || autoDetected.tahunAjaran
                    const semester = item.semester ? parseInt(item.semester) : (defaultSemester || autoDetected.semester)

                    return prisma.jurnal.create({
                        data: {
                            tanggal,
                            jamKe: item.jamKe,
                            mapel: item.mapel,
                            materi: item.materi || "Pembelajaran sesuai modul / silabus",
                            metode: item.metode || "-",
                            catatan: item.catatan || null,
                            siswaAbsen: item.siswaAbsen || null,
                            kategori: item.kategori || "KBM",
                            jmlSakit: item.jmlSakit !== undefined ? Number(item.jmlSakit) : 0,
                            jmlIzin: item.jmlIzin !== undefined ? Number(item.jmlIzin) : 0,
                            jmlAlpha: item.jmlAlpha !== undefined ? Number(item.jmlAlpha) : 0,
                            jmlHadir: item.jmlHadir !== undefined ? Number(item.jmlHadir) : null,
                            jmlTdkHadir: item.jmlTdkHadir !== undefined ? Number(item.jmlTdkHadir) : 0,
                            paraf: item.paraf || null,
                            kelas: parseInt(item.kelas),
                            tahunAjaran,
                            semester,
                        }
                    })
                })
            )
            return NextResponse.json(createdList, { status: 201 })
        }

        const {
            tanggal,
            jamKe,
            mapel,
            materi,
            metode,
            catatan,
            siswaAbsen,
            kelas,
            kategori,
            jmlSakit,
            jmlIzin,
            jmlAlpha,
            jmlHadir,
            jmlTdkHadir,
            paraf,
            tahunAjaran: bodyTahunAjaran,
            semester: bodySemester,
        } = body

        const parsedTanggal = parseToUTCMidnight(tanggal)
        const autoDetected = determineTahunAjaranSemester(parsedTanggal)
        const finalTahunAjaran = bodyTahunAjaran || defaultTahunAjaran || autoDetected.tahunAjaran
        const finalSemester = bodySemester ? parseInt(bodySemester) : (defaultSemester || autoDetected.semester)

        const jurnal = await prisma.jurnal.create({
            data: {
                tanggal: parsedTanggal,
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
                kelas: parseInt(kelas),
                tahunAjaran: finalTahunAjaran,
                semester: finalSemester,
            },
        })

        return NextResponse.json(jurnal, { status: 201 })
    } catch (error) {
        console.error("Error creating jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
