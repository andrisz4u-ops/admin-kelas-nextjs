import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { kalenderService } from "@/services/kalenderService"

export const dynamic = "force-dynamic"

// POST /api/kalender/copy - Copy all events from source year to target year (Admin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Hanya admin yang diizinkan." }, { status: 403 })
        }

        const body = await request.json()
        const { sourceTahunAjaran, targetTahunAjaran, shiftYears = 1 } = body

        if (!sourceTahunAjaran || !targetTahunAjaran) {
            return NextResponse.json(
                { error: "sourceTahunAjaran dan targetTahunAjaran wajib diisi" },
                { status: 400 }
            )
        }

        if (sourceTahunAjaran === targetTahunAjaran) {
            return NextResponse.json(
                { error: "Tahun ajaran sumber dan tujuan tidak boleh sama" },
                { status: 400 }
            )
        }

        const result = await kalenderService.copyKalenderToNewYear(
            sourceTahunAjaran,
            targetTahunAjaran,
            shiftYears
        )

        return NextResponse.json({
            success: true,
            message: result.message,
            copiedCount: result.copiedCount,
        })
    } catch (error: any) {
        console.error("Error copying kalender:", error)
        return NextResponse.json(
            { error: error.message || "Gagal menduplikasi kalender akademik" },
            { status: 500 }
        )
    }
}
