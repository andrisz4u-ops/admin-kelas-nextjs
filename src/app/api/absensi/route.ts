import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { absensiService } from "@/services/absensiService"

export const dynamic = "force-dynamic"

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

        const absensi = await absensiService.getAbsensiByKelasDanTanggal(kelas, tanggal)
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

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Kepsek & Pengawas bersifat Read-Only untuk absensi harian
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        const body = await request.json()
        const entries = body.entries
        const kelasParam = body.kelas ? parseInt(body.kelas) : null
        const bodyTahunAjaran = body.tahunAjaran
        const bodySemester = body.semester ? parseInt(body.semester) : undefined

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: "Entries harus berupa array yang tidak kosong" }, { status: 400 })
        }

        const targetKelas = kelasParam || userKelas

        // Guru wali kelas hanya boleh mengubah absensi kelasnya sendiri
        if (userRole === "guru" && userKelas && targetKelas && targetKelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak mengubah absensi kelas ${targetKelas}.`
            }, { status: 403 })
        }

        const result = await absensiService.saveBatchAbsensi({
            entries,
            targetKelas: targetKelas || 1,
            bodyTahunAjaran,
            bodySemester,
        })

        return NextResponse.json({ success: true, count: result.count })
    } catch (error) {
        console.error("Error saving absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
