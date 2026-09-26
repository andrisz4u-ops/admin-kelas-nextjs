/**
 * Academic Year Utilities
 * Centralizes all dynamic year calculations so no school year is hardcoded.
 */

export function getDefaultAcademicYear(): string {
    const now = new Date()
    const year = now.getFullYear()
    // Tahun ajaran di Indonesia dimulai bulan Juli (index 6)
    const startYear = now.getMonth() < 6 ? year - 1 : year
    return `${startYear}/${startYear + 1}`
}

export function getAcademicYearOptions(activeYear?: string): string[] {
    const currentYear = new Date().getFullYear()
    const set = new Set<string>()

    // Rentang tahun dinamis: 3 tahun ke belakang sampai 4 tahun ke depan
    for (let y = currentYear - 3; y <= currentYear + 4; y++) {
        set.add(`${y}/${y + 1}`)
    }

    // Pastikan tahun yang sedang aktif selalu ada di dalam list
    if (activeYear && /^\d{4}\/\d{4}$/.test(activeYear.trim())) {
        set.add(activeYear.trim())
    }

    return Array.from(set).sort()
}

export function hitungTahunAjaranBaru(tahunSekarang: string): string {
    const parts = (tahunSekarang || "").split("/")
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
