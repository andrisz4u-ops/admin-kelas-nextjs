// Kalender Pendidikan Kabupaten Purwakarta Tahun Pelajaran 2025/2026
// Berdasarkan Surat Dinas Pendidikan Kabupaten Purwakarta

export const SCHOOL_CALENDAR_2025_2026 = {
    // Tahun Ajaran
    academicYear: "2025/2026",

    // Semester 1: 14 Juli 2025 - 24 Desember 2025
    semester1: {
        start: new Date(2025, 6, 14), // 14 Juli 2025
        end: new Date(2025, 11, 24),  // 24 Desember 2025
    },

    // Semester 2: 12 Januari 2026 - 26 Juni 2026
    semester2: {
        start: new Date(2026, 0, 12), // 12 Januari 2026
        end: new Date(2026, 5, 26),   // 26 Juni 2026
    },

    // Hari Libur Nasional dan Sekolah (format: "YYYY-MM-DD")
    holidays: [
        // === SEMESTER 1 (2025) ===
        // Agustus 2025
        "2025-08-17", // Proklamasi Kemerdekaan RI

        // September 2025
        "2025-09-05", // Maulid Nabi Muhammad SAW 1447 H

        // Desember 2025
        "2025-12-25", // Hari Natal
        "2025-12-26", // Cuti Bersama Hari Natal
        // Libur Semester 1: 29 Des 2025 - 10 Jan 2026
        "2025-12-29", "2025-12-30", "2025-12-31",

        // === SEMESTER 2 (2026) ===
        // Januari 2026
        "2026-01-01", // Tahun Baru Masehi
        "2026-01-02", "2026-01-03", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", // Lanjutan Libur Semester
        "2026-01-16", // Isra Mi'raj

        // Februari 2026
        "2026-02-17", // Tahun Baru Imlek
        // Libur Awal Ramadhan: 20-23 Feb 2026
        "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",

        // Maret 2026
        "2026-03-19", // Hari Raya Nyepi
        // Libur Idul Fitri: 14-28 Maret 2026
        "2026-03-14", "2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18",
        "2026-03-20", "2026-03-21", // Idul Fitri 1448 H
        "2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28",

        // April 2026
        "2026-04-03", // Wafat Isa Al Masih

        // Mei 2026
        "2026-05-01", // Hari Buruh
        "2026-05-14", // Kenaikan Isa Al Masih
        "2026-05-27", // Idul Adha

        // Juni 2026
        "2026-06-01", // Hari Lahir Pancasila
        "2026-06-17", // Tahun Baru Islam
        // Libur Akhir Tahun: 29 Juni - 10 Juli 2026
        "2026-06-29", "2026-06-30",

        // Juli 2026
        "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
    ],

    // Kegiatan non-KBM (siswa tidak masuk biasa tapi bukan libur)
    // Penilaian Sumatif, MPLS, dll
    specialDays: [
        // MPLS SMP: 14-16 Juli 2025
        // MPLS PAUD dan SD: 16 Juli - 1 Agustus 2025
        // Simulasi AN: 21-24 Juli 2025
        // AN SMP: 25-28 Agustus 2025
        // AN SD Tahap I: 22-25 Sep 2025
        // AN SD Tahap II: 29 Sep - 2 Okt 2025
        // Penilaian Sumatif Akhir Semester: 1-14 Desember 2025
        // Penilaian Sumatif Akhir Jenjang: 11-22 Mei 2026
        // Sumatif Akhir Tahun: 8-19 Juni 2026
    ]
}

export const getCalendar = (tahunAjaran: string) => {
    if (tahunAjaran === "2026/2027") return SCHOOL_CALENDAR_2026_2027
    return SCHOOL_CALENDAR_2025_2026
}

// Helper function: Check if a date is a holiday (defaults to 2026/2027 for new system)
export function isHoliday(date: Date, tahunAjaran: string = "2026/2027"): boolean {
    const dateStr = date.toISOString().split('T')[0]
    const calendar = getCalendar(tahunAjaran)
    return calendar.holidays.includes(dateStr)
}

// Helper function: Check if a date is a weekend (Saturday or Sunday)
export function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday = 0, Saturday = 6
}

// Helper function: Check if a date is a school day
export function isSchoolDay(date: Date, tahunAjaran: string = "2026/2027"): boolean {
    return !isWeekend(date) && !isHoliday(date, tahunAjaran)
}

export const SCHOOL_CALENDAR_2026_2027 = {
    academicYear: "2026/2027",
    semester1: {
        start: new Date(2026, 6, 13), // Assuming July 13th start based on MPLS
        end: new Date(2026, 11, 23), // Assuming end before SAS
    },
    semester2: {
        start: new Date(2027, 0, 11), // Assuming Jan 11 start
        end: new Date(2027, 5, 25), // Assuming late June end
    },
    holidays: [
        "2026-07-01", // LAS
        "2026-07-06", // LAS
        "2026-08-17", // LN
        "2026-08-25", // LN
        "2026-08-28", // PHBI
        "2026-12-24", // LN
        "2026-12-25", // PHBI
        "2026-12-28", // LN
        "2027-01-01", // LN
        "2027-01-04", // LN
        "2027-02-07", // LN
        "2027-02-08", // LAR
        "2027-03-08", // LN
        "2027-03-09", // L.IDUL FITRI
        "2027-03-26", // LN
        "2027-05-01", // LN
        "2027-05-06", // LN
        "2027-05-20", // LN
        "2027-06-01", // LN
        "2027-06-28", // LAT
    ],
    specialDays: [
        { date: "2026-07-13", title: "MPLS", type: "event" },
        { date: "2026-07-20", title: "Hari Jadi Purwakarta", type: "event" },
        { date: "2026-08-14", title: "Hari Pramuka", type: "event" },
        { date: "2026-09-07", title: "Hari Udara Bersih", type: "event" },
        { date: "2026-09-18", title: "Hari Bambu Sedunia", type: "event" },
        { date: "2026-09-21", title: "Penilaian Tengah Semester", type: "exam" },
        { date: "2026-10-01", title: "Hari Kesaktian Pancasila", type: "event" },
        { date: "2026-10-28", title: "Hari Sumpah Pemuda", type: "event" },
        { date: "2026-11-10", title: "Hari Pahlawan", type: "event" },
        { date: "2026-11-25", title: "Hari Guru Nasional", type: "event" },
        { date: "2026-12-03", title: "Hari Disabilitas Internasional", type: "event" },
        { date: "2026-12-09", title: "Hari Anti Korupsi", type: "event" },
        { date: "2026-12-14", title: "Sumatif Akhir Semester", type: "exam" },
        { date: "2026-12-21", title: "Penetapan Rapor", type: "event" },
        { date: "2026-12-23", title: "Pembagian Rapor", type: "semester" },
        { date: "2027-02-17", title: "Pesantren Kilat", type: "event" },
        { date: "2027-02-22", title: "Pesantren Kilat", type: "event" },
        { date: "2027-02-29", title: "Pesantren Kilat", type: "event" },
        { date: "2027-03-01", title: "Pesantren Kilat", type: "event" },
        { date: "2027-03-04", title: "Simulasi Ujian", type: "exam" },
        { date: "2027-03-22", title: "Ujian Sekolah", type: "exam" },
        { date: "2027-04-22", title: "Hari Bumi", type: "event" },
        { date: "2027-04-23", title: "Hari Buku Sedunia", type: "event" },
        { date: "2027-04-26", title: "TKA Susulan", type: "exam" },
        { date: "2027-05-10", title: "Sumatif Akhir Jenjang", type: "exam" },
        { date: "2027-05-17", title: "Peringatan Isra Mi'raj", type: "event" },
        { date: "2027-05-24", title: "OSN", type: "exam" },
        { date: "2027-06-05", title: "Hari Lingkungan Hidup", type: "event" },
        { date: "2027-06-07", title: "Sumatif Akhir Tahun", type: "exam" },
    ]
}

// Helper function: Get all school days in a date range
export function getSchoolDays(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
        if (isSchoolDay(current)) {
            days.push(new Date(current))
        }
        current.setDate(current.getDate() + 1)
    }

    return days
}

// Helper function: Get semester date range
export function getSemesterRange(semester: number, year: number, tahunAjaran: string = "2026/2027"): { start: Date; end: Date } {
    const calendar = getCalendar(tahunAjaran)
    if (semester === 1) {
        return calendar.semester1
    } else {
        return calendar.semester2
    }
}

// Helper function: Get month date range
export function getMonthRange(month: number, year: number): { start: Date; end: Date } {
    return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0), // Last day of month
    }
}
