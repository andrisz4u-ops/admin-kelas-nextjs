"use client"

import { useState, useEffect } from "react"
import { SCHOOL_CALENDAR_2025_2026 } from "@/lib/schoolCalendar"

// Academic events data
const academicEvents: Record<string, { title: string; type: 'holiday' | 'exam' | 'event' | 'semester' }[]> = {
    // July 2025
    "2025-07-14": [{ title: "Hari Pertama Masuk Sekolah", type: "semester" }],
    "2025-07-14,2025-07-16": [{ title: "MPLS SMP", type: "event" }],
    "2025-07-21,2025-07-24": [{ title: "Simulasi AN SMP & SD", type: "exam" }],

    // August 2025
    "2025-08-17": [{ title: "Proklamasi Kemerdekaan RI", type: "holiday" }],
    "2025-08-25,2025-08-28": [{ title: "Pelaksanaan AN SMP", type: "exam" }],

    // September 2025
    "2025-09-05": [{ title: "Maulid Nabi Muhammad SAW", type: "holiday" }],
    "2025-09-22,2025-09-25": [{ title: "AN SD Tahap I", type: "exam" }],
    "2025-09-29,2025-10-02": [{ title: "AN SD Tahap II", type: "exam" }],

    // December 2025
    "2025-12-01,2025-12-14": [{ title: "Penilaian Sumatif Akhir Semester", type: "exam" }],
    "2025-12-19": [{ title: "Penetapan Rapor Semester 1", type: "event" }],
    "2025-12-24": [{ title: "Pembagian Rapor Semester 1", type: "semester" }],
    "2025-12-25": [{ title: "Hari Natal", type: "holiday" }],
    "2025-12-29,2026-01-10": [{ title: "Libur Akhir Semester", type: "holiday" }],

    // January 2026
    "2026-01-01": [{ title: "Tahun Baru Masehi", type: "holiday" }],
    "2026-01-12": [{ title: "Hari Pertama Masuk Semester 2", type: "semester" }],
    "2026-01-16": [{ title: "Isra Mi'raj", type: "holiday" }],

    // February 2026
    "2026-02-17": [{ title: "Tahun Baru Imlek", type: "holiday" }],
    "2026-02-20,2026-02-23": [{ title: "Libur Awal Ramadhan", type: "holiday" }],
    "2026-02-24,2026-03-13": [{ title: "SMARTTREN / Budi Pekerti", type: "event" }],

    // March 2026
    "2026-03-14,2026-03-28": [{ title: "Libur Idul Fitri", type: "holiday" }],
    "2026-03-19": [{ title: "Hari Raya Nyepi", type: "holiday" }],
    "2026-03-20,2026-03-21": [{ title: "Idul Fitri 1448 H", type: "holiday" }],

    // April 2026
    "2026-04-03": [{ title: "Wafat Isa Al Masih", type: "holiday" }],

    // May 2026
    "2026-05-01": [{ title: "Hari Buruh", type: "holiday" }],
    "2026-05-11,2026-05-22": [{ title: "Sumatif Akhir Jenjang SD/SMP", type: "exam" }],
    "2026-05-14": [{ title: "Kenaikan Isa Al Masih", type: "holiday" }],
    "2026-05-27": [{ title: "Idul Adha", type: "holiday" }],

    // June 2026
    "2026-06-01": [{ title: "Hari Lahir Pancasila", type: "holiday" }],
    "2026-06-08,2026-06-19": [{ title: "Sumatif Akhir Tahun/Fase", type: "exam" }],
    "2026-06-17": [{ title: "Tahun Baru Islam", type: "holiday" }],
    "2026-06-24": [{ title: "Penetapan Rapor Semester 2", type: "event" }],
    "2026-06-26": [{ title: "Pembagian Rapor Semester 2", type: "semester" }],
    "2026-06-29,2026-07-10": [{ title: "Libur Akhir Tahun Pelajaran", type: "holiday" }],
}

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

export default function KalenderAkademikPage() {
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(today.getMonth())
    const [currentYear, setCurrentYear] = useState(today.getFullYear())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    const holidays = SCHOOL_CALENDAR_2025_2026.holidays

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay()
    }

    const isHoliday = (dateStr: string) => {
        return holidays.includes(dateStr)
    }

    const isWeekend = (day: number, month: number, year: number) => {
        const date = new Date(year, month, day)
        return date.getDay() === 0 || date.getDay() === 6
    }

    const getEventsForDate = (dateStr: string) => {
        const events: { title: string; type: string }[] = []

        // Check single date events
        if (academicEvents[dateStr]) {
            events.push(...academicEvents[dateStr])
        }

        // Check range events
        Object.keys(academicEvents).forEach(key => {
            if (key.includes(',')) {
                const [start, end] = key.split(',')
                const date = new Date(dateStr)
                const startDate = new Date(start)
                const endDate = new Date(end)
                if (date >= startDate && date <= endDate) {
                    events.push(...academicEvents[key])
                }
            }
        })

        return events
    }

    const isToday = (day: number, month: number, year: number) => {
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    }

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11)
            setCurrentYear(currentYear - 1)
        } else {
            setCurrentMonth(currentMonth - 1)
        }
    }

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0)
            setCurrentYear(currentYear + 1)
        } else {
            setCurrentMonth(currentMonth + 1)
        }
    }

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentMonth, currentYear)
        const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
        const days = []

        // Empty cells for days before the first day
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-12 sm:h-20" />)
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const holiday = isHoliday(dateStr)
            const weekend = isWeekend(day, currentMonth, currentYear)
            const todayCheck = isToday(day, currentMonth, currentYear)
            const events = getEventsForDate(dateStr)
            const hasEvent = events.length > 0

            days.push(
                <div
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-12 sm:h-20 p-1 border border-[var(--border)] cursor-pointer transition-all hover:bg-[var(--accents-1)] relative ${todayCheck ? "ring-2 ring-blue-500 bg-blue-50" : ""
                        } ${holiday || weekend ? "bg-red-50" : "bg-white"} ${selectedDate === dateStr ? "ring-2 ring-black" : ""
                        }`}
                >
                    <span className={`text-sm font-medium ${todayCheck ? "text-blue-600" :
                            holiday || weekend ? "text-red-500" : "text-[var(--foreground)]"
                        }`}>
                        {day}
                    </span>
                    {hasEvent && (
                        <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap">
                            {events.slice(0, 2).map((e, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${e.type === 'holiday' ? 'bg-red-500' :
                                            e.type === 'exam' ? 'bg-amber-500' :
                                                e.type === 'semester' ? 'bg-emerald-500' :
                                                    'bg-blue-500'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )
        }

        return days
    }

    const [tahunAjaran, setTahunAjaran] = useState("2025/2026")

    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.json())
            .then(data => {
                if (data?.tahunAjaran) setTahunAjaran(data.tahunAjaran)
            })
            .catch(() => {})
    }, [])

    const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []
    const selectedDateObj = selectedDate ? new Date(selectedDate) : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    Kalender Akademik 📅
                </h1>
                <p className="text-sm text-[var(--accents-5)] mt-1">
                    Kalender Pendidikan Kab. Purwakarta Tahun Ajaran {tahunAjaran}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2">
                    <div className="turbo-card overflow-hidden">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--accents-1)]">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-[var(--accents-2)] rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h2 className="text-lg font-bold text-[var(--foreground)]">
                                {monthNames[currentMonth]} {currentYear}
                            </h2>
                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-[var(--accents-2)] rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 border-b border-[var(--border)]">
                            {dayNames.map((day, i) => (
                                <div key={day} className={`p-2 text-center text-xs font-semibold ${i === 0 || i === 6 ? "text-red-500 bg-red-50" : "text-[var(--accents-5)] bg-[var(--accents-1)]"
                                    }`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Legend */}
                    <div className="turbo-card p-4">
                        <h3 className="font-semibold text-[var(--foreground)] mb-3">Keterangan</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-[var(--accents-5)]">Libur Nasional/Sekolah</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="text-[var(--accents-5)]">Ujian/Penilaian</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-[var(--accents-5)]">Awal/Akhir Semester</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-[var(--accents-5)]">Kegiatan Sekolah</span>
                            </div>
                        </div>
                    </div>

                    {/* Selected Date Events */}
                    {selectedDate && (
                        <div className="turbo-card p-4">
                            <h3 className="font-semibold text-[var(--foreground)] mb-3">
                                {selectedDateObj?.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </h3>
                            {selectedEvents.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedEvents.map((event, i) => (
                                        <div key={i} className={`p-3 rounded-lg text-sm ${event.type === 'holiday' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                event.type === 'exam' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                    event.type === 'semester' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                            }`}>
                                            {event.title}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[var(--accents-5)]">
                                    {isHoliday(selectedDate) ? "Hari Libur" : "Tidak ada kegiatan khusus"}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Upcoming Events */}
                    <div className="turbo-card p-4">
                        <h3 className="font-semibold text-[var(--foreground)] mb-3">Kegiatan Mendatang</h3>
                        <div className="space-y-2 text-sm max-h-60 overflow-y-auto">
                            {Object.entries(academicEvents)
                                .filter(([key]) => {
                                    const date = new Date(key.split(',')[0])
                                    return date >= today
                                })
                                .slice(0, 5)
                                .map(([key, events]) => (
                                    <div key={key} className="p-2 border-l-2 border-blue-500 pl-3 bg-[var(--accents-1)] rounded-r">
                                        <p className="font-medium text-[var(--foreground)]">{events[0].title}</p>
                                        <p className="text-xs text-[var(--accents-5)]">
                                            {new Date(key.split(',')[0]).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
                                        </p>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
