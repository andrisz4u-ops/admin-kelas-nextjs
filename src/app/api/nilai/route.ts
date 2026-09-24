import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

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
        const tahunAjaranParam = searchParams.get("tahunAjaran")

        if (!mapel || !jenisNilai) {
            return NextResponse.json({ error: "Mapel and jenisNilai required" }, { status: 400 })
        }

        // Ambil tahun ajaran aktif jika tidak dispesifikasikan
        let tahunAjaran = tahunAjaranParam
        if (!tahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            tahunAjaran = settings?.tahunAjaran || "2025/2026"
        }

        const nilai = await prisma.nilai.findMany({
            where: {
                kelas,
                tahunAjaran,
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

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Kepsek & Pengawas bersifat Read-Only untuk nilai
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        const body = await request.json()
        const { entries, semester, kelas: bodyKelas, tahunAjaran: bodyTahunAjaran } = body
        const fallbackSemester = semester ? parseInt(String(semester)) : 1

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: "Entries harus berupa array yang tidak kosong" }, { status: 400 })
        }

        // Ambil pengaturan sekolah untuk tahun ajaran default
        let defaultTahunAjaran = bodyTahunAjaran
        if (!defaultTahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            defaultTahunAjaran = settings?.tahunAjaran || "2025/2026"
        }

        // Tentukan kelas sasaran
        const targetKelas = bodyKelas ? parseInt(String(bodyKelas)) : (entries[0]?.kelas ? parseInt(String(entries[0].kelas)) : (userKelas || 1))

        // Otorisasi BOLA: Guru wali kelas hanya boleh mengubah kelas miliknya
        if (userRole === "guru" && userKelas && targetKelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak mengubah nilai kelas ${targetKelas}.`
            }, { status: 403 })
        }

        // Otorisasi Guru Mapel: hanya boleh mengedit mapel yang diampu
        if (userRole === "guru_mapel" && session.user.mapelDiampu) {
            const allowedMapels = session.user.mapelDiampu.split(",").map((m: string) => m.trim().toLowerCase())
            for (const entry of entries) {
                if (entry.mapel && !allowedMapels.includes(entry.mapel.trim().toLowerCase())) {
                    return NextResponse.json({
                        error: `Akses ditolak. Anda tidak berhak mengampu mata pelajaran '${entry.mapel}'.`
                    }, { status: 403 })
                }
            }
        }

        // Batch upsert menggunakan prisma.$transaction untuk eliminasi N+1 serial round-trips
        await prisma.$transaction(
            entries.map((entry) => {
                const entryKelas = entry.kelas ? parseInt(String(entry.kelas)) : targetKelas
                const entrySemester = entry.semester ? parseInt(String(entry.semester)) : fallbackSemester
                const entryTahunAjaran = entry.tahunAjaran || defaultTahunAjaran
                const numericNilai = Math.max(0, Math.min(100, parseFloat(entry.nilai) || 0))

                return prisma.nilai.upsert({
                    where: {
                        siswaId_kelas_tahunAjaran_mapel_jenisNilai_semester: {
                            siswaId: entry.siswaId,
                            kelas: entryKelas,
                            tahunAjaran: entryTahunAjaran,
                            mapel: entry.mapel,
                            jenisNilai: entry.jenisNilai,
                            semester: entrySemester,
                        },
                    },
                    update: { nilai: numericNilai },
                    create: {
                        siswaId: entry.siswaId,
                        kelas: entryKelas,
                        tahunAjaran: entryTahunAjaran,
                        mapel: entry.mapel,
                        jenisNilai: entry.jenisNilai,
                        semester: entrySemester,
                        nilai: numericNilai,
                    },
                })
            })
        )

        return NextResponse.json({ success: true, message: `${entries.length} nilai berhasil disimpan.` })
    } catch (error) {
        console.error("Error saving nilai:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
