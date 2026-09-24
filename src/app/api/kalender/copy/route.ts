import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

        // Fetch source config and events
        const [sourceConfig, sourceEvents] = await Promise.all([
            prisma.kalenderConfig.findUnique({
                where: { tahunAjaran: sourceTahunAjaran },
            }),
            prisma.kalenderEvent.findMany({
                where: { tahunAjaran: sourceTahunAjaran },
            }),
        ])

        if (!sourceConfig && sourceEvents.length === 0) {
            return NextResponse.json(
                { error: `Tidak ada data kalender ditemukan untuk tahun ajaran ${sourceTahunAjaran}` },
                { status: 404 }
            )
        }

        // Helper: shift date by shiftYears
        const shiftDate = (d: Date): Date => {
            const copy = new Date(d)
            copy.setFullYear(copy.getFullYear() + shiftYears)
            return copy
        }

        // Copy config if present
        if (sourceConfig) {
            await prisma.kalenderConfig.upsert({
                where: { tahunAjaran: targetTahunAjaran },
                update: {
                    semester1Mulai: shiftDate(sourceConfig.semester1Mulai),
                    semester1Selesai: shiftDate(sourceConfig.semester1Selesai),
                    semester2Mulai: shiftDate(sourceConfig.semester2Mulai),
                    semester2Selesai: shiftDate(sourceConfig.semester2Selesai),
                },
                create: {
                    tahunAjaran: targetTahunAjaran,
                    semester1Mulai: shiftDate(sourceConfig.semester1Mulai),
                    semester1Selesai: shiftDate(sourceConfig.semester1Selesai),
                    semester2Mulai: shiftDate(sourceConfig.semester2Mulai),
                    semester2Selesai: shiftDate(sourceConfig.semester2Selesai),
                },
            })
        }

        // Copy events
        let copiedCount = 0
        for (const ev of sourceEvents) {
            await prisma.kalenderEvent.create({
                data: {
                    tahunAjaran: targetTahunAjaran,
                    judul: ev.judul,
                    tanggalMulai: shiftDate(ev.tanggalMulai),
                    tanggalSelesai: ev.tanggalSelesai ? shiftDate(ev.tanggalSelesai) : null,
                    tipe: ev.tipe,
                    isLibur: ev.isLibur,
                    semester: ev.semester,
                    deskripsi: ev.deskripsi,
                },
            })
            copiedCount++
        }

        return NextResponse.json({
            success: true,
            message: `Berhasil menyalin kalender dari ${sourceTahunAjaran} ke ${targetTahunAjaran} (${copiedCount} agenda)`,
            copiedCount,
        })
    } catch (error) {
        console.error("Error copying kalender:", error)
        return NextResponse.json({ error: "Gagal menduplikasi kalender akademik" }, { status: 500 })
    }
}
