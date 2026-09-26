"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { getAcademicYearOptions, getDefaultAcademicYear } from "@/lib/academicYear"

interface KalenderEvent {
    id: string
    tahunAjaran: string
    semester: number | null
    tanggalMulai: string
    tanggalSelesai: string | null
    judul: string
    deskripsi: string | null
    tipe: string
    isLibur: boolean
}

interface KalenderConfig {
    id?: string
    tahunAjaran: string
    semester1Mulai: string
    semester1Selesai: string
    semester2Mulai: string
    semester2Selesai: string
}

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

export default function KalenderAkademikPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"

    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(today.getMonth())
    const [currentYear, setCurrentYear] = useState(today.getFullYear())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [tahunAjaran, setTahunAjaran] = useState(getDefaultAcademicYear())
    const [availableYears, setAvailableYears] = useState<string[]>(getAcademicYearOptions())

    // Data state
    const [config, setConfig] = useState<KalenderConfig | null>(null)
    const [events, setEvents] = useState<KalenderEvent[]>([])
    const [holidays, setHolidays] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    // Modal state for Admin
    const [showEventModal, setShowEventModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState<KalenderEvent | null>(null)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [showCopyModal, setShowCopyModal] = useState(false)
    const [saving, setSaving] = useState(false)

    // Event form state
    const [eventForm, setEventForm] = useState({
        judul: "",
        tipe: "event",
        tanggalMulai: "",
        tanggalSelesai: "",
        isLibur: false,
        semester: 1,
        deskripsi: "",
    })

    // Config form state
    const [configForm, setConfigForm] = useState({
        semester1Mulai: "",
        semester1Selesai: "",
        semester2Mulai: "",
        semester2Selesai: "",
    })

    // Copy form state
    const [copyTargetYear, setCopyTargetYear] = useState("2027/2028")

    // Fetch calendar data
    const fetchCalendar = useCallback(async (year: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/kalender?tahunAjaran=${encodeURIComponent(year)}`)
            if (res.ok) {
                const data = await res.json()
                setConfig(data.config || null)
                setEvents(data.events || [])
                setHolidays(data.holidays || [])
                if (data.availableYears) {
                    setAvailableYears(data.availableYears)
                }
                if (data.config) {
                    setConfigForm({
                        semester1Mulai: data.config.semester1Mulai ? data.config.semester1Mulai.split("T")[0] : "",
                        semester1Selesai: data.config.semester1Selesai ? data.config.semester1Selesai.split("T")[0] : "",
                        semester2Mulai: data.config.semester2Mulai ? data.config.semester2Mulai.split("T")[0] : "",
                        semester2Selesai: data.config.semester2Selesai ? data.config.semester2Selesai.split("T")[0] : "",
                    })
                }
            } else {
                toast.error("Gagal memuat kalender akademik")
            }
        } catch (error) {
            console.error("Fetch calendar error:", error)
            toast.error("Terjadi kesalahan saat memuat kalender")
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load: fetch school setting then calendar
    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                const activeYear = data?.tahunAjaran || "2026/2027"
                setTahunAjaran(activeYear)
                fetchCalendar(activeYear)
            })
            .catch(() => {
                fetchCalendar(tahunAjaran)
            })
    }, [fetchCalendar])

    // Change year
    const handleYearChange = (newYear: string) => {
        setTahunAjaran(newYear)
        fetchCalendar(newYear)
    }

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

    const isToday = (day: number, month: number, year: number) => {
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    }

    // Get events for a specific date (single or within range)
    const getEventsForDate = (dateStr: string) => {
        const targetDate = new Date(dateStr)
        return events.filter(e => {
            const start = new Date(e.tanggalMulai.split("T")[0])
            const end = e.tanggalSelesai ? new Date(e.tanggalSelesai.split("T")[0]) : start
            return targetDate >= start && targetDate <= end
        })
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

    // Open Modal Add Event
    const handleOpenAddEvent = (presetDate?: string) => {
        const date = presetDate || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
        setEditingEvent(null)
        setEventForm({
            judul: "",
            tipe: "event",
            tanggalMulai: date,
            tanggalSelesai: "",
            isLibur: false,
            semester: currentMonth >= 6 ? 1 : 2,
            deskripsi: "",
        })
        setShowEventModal(true)
    }

    // Open Modal Edit Event
    const handleOpenEditEvent = (ev: KalenderEvent) => {
        setEditingEvent(ev)
        setEventForm({
            judul: ev.judul,
            tipe: ev.tipe,
            tanggalMulai: ev.tanggalMulai ? ev.tanggalMulai.split("T")[0] : "",
            tanggalSelesai: ev.tanggalSelesai ? ev.tanggalSelesai.split("T")[0] : "",
            isLibur: ev.isLibur,
            semester: ev.semester || 1,
            deskripsi: ev.deskripsi || "",
        })
        setShowEventModal(true)
    }

    // Save Event (Create or Update)
    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!eventForm.judul || !eventForm.tanggalMulai) {
            toast.error("Judul dan tanggal mulai wajib diisi")
            return
        }

        setSaving(true)
        try {
            const url = editingEvent ? `/api/kalender/event/${editingEvent.id}` : "/api/kalender"
            const method = editingEvent ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...eventForm,
                    tahunAjaran,
                }),
            })

            if (res.ok) {
                toast.success(editingEvent ? "Agenda berhasil diperbarui" : "Agenda berhasil ditambahkan")
                setShowEventModal(false)
                fetchCalendar(tahunAjaran)
            } else {
                const err = await res.json()
                toast.error(err.error || "Gagal menyimpan agenda")
            }
        } catch (error) {
            console.error("Save event error:", error)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setSaving(false)
        }
    }

    // Delete Event
    const handleDeleteEvent = async (id: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus agenda ini?")) return

        try {
            const res = await fetch(`/api/kalender/event/${id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("Agenda berhasil dihapus")
                fetchCalendar(tahunAjaran)
            } else {
                toast.error("Gagal menghapus agenda")
            }
        } catch (error) {
            console.error("Delete event error:", error)
            toast.error("Terjadi kesalahan sistem")
        }
    }

    // Save Config (Semester range)
    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch("/api/kalender/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tahunAjaran,
                    ...configForm,
                }),
            })

            if (res.ok) {
                toast.success("Konfigurasi semester berhasil disimpan")
                setShowConfigModal(false)
                fetchCalendar(tahunAjaran)
            } else {
                const err = await res.json()
                toast.error(err.error || "Gagal menyimpan konfigurasi semester")
            }
        } catch (error) {
            console.error("Save config error:", error)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setSaving(false)
        }
    }

    // Copy Calendar to New Year
    const handleCopyCalendar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!copyTargetYear) return

        setSaving(true)
        try {
            const res = await fetch("/api/kalender/copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceTahunAjaran: tahunAjaran,
                    targetTahunAjaran: copyTargetYear,
                    shiftYears: 1,
                }),
            })

            if (res.ok) {
                const result = await res.json()
                toast.success(result.message || "Kalender berhasil disalin")
                setShowCopyModal(false)
                setTahunAjaran(copyTargetYear)
                fetchCalendar(copyTargetYear)
            } else {
                const err = await res.json()
                toast.error(err.error || "Gagal menyalin kalender")
            }
        } catch (error) {
            console.error("Copy calendar error:", error)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setSaving(false)
        }
    }

    // Render calendar grid
    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentMonth, currentYear)
        const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
        const days = []

        // Empty cells before day 1
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-14 sm:h-20 bg-[var(--accents-1)]/40" />)
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const holiday = isHoliday(dateStr)
            const weekend = isWeekend(day, currentMonth, currentYear)
            const todayCheck = isToday(day, currentMonth, currentYear)
            const dayEvents = getEventsForDate(dateStr)
            const hasEvent = dayEvents.length > 0

            days.push(
                <div
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-14 sm:h-20 p-1.5 border border-[var(--border)] cursor-pointer transition-all hover:bg-[var(--accents-1)] relative flex flex-col justify-between ${
                        todayCheck ? "ring-2 ring-blue-500 bg-blue-50/50" : ""
                    } ${holiday || weekend ? "bg-red-50/60" : "bg-white"} ${
                        selectedDate === dateStr ? "ring-2 ring-black" : ""
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${
                            todayCheck ? "text-blue-600 font-bold" :
                            holiday || weekend ? "text-red-500" : "text-[var(--foreground)]"
                        }`}>
                            {day}
                        </span>
                        {isAdmin && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenAddEvent(dateStr)
                                }}
                                title="Tambah agenda pada tanggal ini"
                                className="opacity-0 hover:opacity-100 sm:group-hover:opacity-100 text-xs text-blue-600 hover:text-blue-800 p-0.5 rounded"
                            >
                                +
                            </button>
                        )}
                    </div>

                    {hasEvent && (
                        <div className="flex gap-1 flex-wrap mt-auto">
                            {dayEvents.slice(0, 3).map((e) => (
                                <div
                                    key={e.id}
                                    title={e.judul}
                                    className={`w-2 h-2 rounded-full ${
                                        e.tipe === 'holiday' ? 'bg-red-500' :
                                        e.tipe === 'exam' ? 'bg-amber-500' :
                                        e.tipe === 'semester' ? 'bg-emerald-500' :
                                        'bg-blue-500'
                                    }`}
                                />
                            ))}
                            {dayEvents.length > 3 && (
                                <span className="text-[9px] text-[var(--accents-5)] font-bold">
                                    +{dayEvents.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )
        }

        return days
    }

    const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []
    const selectedDateObj = selectedDate ? new Date(selectedDate) : null

    // Upcoming events from today
    const upcomingEvents = events
        .filter(ev => {
            const start = new Date(ev.tanggalMulai.split("T")[0])
            return start >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
        })
        .slice(0, 6)

    return (
        <div className="space-y-6">
            {/* Header & Control Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                        Kalender Akademik 📅
                    </h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        Sistem Kalender Pendidikan Dinamis SDN 2 Nangerang
                    </p>
                </div>

                {/* Right controls: Academic Year selector & Admin Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-[var(--accents-1)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                        <label className="text-xs font-semibold text-[var(--accents-5)]">Tahun Ajaran:</label>
                        <select
                            value={tahunAjaran}
                            onChange={(e) => handleYearChange(e.target.value)}
                            className="bg-transparent text-sm font-bold text-[var(--foreground)] outline-none cursor-pointer"
                        >
                            {availableYears.map((yr) => (
                                <option key={yr} value={yr} className="bg-white text-black">
                                    {yr}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => handleOpenAddEvent()}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Tambah Agenda
                            </button>

                            <button
                                onClick={() => setShowConfigModal(true)}
                                className="px-3 py-2 bg-[var(--accents-2)] hover:bg-[var(--accents-3)] text-[var(--foreground)] text-xs font-semibold rounded-lg border border-[var(--border)] transition-colors flex items-center gap-1.5"
                                title="Atur tanggal mulai dan selesai semester"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Rentang Semester
                            </button>

                            <button
                                onClick={() => setShowCopyModal(true)}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                                title="Salin kalender ke tahun ajaran baru"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Salin ke Tahun Baru
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-16 turbo-card">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-sm text-[var(--accents-5)]">Memuat kalender akademik...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar Grid */}
                    <div className="lg:col-span-2">
                        <div className="turbo-card overflow-hidden shadow-sm">
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
                                    <div
                                        key={day}
                                        className={`p-2 text-center text-xs font-semibold ${
                                            i === 0 || i === 6 ? "text-red-500 bg-red-50/50" : "text-[var(--accents-5)] bg-[var(--accents-1)]"
                                        }`}
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7">
                                {renderCalendar()}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Details */}
                    <div className="space-y-4">
                        {/* Legend */}
                        <div className="turbo-card p-4">
                            <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm">Keterangan Warna</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span className="text-[var(--accents-5)]">Hari Libur</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                                    <span className="text-[var(--accents-5)]">Ujian/PTS/SAS</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                    <span className="text-[var(--accents-5)]">Awal/Rapor</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-[var(--accents-5)]">Kegiatan Sekolah</span>
                                </div>
                            </div>
                        </div>

                        {/* Semester Range Summary Card */}
                        {config && (
                            <div className="turbo-card p-4 border-l-4 border-l-blue-500">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-sm text-[var(--foreground)]">Rentang Semester Aktif</h3>
                                    {isAdmin && (
                                        <button
                                            onClick={() => setShowConfigModal(true)}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            Ubah
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1.5 text-xs text-[var(--accents-5)]">
                                    <div>
                                        <span className="font-medium text-[var(--foreground)]">Semester 1: </span>
                                        {new Date(config.semester1Mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} s/d{" "}
                                        {new Date(config.semester1Selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                    <div>
                                        <span className="font-medium text-[var(--foreground)]">Semester 2: </span>
                                        {new Date(config.semester2Mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} s/d{" "}
                                        {new Date(config.semester2Selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Selected Date Events */}
                        {selectedDate && (
                            <div className="turbo-card p-4 border border-[var(--border)]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                                        {selectedDateObj?.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                    </h3>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleOpenAddEvent(selectedDate)}
                                            className="text-xs text-blue-600 hover:underline font-semibold"
                                        >
                                            + Tambah
                                        </button>
                                    )}
                                </div>

                                {selectedEvents.length > 0 ? (
                                    <div className="space-y-2.5">
                                        {selectedEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className={`p-3 rounded-lg text-xs border relative group ${
                                                    event.tipe === 'holiday' ? 'bg-red-50 text-red-800 border-red-200' :
                                                    event.tipe === 'exam' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                                    event.tipe === 'semester' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                                    'bg-blue-50 text-blue-800 border-blue-200'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-bold text-sm">{event.judul}</p>
                                                        {event.deskripsi && (
                                                            <p className="text-[11px] opacity-80 mt-0.5">{event.deskripsi}</p>
                                                        )}
                                                        {event.tanggalSelesai && (
                                                            <p className="text-[10px] mt-1 font-semibold">
                                                                Rentang: {new Date(event.tanggalMulai).toLocaleDateString("id-ID")} - {new Date(event.tanggalSelesai).toLocaleDateString("id-ID")}
                                                            </p>
                                                        )}
                                                        {event.isLibur && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-200 text-red-800 rounded">
                                                                Libur KBM
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                                            <button
                                                                onClick={() => handleOpenEditEvent(event)}
                                                                className="p-1 hover:bg-black/10 rounded"
                                                                title="Edit"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEvent(event.id)}
                                                                className="p-1 hover:bg-red-200 rounded"
                                                                title="Hapus"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-[var(--accents-5)] italic">
                                        {isHoliday(selectedDate) ? "Hari Libur" : "Tidak ada agenda kegiatan khusus pada tanggal ini."}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Upcoming Events */}
                        <div className="turbo-card p-4">
                            <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm">
                                Agenda Mendatang ({tahunAjaran})
                            </h3>
                            {upcomingEvents.length > 0 ? (
                                <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                                    {upcomingEvents.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className={`p-2.5 border-l-2 pl-3 rounded-r bg-[var(--accents-1)] ${
                                                ev.tipe === 'holiday' ? 'border-red-500' :
                                                ev.tipe === 'exam' ? 'border-amber-500' :
                                                ev.tipe === 'semester' ? 'border-emerald-500' :
                                                'border-blue-500'
                                            }`}
                                        >
                                            <p className="font-bold text-[var(--foreground)]">{ev.judul}</p>
                                            <p className="text-[11px] text-[var(--accents-5)] mt-0.5">
                                                {new Date(ev.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                                {ev.tanggalSelesai && ` s/d ${new Date(ev.tanggalSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--accents-5)]">Tidak ada agenda mendatang tersisa.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Tambah / Edit Event */}
            {showEventModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingEvent ? "Edit Agenda Kalender" : "Tambah Agenda Kalender"}
                            </h3>
                            <button
                                onClick={() => setShowEventModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Judul Agenda *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={eventForm.judul}
                                    onChange={(e) => setEventForm({ ...eventForm, judul: e.target.value })}
                                    placeholder="Contoh: Penilaian Tengah Semester / Upacara"
                                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Kategori
                                    </label>
                                    <select
                                        value={eventForm.tipe}
                                        onChange={(e) => setEventForm({
                                            ...eventForm,
                                            tipe: e.target.value,
                                            isLibur: e.target.value === "holiday" ? true : eventForm.isLibur
                                        })}
                                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="event">Kegiatan Sekolah</option>
                                        <option value="holiday">Hari Libur</option>
                                        <option value="exam">Ujian / Penilaian</option>
                                        <option value="semester">Awal / Rapor Semester</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Semester
                                    </label>
                                    <select
                                        value={eventForm.semester}
                                        onChange={(e) => setEventForm({ ...eventForm, semester: Number(e.target.value) })}
                                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value={1}>Semester 1 (Ganjil)</option>
                                        <option value={2}>Semester 2 (Genap)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Tanggal Mulai *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={eventForm.tanggalMulai}
                                        onChange={(e) => setEventForm({ ...eventForm, tanggalMulai: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Tanggal Selesai (Opsional)
                                    </label>
                                    <input
                                        type="date"
                                        value={eventForm.tanggalSelesai}
                                        onChange={(e) => setEventForm({ ...eventForm, tanggalSelesai: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isLiburCheckbox"
                                    checked={eventForm.isLibur}
                                    onChange={(e) => setEventForm({ ...eventForm, isLibur: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="isLiburCheckbox" className="text-xs font-semibold text-gray-800 cursor-pointer">
                                    Libur KBM (Siswa tidak belajar efektif)
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Keterangan / Catatan
                                </label>
                                <textarea
                                    rows={2}
                                    value={eventForm.deskripsi}
                                    onChange={(e) => setEventForm({ ...eventForm, deskripsi: e.target.value })}
                                    placeholder="Catatan tambahan agenda..."
                                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowEventModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                                >
                                    {saving ? "Menyimpan..." : editingEvent ? "Simpan Perubahan" : "Tambah Agenda"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Rentang Semester */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Rentang Tanggal Semester
                                </h3>
                                <p className="text-xs text-gray-500">Tahun Ajaran: {tahunAjaran}</p>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveConfig} className="space-y-4">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                                <p className="text-xs font-bold text-blue-900">Semester 1 (Ganjil)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-semibold text-gray-600">Tanggal Mulai</label>
                                        <input
                                            type="date"
                                            required
                                            value={configForm.semester1Mulai}
                                            onChange={(e) => setConfigForm({ ...configForm, semester1Mulai: e.target.value })}
                                            className="w-full text-xs px-2.5 py-1.5 border rounded outline-none text-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-gray-600">Tanggal Selesai</label>
                                        <input
                                            type="date"
                                            required
                                            value={configForm.semester1Selesai}
                                            onChange={(e) => setConfigForm({ ...configForm, semester1Selesai: e.target.value })}
                                            className="w-full text-xs px-2.5 py-1.5 border rounded outline-none text-black"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2">
                                <p className="text-xs font-bold text-emerald-900">Semester 2 (Genap)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-semibold text-gray-600">Tanggal Mulai</label>
                                        <input
                                            type="date"
                                            required
                                            value={configForm.semester2Mulai}
                                            onChange={(e) => setConfigForm({ ...configForm, semester2Mulai: e.target.value })}
                                            className="w-full text-xs px-2.5 py-1.5 border rounded outline-none text-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-gray-600">Tanggal Selesai</label>
                                        <input
                                            type="date"
                                            required
                                            value={configForm.semester2Selesai}
                                            onChange={(e) => setConfigForm({ ...configForm, semester2Selesai: e.target.value })}
                                            className="w-full text-xs px-2.5 py-1.5 border rounded outline-none text-black"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowConfigModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                                >
                                    {saving ? "Menyimpan..." : "Simpan Rentang"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Salin ke Tahun Baru */}
            {showCopyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900">
                                Salin Kalender ke Tahun Baru
                            </h3>
                            <button
                                onClick={() => setShowCopyModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCopyCalendar} className="space-y-4">
                            <p className="text-xs text-gray-600 leading-relaxed">
                                Fitur ini akan menduplikasi seluruh agenda, libur, dan rentang semester dari{" "}
                                <span className="font-bold text-black">{tahunAjaran}</span> ke tahun ajaran baru dengan tanggal otomatis dimajukan 1 tahun. Anda tetap dapat mengedit tanggal agenda setelahnya.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Tahun Ajaran Tujuan *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={copyTargetYear}
                                    onChange={(e) => setCopyTargetYear(e.target.value)}
                                    placeholder="Contoh: 2027/2028"
                                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowCopyModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                                >
                                    {saving ? "Menyalin..." : "Salin Semua Agenda"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
