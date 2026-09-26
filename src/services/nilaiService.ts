import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getDefaultAcademicYear } from "@/lib/academicYear"

export interface NilaiEntry {
    siswaId: string
    mapel: string
    jenisNilai: string
    nilai: number | string
    kelas?: number
    semester?: number
    tahunAjaran?: string
}

export const nilaiService = {
    // Ambil nilai per kelas, mapel, jenisNilai, semester, dan tahun ajaran
    async getNilai(params: {
        kelas: number
        mapel: string
        jenisNilai: string
        semester: number
        tahunAjaranParam?: string | null
    }) {
        const { kelas, mapel, jenisNilai, semester, tahunAjaranParam } = params

        let tahunAjaran = tahunAjaranParam
        if (!tahunAjaran) {
            const settings = await prisma.schoolSettings.findFirst()
            tahunAjaran = settings?.tahunAjaran || getDefaultAcademicYear()
        }

        return prisma.nilai.findMany({
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
    },

    // Batch upsert nilai beserta pencatatan NilaiAuditLog
    async saveBatchNilai(params: {
        entries: NilaiEntry[]
        targetKelas: number
        semesterFallback: number
        defaultTahunAjaran: string
        userId?: string
    }) {
        const { entries, targetKelas, semesterFallback, defaultTahunAjaran, userId } = params

        // Ambil nilai yang sudah ada di database untuk perbandingan audit log
        const existingNilai = await prisma.nilai.findMany({
            where: {
                OR: entries.map((entry) => ({
                    siswaId: entry.siswaId,
                    kelas: entry.kelas ? parseInt(String(entry.kelas)) : targetKelas,
                    tahunAjaran: entry.tahunAjaran || defaultTahunAjaran,
                    mapel: entry.mapel,
                    jenisNilai: entry.jenisNilai,
                    semester: entry.semester ? parseInt(String(entry.semester)) : semesterFallback,
                })),
            },
        })

        const existingMap = new Map<string, number>()
        existingNilai.forEach((n) => {
            const key = `${n.siswaId}_${n.kelas}_${n.tahunAjaran}_${n.mapel}_${n.jenisNilai}_${n.semester}`
            existingMap.set(key, n.nilai)
        })

        const auditLogsToCreate: {
            userId: string
            siswaId: string
            kelas: number
            tahunAjaran: string
            semester: number
            mapel: string
            jenisNilai: string
            nilaiLama: number | null
            nilaiBaru: number
            action: string
        }[] = []

        const upsertOps = entries.map((entry) => {
            const entryKelas = entry.kelas ? parseInt(String(entry.kelas)) : targetKelas
            const entrySemester = entry.semester ? parseInt(String(entry.semester)) : semesterFallback
            const entryTahunAjaran = entry.tahunAjaran || defaultTahunAjaran
            const numericNilai = Math.max(0, Math.min(100, parseFloat(String(entry.nilai)) || 0))
            const key = `${entry.siswaId}_${entryKelas}_${entryTahunAjaran}_${entry.mapel}_${entry.jenisNilai}_${entrySemester}`
            const oldVal = existingMap.get(key)

            if (userId) {
                if (oldVal === undefined) {
                    auditLogsToCreate.push({
                        userId,
                        siswaId: entry.siswaId,
                        kelas: entryKelas,
                        tahunAjaran: entryTahunAjaran,
                        semester: entrySemester,
                        mapel: entry.mapel,
                        jenisNilai: entry.jenisNilai,
                        nilaiLama: null,
                        nilaiBaru: numericNilai,
                        action: "CREATE",
                    })
                } else if (oldVal !== numericNilai) {
                    auditLogsToCreate.push({
                        userId,
                        siswaId: entry.siswaId,
                        kelas: entryKelas,
                        tahunAjaran: entryTahunAjaran,
                        semester: entrySemester,
                        mapel: entry.mapel,
                        jenisNilai: entry.jenisNilai,
                        nilaiLama: oldVal,
                        nilaiBaru: numericNilai,
                        action: "UPDATE",
                    })
                }
            }

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

        await prisma.$transaction([
            ...upsertOps,
            ...(auditLogsToCreate.length > 0
                ? [prisma.nilaiAuditLog.createMany({ data: auditLogsToCreate })]
                : []),
        ])

        return {
            count: entries.length,
            auditsCreated: auditLogsToCreate.length,
        }
    },

    // Ambil riwayat audit log perubahan nilai
    async getAuditLogs(params: {
        siswaId?: string
        kelas?: number
        tahunAjaran?: string
        mapel?: string
        limit?: number
    }) {
        const { siswaId, kelas, tahunAjaran, mapel, limit = 50 } = params

        const where: Prisma.NilaiAuditLogWhereInput = {}
        if (siswaId) where.siswaId = siswaId
        if (kelas) where.kelas = kelas
        if (tahunAjaran) where.tahunAjaran = tahunAjaran
        if (mapel) where.mapel = mapel

        return prisma.nilaiAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: Math.min(100, limit),
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
    },
}
