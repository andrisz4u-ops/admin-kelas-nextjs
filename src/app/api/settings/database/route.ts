import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET database statistics and info
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get counts for all tables
        const [
            siswaCount,
            absensiCount,
            nilaiCount,
            jurnalCount,
            bukuCount,
            asetCount,
            userCount
        ] = await Promise.all([
            prisma.siswa.count(),
            prisma.absensi.count(),
            prisma.nilai.count(),
            prisma.jurnal.count(),
            prisma.buku.count(),
            prisma.aset.count(),
            prisma.user.count()
        ])

        // Get date ranges
        const oldestAbsensi = await prisma.absensi.findFirst({
            orderBy: { tanggal: 'asc' },
            select: { tanggal: true }
        })

        const newestAbsensi = await prisma.absensi.findFirst({
            orderBy: { tanggal: 'desc' },
            select: { tanggal: true }
        })

        return NextResponse.json({
            counts: {
                siswa: siswaCount,
                absensi: absensiCount,
                nilai: nilaiCount,
                jurnal: jurnalCount,
                buku: bukuCount,
                aset: asetCount,
                user: userCount
            },
            dateRanges: {
                absensi: {
                    oldest: oldestAbsensi?.tanggal || null,
                    newest: newestAbsensi?.tanggal || null
                }
            }
        })
    } catch (error) {
        console.error("Error fetching database info:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST - Perform database maintenance operations
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { action, options } = await request.json()

        switch (action) {
            case "reset-absensi": {
                // Reset all attendance data
                const deleted = await prisma.absensi.deleteMany({})
                return NextResponse.json({
                    success: true,
                    message: `${deleted.count} data absensi berhasil dihapus`
                })
            }

            case "reset-absensi-year": {
                // Reset attendance for specific year
                const year = options?.year
                if (!year) {
                    return NextResponse.json({ error: "Tahun harus diisi" }, { status: 400 })
                }

                const startDate = new Date(`${year}-01-01`)
                const endDate = new Date(`${year}-12-31`)

                const deleted = await prisma.absensi.deleteMany({
                    where: {
                        tanggal: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                })
                return NextResponse.json({
                    success: true,
                    message: `${deleted.count} data absensi tahun ${year} berhasil dihapus`
                })
            }

            case "reset-nilai": {
                // Reset all grades
                const deleted = await prisma.nilai.deleteMany({})
                return NextResponse.json({
                    success: true,
                    message: `${deleted.count} data nilai berhasil dihapus`
                })
            }

            case "reset-jurnal": {
                // Reset all journals
                const deleted = await prisma.jurnal.deleteMany({})
                return NextResponse.json({
                    success: true,
                    message: `${deleted.count} data jurnal berhasil dihapus`
                })
            }

            case "export-backup": {
                // Export all data as JSON backup
                const [
                    siswa,
                    absensi,
                    nilai,
                    jurnal,
                    buku,
                    aset,
                    waliKelas,
                    schoolSettings,
                    mapelKelas
                ] = await Promise.all([
                    prisma.siswa.findMany(),
                    prisma.absensi.findMany(),
                    prisma.nilai.findMany(),
                    prisma.jurnal.findMany(),
                    prisma.buku.findMany(),
                    prisma.aset.findMany(),
                    prisma.waliKelas.findMany(),
                    prisma.schoolSettings.findFirst(),
                    prisma.mapelKelas.findMany()
                ])

                const backup = {
                    exportDate: new Date().toISOString(),
                    version: "1.0",
                    data: {
                        siswa,
                        absensi,
                        nilai,
                        jurnal,
                        buku,
                        aset,
                        waliKelas,
                        schoolSettings,
                        mapelKelas
                    }
                }

                return NextResponse.json(backup)
            }

            case "naik-kelas": {
                return NextResponse.json({
                    success: false,
                    error: "Aksi ini telah dinonaktifkan demi keamanan data. Silakan gunakan menu resmi Kenaikan Kelas untuk pengarsipan alumni yang aman."
                }, { status: 400 })
            }

            case "clean-duplicate-users": {
                // Fetch all users except admin
                const users = await prisma.user.findMany({
                    where: { role: { not: "admin" } },
                    orderBy: { createdAt: 'asc' } // Keep older ones by default
                })

                let deletedCount = 0
                const processedIds = new Set<string>()

                for (let i = 0; i < users.length; i++) {
                    const u1 = users[i]
                    if (processedIds.has(u1.id)) continue

                    // Find duplicates by name (case insensitive)
                    const duplicates = users.filter(u =>
                        u.id !== u1.id &&
                        !processedIds.has(u.id) &&
                        u.name.toLowerCase().trim() === u1.name.toLowerCase().trim()
                    )

                    if (duplicates.length > 0) {
                        for (const u2 of duplicates) {
                            let toDelete = null

                            // Case 1: Same NIP -> Delete duplicate (keep u1 as it is older)
                            if (u1.nip && u2.nip && u1.nip === u2.nip) {
                                toDelete = u2
                            }
                            // Case 2: One has NIP, one doesn't -> Delete the one without NIP
                            else if (u1.nip && !u2.nip) {
                                toDelete = u2
                            }
                            else if (!u1.nip && u2.nip) {
                                toDelete = u1 // u1 deleted, u2 kept
                                // Since u1 is deleted, we should mark it and stop processing u1
                            }
                            // Case 3: Both no NIP -> Delete duplicate
                            else if (!u1.nip && !u2.nip) {
                                toDelete = u2
                            }

                            if (toDelete) {
                                await prisma.user.delete({ where: { id: toDelete.id } })
                                processedIds.add(toDelete.id)
                                deletedCount++

                                // Specific logic if we deleted u1
                                if (toDelete.id === u1.id) {
                                    processedIds.add(u1.id)
                                    break // Stop processing u1
                                }
                            }
                        }
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `${deletedCount} akun duplikat berhasil dihapus.`
                })
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 })
        }
    } catch (error) {
        console.error("Error performing database maintenance:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
