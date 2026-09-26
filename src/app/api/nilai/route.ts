import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { nilaiService } from "@/services/nilaiService"
import { getDefaultAcademicYear } from "@/lib/academicYear"

export const dynamic = "force-dynamic"

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

        const nilai = await nilaiService.getNilai({
            kelas,
            mapel,
            jenisNilai,
            semester,
            tahunAjaranParam,
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

        let defaultTahunAjaran = bodyTahunAjaran
        if (!defaultTahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            defaultTahunAjaran = settings?.tahunAjaran || getDefaultAcademicYear()
        }

        const targetKelas = bodyKelas ? parseInt(String(bodyKelas)) : (entries[0]?.kelas ? parseInt(String(entries[0].kelas)) : (userKelas || 1))

        // Guru wali kelas hanya boleh mengubah kelas miliknya
        if (userRole === "guru" && userKelas && targetKelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak mengubah nilai kelas ${targetKelas}.`
            }, { status: 403 })
        }

        // Guru Mapel: hanya boleh mengedit mapel yang diampu
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

        const result = await nilaiService.saveBatchNilai({
            entries,
            targetKelas,
            semesterFallback: fallbackSemester,
            defaultTahunAjaran,
            userId: session.user?.id,
        })

        return NextResponse.json({
            success: true,
            message: `${result.count} nilai berhasil disimpan.`,
            auditsCreated: result.auditsCreated,
        })
    } catch (error) {
        console.error("Error saving nilai:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
