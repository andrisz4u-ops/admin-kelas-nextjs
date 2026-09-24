import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export function hitungTahunAjaranBaru(tahunSekarang: string): string {
    const parts = tahunSekarang.split("/")
    if (parts.length === 2) {
        const awal = parseInt(parts[0], 10)
        const akhir = parseInt(parts[1], 10)
        if (!isNaN(awal) && !isNaN(akhir)) {
            return `${awal + 1}/${akhir + 1}`
        }
    }
    const tahunDepan = new Date().getFullYear() + 1
    return `${tahunDepan}/${tahunDepan + 1}`
}

export const siswaService = {
    // Ambil daftar siswa dengan filter kelas, status, search, dan pagination
    async getSiswaList(params: {
        kelas?: number
        status?: string
        tahunLulus?: string
        search?: string
        page?: number
        limit?: number
    }) {
        const { kelas, status = "aktif", tahunLulus, search, page, limit } = params

        const where: Prisma.SiswaWhereInput = {}
        if (kelas) where.kelas = kelas
        if (status && status !== "all") where.status = status
        if (tahunLulus && tahunLulus !== "all") where.tahunLulus = tahunLulus
        if (search) {
            where.OR = [
                { nama: { contains: search, mode: "insensitive" } },
                { nis: { contains: search, mode: "insensitive" } },
            ]
        }

        // Jika pagination diminta
        if (page && limit) {
            const skip = (page - 1) * limit
            const [total, data] = await Promise.all([
                prisma.siswa.count({ where }),
                prisma.siswa.findMany({
                    where,
                    orderBy: { nama: "asc" },
                    skip,
                    take: limit,
                }),
            ])

            return {
                data,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        }

        // Default query tanpa pagination
        return prisma.siswa.findMany({
            where,
            orderBy: { nama: "asc" },
        })
    },

    // Buat siswa baru
    async createSiswa(data: {
        nis: string
        nama: string
        jenisKelamin?: string
        kelas?: number
        alamat?: string | null
        namaOrtu?: string | null
        noHp?: string | null
    }) {
        const cleanNis = String(data.nis).trim()
        const existing = await prisma.siswa.findUnique({ where: { nis: cleanNis } })
        if (existing) {
            throw new Error("NIS sudah terdaftar")
        }

        return prisma.siswa.create({
            data: {
                nis: cleanNis,
                nama: String(data.nama).trim(),
                jenisKelamin: String(data.jenisKelamin || "L").toUpperCase(),
                kelas: data.kelas || 1,
                alamat: data.alamat || null,
                namaOrtu: data.namaOrtu || null,
                noHp: data.noHp || null,
                status: "aktif",
            },
        })
    },

    // Hapus siswa by ID
    async deleteSiswa(id: string) {
        return prisma.siswa.delete({ where: { id } })
    },

    // Ambil siswa by ID
    async getSiswaById(id: string) {
        return prisma.siswa.findUnique({
            where: { id },
            include: {
                riwayatKelas: {
                    orderBy: { tahunAjaran: "desc" },
                },
            },
        })
    },

    // Update data siswa
    async updateSiswa(
        id: string,
        data: {
            nama?: string
            jenisKelamin?: string
            alamat?: string | null
            namaOrtu?: string | null
            noHp?: string | null
            nis?: string
        },
        userRole: string,
        userKelas?: number | null
    ) {
        const existingStudent = await prisma.siswa.findUnique({ where: { id } })
        if (!existingStudent) {
            throw new Error("Siswa tidak ditemukan")
        }

        if (userRole !== "admin") {
            const isOwnStudent = userRole === "guru" && userKelas && existingStudent.kelas === userKelas
            if (!isOwnStudent) {
                throw new Error("Akses ditolak. Anda hanya berhak mengedit data siswa di kelas yang Anda ampu.")
            }
        }

        const updateData: Prisma.SiswaUpdateInput = {
            nama: data.nama !== undefined ? String(data.nama).trim() : existingStudent.nama,
            jenisKelamin: data.jenisKelamin !== undefined ? String(data.jenisKelamin).toUpperCase() : existingStudent.jenisKelamin,
            alamat: data.alamat !== undefined ? data.alamat : existingStudent.alamat,
            namaOrtu: data.namaOrtu !== undefined ? data.namaOrtu : existingStudent.namaOrtu,
            noHp: data.noHp !== undefined ? data.noHp : existingStudent.noHp,
        }

        if (userRole === "admin" && data.nis) {
            const cleanNis = String(data.nis).trim()
            if (cleanNis !== existingStudent.nis) {
                const duplicateNis = await prisma.siswa.findUnique({ where: { nis: cleanNis } })
                if (duplicateNis) {
                    throw new Error("NIS sudah digunakan oleh siswa lain")
                }
                updateData.nis = cleanNis
            }
        }

        return prisma.siswa.update({
            where: { id },
            data: updateData,
        })
    },

    // Proses Kenaikan Kelas & Riwayat Kelas Snapshot
    async prosesKenaikanKelas(tahunAjaranBaru: string, userId?: string) {
        const settings = await prisma.schoolSettings.findFirst()
        const tahunAjaranSekarang = settings?.tahunAjaran || "2025/2026"

        return prisma.$transaction(async (tx) => {
            const countsBefore = await tx.siswa.groupBy({
                by: ["kelas"],
                where: { status: "aktif" },
                _count: { id: true },
                orderBy: { kelas: "asc" },
            })
            const perKelasBefore: Record<number, number> = {}
            for (const c of countsBefore) {
                perKelasBefore[c.kelas] = c._count.id
            }

            // 1. Snapshot RiwayatKelas sebelum kenaikan
            const currentActiveStudents = await tx.siswa.findMany({
                where: { status: "aktif" },
                select: { id: true, kelas: true },
            })
            for (const s of currentActiveStudents) {
                await tx.riwayatKelas.upsert({
                    where: {
                        siswaId_tahunAjaran: {
                            siswaId: s.id,
                            tahunAjaran: tahunAjaranSekarang,
                        },
                    },
                    update: {
                        kelas: s.kelas,
                        status: s.kelas === 6 ? "alumni" : "aktif",
                    },
                    create: {
                        siswaId: s.id,
                        tahunAjaran: tahunAjaranSekarang,
                        kelas: s.kelas,
                        status: s.kelas === 6 ? "alumni" : "aktif",
                    },
                })
            }

            // 2. Arsipkan siswa kelas 6 menjadi alumni
            const alumni = await tx.siswa.updateMany({
                where: { kelas: 6, status: "aktif" },
                data: {
                    status: "alumni",
                    kelas: 0,
                    tahunLulus: tahunAjaranSekarang,
                },
            })

            // 3. Naikkan kelas 5 -> 6, 4 -> 5, 3 -> 4, 2 -> 3, 1 -> 2
            await tx.siswa.updateMany({ where: { kelas: 5, status: "aktif" }, data: { kelas: 6 } })
            await tx.siswa.updateMany({ where: { kelas: 4, status: "aktif" }, data: { kelas: 5 } })
            await tx.siswa.updateMany({ where: { kelas: 3, status: "aktif" }, data: { kelas: 4 } })
            await tx.siswa.updateMany({ where: { kelas: 2, status: "aktif" }, data: { kelas: 3 } })
            await tx.siswa.updateMany({ where: { kelas: 1, status: "aktif" }, data: { kelas: 2 } })

            // 4. Catat RiwayatKelas untuk tahun ajaran baru
            const newlyPromotedStudents = await tx.siswa.findMany({
                where: { status: "aktif" },
                select: { id: true, kelas: true },
            })
            for (const s of newlyPromotedStudents) {
                await tx.riwayatKelas.upsert({
                    where: {
                        siswaId_tahunAjaran: {
                            siswaId: s.id,
                            tahunAjaran: tahunAjaranBaru,
                        },
                    },
                    update: { kelas: s.kelas, status: "aktif" },
                    create: {
                        siswaId: s.id,
                        tahunAjaran: tahunAjaranBaru,
                        kelas: s.kelas,
                        status: "aktif",
                    },
                })
            }

            // 5. Update tahun ajaran di master setting
            await tx.schoolSettings.upsert({
                where: { id: "main" },
                update: { tahunAjaran: tahunAjaranBaru },
                create: { id: "main", tahunAjaran: tahunAjaranBaru },
            })

            // 6. Catat ActivityLog
            if (userId) {
                await tx.activityLog.create({
                    data: {
                        userId,
                        action: "KENAIKAN_KELAS",
                        details: `Proses kenaikan kelas ${tahunAjaranSekarang} → ${tahunAjaranBaru}. ${alumni.count} siswa diarsipkan ke alumni.`,
                        metadata: JSON.stringify({ perKelasBefore, tahunAjaranSekarang, tahunAjaranBaru }),
                    },
                })
            }

            return {
                alumni: alumni.count,
                perKelasBefore,
                tahunAjaranSebelumnya: tahunAjaranSekarang,
                tahunAjaranBaru,
            }
        })
    },
}
