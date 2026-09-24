export interface RekapSiswa {
    id: string
    nis: string
    nama: string
    hadir: number
    sakit: number
    izin: number
    alpha: number
    totalRecorded: number
    totalSchoolDays: number
    percentage: number
    dailyLogs?: Record<string, string>
}

export interface RekapMeta {
    startDate: string
    endDate: string
    totalSchoolDays: number
    holidaysInPeriod?: string[]
    type: string
    month?: number
    semester?: number
    year: number
    kelas: number
}

export const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]
