import { prisma } from "@/lib/prisma"

// Helper: format Date to "YYYY-MM-DD"
function formatDateStr(date: Date): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

// Helper: expand date range into array of "YYYY-MM-DD"
function expandDateRange(start: Date, end: Date | null): string[] {
    const dates: string[] = []
    const cur = new Date(start)
    const stop = end ? new Date(end) : new Date(start)

    while (cur <= stop) {
        dates.push(formatDateStr(cur))
        cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
}

export const kalenderService = {
    // Ambil data kalender lengkap untuk tahun ajaran tertentu
    async getKalenderData(tahunAjaranParam?: string) {
        let tahunAjaran = tahunAjaranParam
        if (!tahunAjaran) {
            const schoolSettings = await prisma.schoolSettings.findFirst()
            tahunAjaran = schoolSettings?.tahunAjaran || "2026/2027"
        }

        const [config, events, configsAll, eventsAll] = await Promise.all([
            prisma.kalenderConfig.findUnique({
                where: { tahunAjaran },
            }),
            prisma.kalenderEvent.findMany({
                where: { tahunAjaran },
                orderBy: { tanggalMulai: "asc" },
            }),
            prisma.kalenderConfig.findMany({
                select: { tahunAjaran: true },
            }),
            prisma.kalenderEvent.findMany({
                select: { tahunAjaran: true },
                distinct: ["tahunAjaran"],
            }),
        ])

        const yearSet = new Set<string>()
        configsAll.forEach((c) => yearSet.add(c.tahunAjaran))
        eventsAll.forEach((e) => yearSet.add(e.tahunAjaran))
        yearSet.add("2025/2026")
        yearSet.add("2026/2027")
        if (tahunAjaran) yearSet.add(tahunAjaran)
        const availableYears = Array.from(yearSet).sort()

        const holidaySet = new Set<string>()
        for (const ev of events) {
            if (ev.isLibur || ev.tipe === "holiday") {
                const dates = expandDateRange(ev.tanggalMulai, ev.tanggalSelesai)
                dates.forEach((d) => holidaySet.add(d))
            }
        }

        return {
            tahunAjaran,
            config,
            events,
            holidays: Array.from(holidaySet),
            availableYears,
        }
    },

    // Buat agenda kalender baru
    async createEvent(data: {
        tahunAjaran: string
        judul: string
        tanggalMulai: string | Date
        tanggalSelesai?: string | Date | null
        tipe?: string
        isLibur?: boolean
        semester?: number | null
        deskripsi?: string | null
    }) {
        const startDate = new Date(data.tanggalMulai)
        const endDate = data.tanggalSelesai ? new Date(data.tanggalSelesai) : null

        return prisma.kalenderEvent.create({
            data: {
                tahunAjaran: data.tahunAjaran,
                judul: data.judul,
                tanggalMulai: startDate,
                tanggalSelesai: endDate,
                tipe: data.tipe || "event",
                isLibur: data.isLibur !== undefined ? Boolean(data.isLibur) : data.tipe === "holiday",
                semester: data.semester ? Number(data.semester) : null,
                deskripsi: data.deskripsi || null,
            },
        })
    },

    // Update agenda kalender
    async updateEvent(id: string, data: {
        judul: string
        tanggalMulai: string | Date
        tanggalSelesai?: string | Date | null
        tipe?: string
        isLibur?: boolean
        semester?: number | null
        deskripsi?: string | null
    }) {
        const startDate = new Date(data.tanggalMulai)
        const endDate = data.tanggalSelesai ? new Date(data.tanggalSelesai) : null

        return prisma.kalenderEvent.update({
            where: { id },
            data: {
                judul: data.judul,
                tanggalMulai: startDate,
                tanggalSelesai: endDate,
                tipe: data.tipe || "event",
                isLibur: data.isLibur !== undefined ? Boolean(data.isLibur) : data.tipe === "holiday",
                semester: data.semester ? Number(data.semester) : null,
                deskripsi: data.deskripsi || null,
            },
        })
    },

    // Hapus agenda kalender
    async deleteEvent(id: string) {
        return prisma.kalenderEvent.delete({ where: { id } })
    },

    // Upsert rentang semester per tahun ajaran
    async upsertConfig(data: {
        tahunAjaran: string
        semester1Mulai: string | Date
        semester1Selesai: string | Date
        semester2Mulai: string | Date
        semester2Selesai: string | Date
    }) {
        return prisma.kalenderConfig.upsert({
            where: { tahunAjaran: data.tahunAjaran },
            update: {
                semester1Mulai: new Date(data.semester1Mulai),
                semester1Selesai: new Date(data.semester1Selesai),
                semester2Mulai: new Date(data.semester2Mulai),
                semester2Selesai: new Date(data.semester2Selesai),
            },
            create: {
                tahunAjaran: data.tahunAjaran,
                semester1Mulai: new Date(data.semester1Mulai),
                semester1Selesai: new Date(data.semester1Selesai),
                semester2Mulai: new Date(data.semester2Mulai),
                semester2Selesai: new Date(data.semester2Selesai),
            },
        })
    },

    // Salin seluruh kalender ke tahun ajaran baru (+1 tahun shift)
    async copyKalenderToNewYear(sourceTahunAjaran: string, targetTahunAjaran: string, shiftYears = 1) {
        const [sourceConfig, sourceEvents] = await Promise.all([
            prisma.kalenderConfig.findUnique({ where: { tahunAjaran: sourceTahunAjaran } }),
            prisma.kalenderEvent.findMany({ where: { tahunAjaran: sourceTahunAjaran } }),
        ])

        if (!sourceConfig && sourceEvents.length === 0) {
            throw new Error(`Tidak ada data kalender ditemukan untuk tahun ajaran ${sourceTahunAjaran}`)
        }

        const shiftDate = (d: Date): Date => {
            const copy = new Date(d)
            copy.setFullYear(copy.getFullYear() + shiftYears)
            return copy
        }

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

        return {
            copiedCount,
            message: `Berhasil menyalin kalender dari ${sourceTahunAjaran} ke ${targetTahunAjaran} (${copiedCount} agenda)`,
        }
    },
}
