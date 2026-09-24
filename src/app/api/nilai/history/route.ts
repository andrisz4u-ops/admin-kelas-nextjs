import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { nilaiService } from "@/services/nilaiService"

export const dynamic = "force-dynamic"

// GET /api/nilai/history - Query audit trail of grade changes
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const siswaId = searchParams.get("siswaId") || undefined
        const kelas = searchParams.get("kelas") ? parseInt(searchParams.get("kelas")!) : undefined
        const tahunAjaran = searchParams.get("tahunAjaran") || undefined
        const mapel = searchParams.get("mapel") || undefined
        const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50

        const logs = await nilaiService.getAuditLogs({
            siswaId,
            kelas,
            tahunAjaran,
            mapel,
            limit,
        })

        return NextResponse.json(logs)
    } catch (error) {
        console.error("Error fetching nilai audit logs:", error)
        return NextResponse.json({ error: "Gagal memuat log audit nilai" }, { status: 500 })
    }
}
