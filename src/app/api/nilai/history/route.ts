import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET /api/nilai/history - Query audit trail of grade changes
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const siswaId = searchParams.get("siswaId")
        const kelas = searchParams.get("kelas") ? parseInt(searchParams.get("kelas")!) : undefined
        const tahunAjaran = searchParams.get("tahunAjaran") || undefined
        const mapel = searchParams.get("mapel") || undefined
        const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"))

        const where: any = {}
        if (siswaId) where.siswaId = siswaId
        if (kelas) where.kelas = kelas
        if (tahunAjaran) where.tahunAjaran = tahunAjaran
        if (mapel) where.mapel = mapel

        const logs = await prisma.nilaiAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
                siswa: {
                    select: {
                        id: true,
                        nama: true,
                        nis: true,
                    },
                },
            },
        })

        return NextResponse.json(logs)
    } catch (error) {
        console.error("Error fetching nilai audit logs:", error)
        return NextResponse.json({ error: "Gagal memuat log audit nilai" }, { status: 500 })
    }
}
