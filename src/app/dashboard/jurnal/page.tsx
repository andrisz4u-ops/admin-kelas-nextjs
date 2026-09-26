"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { getMapelByKelas } from "@/lib/mapelConfig"
import { getWIBDateString } from "@/lib/dateUtils"

interface Jurnal {
    id: string
    tanggal: string
    jamKe: string
    mapel: string
    materi: string
    metode?: string | null
    catatan?: string | null
    siswaAbsen?: string | null
    kategori?: string | null
    jmlSakit?: number | null
    jmlIzin?: number | null
    jmlAlpha?: number | null
    jmlHadir?: number | null
    jmlTdkHadir?: number | null
    paraf?: string | null
    kelas: number
}

interface SchoolSettings {
    namaSekolah: string
    kepalaSekolah: string | null
    nipKepsek: string | null
    tahunAjaran: string
}

interface WaliKelasInfo {
    kelas: number
    nama: string
    nip: string | null
}

interface JadwalPelajaranItem {
    id: string
    kelas: number
    hari: string
    jamKe: number
    waktu: string
    mapel: string
    guru: string | null
}

interface GroupedScheduleSlot {
    jamKeDisplay: string
    waktuDisplay: string
    mapel: string
    guru: string | null
    kategori: "KBM" | "AGENDA"
    jamKeStart: number
    jamKeEnd: number
    kelas?: number
}

const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

const toRoman = (num: number) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI"]
    return roman[num] || String(num)
}

const getKelasWord = (num: number) => {
    const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam"]
    return words[num] || String(num)
}

function getItemYMD(dStr: string): string {
    if (!dStr) return ""
    try {
        const d = new Date(dStr)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
    } catch {
        return dStr.split("T")[0] || ""
    }
}

function getTodayYMD(): string {
    try {
        return getWIBDateString()
    } catch {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
    }
}

function formatDateShort(dateStr: string): string {
    try {
        const d = new Date(dateStr)
        const day = DAY_NAMES_ID[d.getDay()]
        const dateNum = d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        })
        return `${day}, ${dateNum}`
    } catch {
        return dateStr
    }
}

function formatDateFull(dateStr: string): string {
    try {
        const [y, m, d] = dateStr.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        const day = DAY_NAMES_ID[dt.getDay()]
        const formatted = dt.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        })
        return `${day}, ${formatted}`
    } catch {
        return dateStr
    }
}

// Urutan jam pelajaran secara kronologis (pagi 06.25 s.d. jam 8-9)
function parseJamKeOrder(jamKe: string): number {
    if (!jamKe) return 9999
    const str = jamKe.toLowerCase().trim()

    const timeMatch = str.match(/^(\d{1,2})[.:](\d{2})/)
    if (timeMatch) {
        const h = parseInt(timeMatch[1], 10)
        const m = parseInt(timeMatch[2], 10)
        return h * 100 + m
    }

    if (str.includes("literasi") || str.includes("pembiasaan")) return 625
    if (str.includes("upacara") || str.includes("senam")) return 700

    const periodMatch = str.match(/^(\d+)/)
    if (periodMatch) {
        return 1000 + parseInt(periodMatch[1], 10) * 10
    }

    return 9999
}

function groupScheduleForDay(scheduleList: JadwalPelajaranItem[], dayName: string, targetKelas?: number): GroupedScheduleSlot[] {
    const dayItems = scheduleList
        .filter(s => {
            const matchDay = s.hari.toLowerCase() === dayName.toLowerCase()
            const matchKelas = targetKelas ? s.kelas === targetKelas : true
            return matchDay && matchKelas
        })
        .sort((a, b) => a.jamKe - b.jamKe)

    if (dayItems.length === 0) return []

    const grouped: GroupedScheduleSlot[] = []
    let current: GroupedScheduleSlot | null = null

    for (const item of dayItems) {
        const isAgenda = item.jamKe === 0 ||
            item.mapel.toLowerCase().includes("upacara") ||
            item.mapel.toLowerCase().includes("senam") ||
            item.mapel.toLowerCase().includes("literasi") ||
            item.mapel.toLowerCase().includes("kaulinan") ||
            item.mapel.toLowerCase().includes("nyucikeun")
        const itemKategori: "KBM" | "AGENDA" = isAgenda ? "AGENDA" : "KBM"

        if (current && current.mapel === item.mapel && current.kategori === itemKategori && current.kelas === item.kelas && item.jamKe === current.jamKeEnd + 1) {
            current.jamKeEnd = item.jamKe
            current.jamKeDisplay = `${current.jamKeStart}-${item.jamKe}`
            const endWaktu = item.waktu.split("-")[1]?.trim() || item.waktu
            current.waktuDisplay = `${current.waktuDisplay.split("-")[0].trim()} - ${endWaktu}`
        } else {
            if (current) grouped.push(current)
            current = {
                jamKeStart: item.jamKe,
                jamKeEnd: item.jamKe,
                jamKeDisplay: item.jamKe === 0 ? "06.25 - 07.00" : `${item.jamKe}`,
                waktuDisplay: item.waktu,
                mapel: item.mapel,
                guru: item.guru,
                kategori: itemKategori,
                kelas: item.kelas
            }
        }
    }
    if (current) grouped.push(current)
    return grouped
}

export default function JurnalPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isGuruMapel = session?.user?.role === "guru_mapel"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isGuruMapel || isPengawas || isKepsek
    const isSupervisor = isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [jurnal, setJurnal] = useState<Jurnal[]>([])
    const [schedule, setSchedule] = useState<JadwalPelajaranItem[]>([])
    const [totalSiswa, setTotalSiswa] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    // Guru Mapel setup & assigned subjects
    const userMapels = useMemo(() => {
        return session?.user?.mapelDiampu
            ? session.user.mapelDiampu.split(",").map((m: string) => m.trim()).filter(Boolean)
            : []
    }, [session?.user?.mapelDiampu])
    const defaultGuruMapel = userMapels[0] || "PAI"

    // Selector: 1-6 untuk Wali Kelas, atau kode Mapel (misal "PAI" / "AKPK") untuk Guru Mapel
    const [selectedViewKey, setSelectedViewKey] = useState<string>(
        isGuruMapel ? defaultGuruMapel : (userKelas ? String(userKelas) : "1")
    )

    const isModePAI = isGuruMapel || !["1", "2", "3", "4", "5", "6"].includes(selectedViewKey)
    const activeMapel = isModePAI
        ? (isGuruMapel ? (userMapels.includes(selectedViewKey) ? selectedViewKey : defaultGuruMapel) : selectedViewKey)
        : null
    const currentKelas = isModePAI ? 5 : Number(selectedViewKey)

    const [showModal, setShowModal] = useState(false)
    const [showPrintModal, setShowPrintModal] = useState(false)
    const [showAutoFillModal, setShowAutoFillModal] = useState(false)
    const [editingJurnal, setEditingJurnal] = useState<Jurnal | null>(null)

    // Mode Tampilan: Default HARIAN
    const [viewMode, setViewMode] = useState<"HARIAN" | "BULANAN">("HARIAN")
    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayYMD())
    const [filterMonth, setFilterMonth] = useState<string>(new Date().getMonth().toString())
    const [searchQuery, setSearchQuery] = useState("")

    // School & Wali info
    const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
    const [waliKelasList, setWaliKelasList] = useState<WaliKelasInfo[]>([])

    // Subjects for current class
    const mapelList = isModePAI && activeMapel ? [activeMapel] : getMapelByKelas(currentKelas)

    // Cek query param ?kelas= dan lock kelas untuk wali kelas biasa
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas) {
                if ([1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                    if (!isGuruMapel) {
                        setSelectedViewKey(String(qKelas))
                        return
                    }
                } else if (qKelas === "PAI" || qKelas === "AKPK" || userMapels.includes(qKelas)) {
                    setSelectedViewKey(String(qKelas))
                    return
                }
            }
        }
        if (isGuruMapel) {
            setSelectedViewKey(prev => userMapels.includes(prev) ? prev : defaultGuruMapel)
        } else if (!canSelectKelas && userKelas) {
            setSelectedViewKey(String(userKelas))
        }
    }, [canSelectKelas, userKelas, isGuruMapel, defaultGuruMapel, userMapels])

    // Load school settings, wali kelas
    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.json())
            .then(data => setSchoolSettings(data))
            .catch(() => { })

        fetch("/api/settings/wali-kelas")
            .then(res => res.json())
            .then(data => setWaliKelasList(Array.isArray(data) ? data : []))
            .catch(() => { })
    }, [])

    // Load total siswa
    useEffect(() => {
        if (!isModePAI) {
            fetch(`/api/siswa?kelas=${currentKelas}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setTotalSiswa(data.length)
                    }
                })
                .catch(() => { })
        }
    }, [currentKelas, isModePAI])

    // Fetch Jurnal
    const fetchJurnal = useCallback(async () => {
        try {
            setLoading(true)
            const url = isModePAI && activeMapel
                ? `/api/jurnal?kelas=ALL&mapel=${encodeURIComponent(activeMapel)}`
                : `/api/jurnal?kelas=${currentKelas}`
            const res = await fetch(url)
            const data = await res.json()
            if (Array.isArray(data)) {
                setJurnal(data)
            } else {
                setJurnal([])
            }
        } catch {
            toast.error("Gagal memuat agenda mengajar")
        } finally {
            setLoading(false)
        }
    }, [currentKelas, isModePAI, activeMapel])

    // Fetch Schedule
    const fetchSchedule = useCallback(async () => {
        try {
            const url = isModePAI && activeMapel
                ? `/api/jadwal?mapel=${encodeURIComponent(activeMapel)}`
                : `/api/jadwal?kelas=${currentKelas}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setSchedule(data)
                }
            }
        } catch { }
    }, [currentKelas, isModePAI, activeMapel])

    useEffect(() => {
        fetchJurnal()
        fetchSchedule()
    }, [fetchJurnal, fetchSchedule])

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus baris agenda mengajar ini?")) return
        try {
            await fetch(`/api/jurnal/${id}`, { method: "DELETE" })
            toast.success("Catatan agenda berhasil dihapus")
            fetchJurnal()
        } catch {
            toast.error("Gagal menghapus")
        }
    }

    const handleToggleParaf = async (item: Jurnal) => {
        const newParaf = item.paraf === "✓" ? "-" : "✓"
        try {
            const res = await fetch(`/api/jurnal/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...item,
                    tanggal: item.tanggal.split("T")[0],
                    paraf: newParaf
                })
            })
            if (res.ok) {
                setJurnal(prev => prev.map(j => j.id === item.id ? { ...j, paraf: newParaf } : j))
                toast.success(newParaf === "✓" ? "Telah diparaf ✓" : "Paraf dibatalkan")
            }
        } catch {
            toast.error("Gagal memperbarui paraf")
        }
    }

    // Navigasi Tanggal Cepat
    const handleShiftDate = (offset: number) => {
        const [y, m, d] = selectedDate.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        dt.setDate(dt.getDate() + offset)
        const newY = dt.getFullYear()
        const newM = String(dt.getMonth() + 1).padStart(2, "0")
        const newD = String(dt.getDate()).padStart(2, "0")
        setSelectedDate(`${newY}-${newM}-${newD}`)
    }

    // Tombol Sinkronkan dengan Presensi Siswa
    const handleSyncPresensi = async () => {
        setSyncing(true)
        try {
            const res = await fetch("/api/jurnal/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kelas: currentKelas,
                    tanggal: selectedDate
                })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                const att = data.attendance
                const absentSummary = att.siswaAbsenText ? ` (Tidak Hadir: ${att.siswaAbsenText})` : ""
                toast.success(`✨ Presensi Tersinkron! Hadir: ${att.hadir}, Tdk Hadir: ${att.tdkHadir}${absentSummary}`)
                fetchJurnal()
            } else {
                toast.error("Gagal mensinkronkan presensi")
            }
        } catch {
            toast.error("Terjadi kesalahan sinkronisasi")
        } finally {
            setSyncing(false)
        }
    }

    // Filtered data based on View Mode (HARIAN vs BULANAN)
    const filteredJurnal = useMemo(() => {
        return jurnal
            .filter(item => {
                if (viewMode === "HARIAN") {
                    const itemYMD = getItemYMD(item.tanggal)
                    if (itemYMD !== selectedDate) {
                        return false
                    }
                } else {
                    if (filterMonth !== "ALL") {
                        const itemDate = new Date(item.tanggal)
                        if (itemDate.getMonth() !== parseInt(filterMonth)) {
                            return false
                        }
                    }
                }

                if (searchQuery.trim() !== "") {
                    const q = searchQuery.toLowerCase()
                    const matchMapel = item.mapel?.toLowerCase().includes(q)
                    const matchMateri = item.materi?.toLowerCase().includes(q)
                    const matchAbsen = item.siswaAbsen?.toLowerCase().includes(q)
                    if (!matchMapel && !matchMateri && !matchAbsen) {
                        return false
                    }
                }
                return true
            })
            .sort((a, b) => {
                if (viewMode === "BULANAN") {
                    const diff = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
                    if (diff !== 0) return diff
                }
                return parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe)
            })
    }, [jurnal, viewMode, selectedDate, filterMonth, searchQuery])

    // Daftar tanggal yang memiliki catatan jurnal
    const recordedDatesInMonth = useMemo(() => {
        const [currY, currM] = selectedDate.split("-").map(Number)
        const dateSet = new Set<string>()
        jurnal.forEach(j => {
            const ymd = getItemYMD(j.tanggal)
            if (ymd) {
                const [y, m] = ymd.split("-").map(Number)
                if (y === currY && m === currM) {
                    dateSet.add(ymd)
                }
            }
        })
        return Array.from(dateSet).sort()
    }, [jurnal, selectedDate])

    // Current Teacher Display
    const currentWali = waliKelasList.find(w => w.kelas === currentKelas)
    const teacherName = isModePAI
        ? (isGuruMapel ? (session?.user?.name || "Guru Mata Pelajaran") : (session?.user?.name || (activeMapel ? `Guru ${activeMapel}` : "Guru Mata Pelajaran")))
        : (currentWali?.nama || session?.user?.name || "Guru Kelas")
    const subjectDisplayName = isModePAI
        ? (activeMapel === "PAI"
            ? "Pendidikan Agama Islam dan Budi Pekerti (PAIBP)"
            : (activeMapel === "AKPK" ? "Pendidikan Karakter (AKPK)" : `${activeMapel || "Mata Pelajaran"} (Lintas Kelas)`))
        : `Guru Kelas ${toRoman(currentKelas)} (Semua Mapel)`

    // Ringkasan Kehadiran Hari Ini
    const dailyAttendanceSummary = useMemo(() => {
        if (filteredJurnal.length === 0) return null
        const first = filteredJurnal[0]
        return {
            hadir: first.jmlHadir ?? Math.max(0, totalSiswa - (first.jmlTdkHadir || 0)),
            tdkHadir: first.jmlTdkHadir || 0,
            s: first.jmlSakit || 0,
            i: first.jmlIzin || 0,
            a: first.jmlAlpha || 0,
            siswaAbsen: first.siswaAbsen
        }
    }, [filteredJurnal, totalSiswa])

    const formatDateShort = (dateStr: string) => {
        try {
            const d = new Date(dateStr)
            const day = DAY_NAMES_ID[d.getDay()]
            const dateNum = d.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            })
            return `${day}, ${dateNum}`
        } catch {
            return dateStr
        }
    }

    const formatDateFull = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split("-").map(Number)
            const dt = new Date(y, m - 1, d)
            const day = DAY_NAMES_ID[dt.getDay()]
            const formatted = dt.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            })
            return `${day}, ${formatted}`
        } catch {
            return dateStr
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                            Agenda Mengajar Guru (Jurnal Harian)
                        </h1>
                        {isSupervisor && (
                            <span className="px-2.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                                Mode Supervisi
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        {isSupervisor
                            ? "Pemantauan pelaksanaan agenda KBM harian guru dan kehadiran siswa"
                            : "Buku agenda harian pelaksanaan KBM per hari, terintegrasi otomatis dengan jadwal dan presensi siswa"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Class / Subject Mode Selector */}
                    {canSelectKelas ? (
                        <div className="relative">
                            <select
                                value={selectedViewKey}
                                onChange={(e) => setSelectedViewKey(e.target.value)}
                                className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm font-semibold text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none shadow-sm"
                            >
                                {!isGuruMapel && [1, 2, 3, 4, 5, 6].map((k) => (
                                    <option key={k} value={String(k)}>Kelas {toRoman(k)} ({k})</option>
                                ))}
                                {!isGuruMapel && (
                                    <>
                                        <option value="PAI">🕌 Guru Mapel: PAI & BP (Lintas Kelas)</option>
                                        <option value="AKPK">📘 Guru Mapel: AKPK (Lintas Kelas)</option>
                                    </>
                                )}
                                {isGuruMapel && (
                                    userMapels.length > 0 ? (
                                        userMapels.map(m => (
                                            <option key={m} value={m}>📖 Guru Mapel: {m} (Lintas Kelas)</option>
                                        ))
                                    ) : (
                                        <option value={defaultGuruMapel}>📖 Guru Mapel: {defaultGuruMapel} (Lintas Kelas)</option>
                                    )
                                )}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </div>
                    ) : (
                        <span className="h-9 px-3 flex items-center bg-[var(--accents-2)] border border-[var(--border)] rounded-md text-sm font-semibold text-[var(--foreground)]">
                            {isModePAI ? `Guru Mapel: ${activeMapel}` : `Kelas ${toRoman(currentKelas)}`}
                        </span>
                    )}

                    {/* Tombol Isi Otomatis dari Jadwal - sembunyikan untuk Pengawas */}
                    {!isPengawas && (
                        <button
                            onClick={() => setShowAutoFillModal(true)}
                            className="h-9 px-3.5 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                            title="Isi Otomatis Agenda Hari Ini Berdasarkan Jadwal Pelajaran"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            <span>Isi dari Jadwal</span>
                        </button>
                    )}

                    {/* Tombol Cetak / Print Per Hari (1 Lembar) */}
                    <button
                        onClick={() => setShowPrintModal(true)}
                        className="h-9 px-3.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                        title="Cetak Format Agenda Mengajar Guru (1 Lembar Per Hari)"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Cetak Agenda
                    </button>

                    {/* Tombol Tambah Catatan Manual - sembunyikan untuk Pengawas */}
                    {!isPengawas && (
                        <button
                            onClick={() => { setEditingJurnal(null); setShowModal(true) }}
                            className="h-9 px-4 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                                <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Tambah Agenda
                        </button>
                    )}
                </div>
            </div>

            {/* Information Card - Persis Header Format Gambar */}
            <div className="turbo-card p-4 sm:p-5 bg-gradient-to-r from-blue-50/60 to-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1.5">
                        <div className="flex">
                            <span className="w-36 text-gray-500 font-medium">Nama Guru</span>
                            <span className="font-semibold text-gray-900">: {teacherName}</span>
                        </div>
                        <div className="flex">
                            <span className="w-36 text-gray-500 font-medium">Nama Sekolah</span>
                            <span className="font-semibold text-gray-900">: {schoolSettings?.namaSekolah || "SD Negeri 2 Nangerang"}</span>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex">
                            <span className="w-36 text-gray-500 font-medium">
                                {isModePAI ? "Mata Pelajaran" : "Kelas"}
                            </span>
                            <span className="font-semibold text-gray-900">
                                : {isModePAI ? subjectDisplayName : `${getKelasWord(currentKelas)} (${toRoman(currentKelas)})`}
                            </span>
                        </div>
                        <div className="flex">
                            <span className="w-36 text-gray-500 font-medium">
                                {isModePAI ? "Cakupan Mengajar" : "Total Siswa Aktif"}
                            </span>
                            <span className="font-semibold text-blue-700">
                                : {isModePAI ? "Lintas Kelas (I s.d. VI)" : `${totalSiswa} Siswa`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOOLBAR FILTER, MODE NAVIGASI & SINKRONISASI PRESENSI */}
            <div className="turbo-card p-3.5 space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Mode Toggle: Per Hari vs Bulanan */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setViewMode("HARIAN")}
                                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${viewMode === "HARIAN"
                                    ? "bg-white text-blue-700 shadow-xs font-bold"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <span>📅</span>
                                <span>Per Hari (Harian)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("BULANAN")}
                                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${viewMode === "BULANAN"
                                    ? "bg-white text-blue-700 shadow-xs font-bold"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <span>🗓️</span>
                                <span>Semua Bulan</span>
                            </button>
                        </div>
                    </div>

                    {/* Navigasi Tanggal / Bulan */}
                    <div className="flex flex-wrap items-center gap-2">
                        {viewMode === "HARIAN" ? (
                            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => handleShiftDate(-1)}
                                    className="w-8 h-8 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold transition-colors"
                                    title="Hari Sebelumnya"
                                >
                                    ◀
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="h-8 px-2.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-blue-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleShiftDate(1)}
                                    className="w-8 h-8 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold transition-colors"
                                    title="Hari Berikutnya"
                                >
                                    ▶
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(getTodayYMD())}
                                    className="h-8 px-2.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors"
                                >
                                    Hari Ini
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Bulan:
                                </span>
                                <div className="relative">
                                    <select
                                        value={filterMonth}
                                        onChange={(e) => setFilterMonth(e.target.value)}
                                        className="h-8.5 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-xs font-bold text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none shadow-sm"
                                    >
                                        <option value="ALL">Semua Bulan</option>
                                        {MONTH_NAMES.map((name, idx) => (
                                            <option key={idx} value={idx.toString()}>{name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search Input */}
                        <div className="relative sm:w-56">
                            <input
                                type="text"
                                placeholder="Cari mapel / materi / nama absen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-8.5 pl-8 pr-3 bg-white border border-[var(--border)] rounded-md text-xs text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black shadow-sm"
                            />
                            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--accents-4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--accents-4)] hover:text-black"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-bar Tanggal & Sinkronisasi Presensi */}
                {viewMode === "HARIAN" && (
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900 bg-blue-100 text-blue-900 px-2.5 py-1 rounded-md">
                                📌 {formatDateFull(selectedDate)}
                            </span>
                            <span className="text-gray-500 font-medium">
                                ({filteredJurnal.length} Pelajaran)
                            </span>

                            {/* Status Presensi & Tombol Sinkron */}
                            {!isModePAI && (
                                <div className="flex items-center gap-1.5 ml-1">
                                    <button
                                        type="button"
                                        onClick={handleSyncPresensi}
                                        disabled={syncing}
                                        className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-2xs"
                                        title="Sinkronkan data kehadiran siswa dari modul Presensi / Daftar Hadir"
                                    >
                                        <span className={syncing ? "animate-spin" : ""}>🔄</span>
                                        <span>{syncing ? "Sinkronisasi..." : "Sinkron Presensi"}</span>
                                    </button>

                                    {dailyAttendanceSummary && (
                                        <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">
                                            Hadir: <strong className="text-emerald-700">{dailyAttendanceSummary.hadir}</strong> • Tdk Hadir: <strong className="text-red-700">{dailyAttendanceSummary.tdkHadir}</strong>
                                            {dailyAttendanceSummary.tdkHadir > 0 && ` (S: ${dailyAttendanceSummary.s}, I: ${dailyAttendanceSummary.i}, A: ${dailyAttendanceSummary.a})`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Date Pills */}
                        {recordedDatesInMonth.length > 0 && (
                            <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                                <span className="text-[11px] text-gray-500 mr-1 font-medium whitespace-nowrap">Riwayat:</span>
                                {recordedDatesInMonth.map(dStr => {
                                    const dayNum = dStr.split("-")[2]
                                    const isCurrent = dStr === selectedDate
                                    return (
                                        <button
                                            key={dStr}
                                            type="button"
                                            onClick={() => setSelectedDate(dStr)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-colors ${isCurrent
                                                ? "bg-blue-600 text-white shadow-2xs"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                        >
                                            Tgl {dayNum}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TABEL AGENDA MENGAJAR GURU (PERSIS FORMAT GAMBAR DENGAN NAMA SISWA ABSEN) */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-[#dae3f3] text-gray-900 border-b border-gray-300 font-bold text-center">
                                <th rowSpan={2} className="border border-gray-400 px-2.5 py-2.5 w-10">NO</th>
                                {viewMode !== "HARIAN" && (
                                    <th rowSpan={2} className="border border-gray-400 px-3 py-2.5 w-28">HARI/TGL</th>
                                )}
                                <th rowSpan={2} className="border border-gray-400 px-2.5 py-2.5 w-24">JAM PELAJARAN</th>
                                {isModePAI && (
                                    <th rowSpan={2} className="border border-gray-400 px-2 py-2.5 w-14">KELAS</th>
                                )}
                                <th rowSpan={2} className="border border-gray-400 px-3 py-2.5 text-left w-36">MATA PELAJARAN</th>
                                <th rowSpan={2} className="border border-gray-400 px-3 py-2.5 text-left min-w-[200px]">MATERI AJAR</th>
                                <th colSpan={3} className="border border-gray-400 px-2 py-1">KEHADIRAN SISWA</th>
                                <th rowSpan={2} className="border border-gray-400 px-2 py-2.5 w-16">JML HADIR</th>
                                <th rowSpan={2} className="border border-gray-400 px-2 py-2.5 w-16">JML TDK HADIR</th>
                                <th rowSpan={2} className="border border-gray-400 px-3 py-2.5 min-w-[160px] text-left">KET</th>
                                <th rowSpan={2} className="border border-gray-400 px-2 py-2.5 w-14">PARAF</th>
                                {!isPengawas && (
                                    <th rowSpan={2} className="border border-gray-400 px-2 py-2.5 w-20 no-print">AKSI</th>
                                )}
                            </tr>
                            <tr className="bg-[#dae3f3] text-gray-900 border-b border-gray-300 font-bold text-center">
                                <th className="border border-gray-400 px-2 py-1 w-9 text-amber-900">S</th>
                                <th className="border border-gray-400 px-2 py-1 w-9 text-blue-900">I</th>
                                <th className="border border-gray-400 px-2 py-1 w-9 text-red-900">A</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={(viewMode === "HARIAN" ? (isModePAI ? 13 : 12) : (isModePAI ? 14 : 13)) - (isPengawas ? 1 : 0)} className="text-center py-10 text-gray-500">
                                        Memuat data agenda mengajar...
                                    </td>
                                </tr>
                            ) : filteredJurnal.length === 0 ? (
                                <tr>
                                    <td colSpan={(viewMode === "HARIAN" ? (isModePAI ? 13 : 12) : (isModePAI ? 14 : 13)) - (isPengawas ? 1 : 0)} className="text-center py-12 text-gray-500">
                                        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                                            <span className="text-4xl mb-2">📋</span>
                                            <p className="font-semibold text-gray-900 text-sm">
                                                Belum ada agenda mengajar pada {viewMode === "HARIAN" ? formatDateFull(selectedDate) : "periode ini"}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 mb-3 text-center">
                                                {isPengawas
                                                    ? "Guru kelas belum menginput agenda mengajar pada tanggal ini."
                                                    : 'Klik tombol "Isi dari Jadwal" untuk memasukkan mata pelajaran hari ini beserta data absensi siswa secara otomatis.'}
                                            </p>
                                            {!isPengawas && (
                                                <button
                                                    onClick={() => setShowAutoFillModal(true)}
                                                    className="px-4 py-2 bg-purple-600 text-white rounded-md text-xs font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                                                >
                                                    <span>⚡</span>
                                                    <span>Isi Otomatis dari Jadwal Hari Ini</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredJurnal.map((item, idx) => {
                                    const s = item.jmlSakit || 0
                                    const i = item.jmlIzin || 0
                                    const a = item.jmlAlpha || 0
                                    const tdkHadir = item.jmlTdkHadir !== undefined && item.jmlTdkHadir !== null ? item.jmlTdkHadir : (s + i + a)
                                    const hadir = item.jmlHadir !== undefined && item.jmlHadir !== null ? item.jmlHadir : Math.max(0, totalSiswa - tdkHadir)

                                    return (
                                        <tr key={item.id} className="hover:bg-blue-50/40 transition-colors align-top">
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-medium">
                                                {idx + 1}
                                            </td>
                                            {viewMode !== "HARIAN" && (
                                                <td className="border border-gray-300 px-3 py-2.5 text-center whitespace-nowrap font-medium text-gray-900">
                                                    {formatDateShort(item.tanggal)}
                                                </td>
                                            )}
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-semibold text-blue-900 whitespace-nowrap">
                                                {item.jamKe}
                                            </td>
                                            {isModePAI && (
                                                <td className="border border-gray-300 px-2 py-2.5 text-center font-bold text-gray-800">
                                                    {toRoman(item.kelas || currentKelas)}
                                                </td>
                                            )}
                                            {/* KOLOM MATA PELAJARAN */}
                                            <td className="border border-gray-300 px-3 py-2.5 font-bold text-gray-900 text-xs">
                                                {item.mapel}
                                            </td>
                                            {/* KOLOM MATERI AJAR */}
                                            <td className="border border-gray-300 px-3 py-2.5 text-gray-700 text-[11px] leading-relaxed">
                                                {item.materi}
                                            </td>
                                            {/* S / I / A */}
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-semibold text-amber-900">
                                                {s > 0 ? s : "-"}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-semibold text-blue-900">
                                                {i > 0 ? i : "-"}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-semibold text-red-900">
                                                {a > 0 ? a : "-"}
                                            </td>
                                            {/* JML HADIR & TDK HADIR */}
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-bold text-emerald-800">
                                                {hadir}
                                            </td>
                                            <td className="border border-gray-300 px-2 py-2.5 text-center font-bold text-red-700">
                                                {tdkHadir > 0 ? tdkHadir : "-"}
                                            </td>
                                            {/* KOLOM KET: BERISI NAMA SISWA SAKIT/IJIN/ALFA */}
                                            <td className="border border-gray-300 px-2.5 py-2.5 text-[11px]">
                                                {item.siswaAbsen ? (
                                                    <div>
                                                        <div className="text-red-900 font-semibold leading-snug">
                                                            {item.siswaAbsen}
                                                        </div>
                                                        {item.catatan && (
                                                            <div className="text-[10.5px] text-blue-800 bg-blue-50/70 rounded px-1.5 py-0.5 mt-1 border border-blue-100 italic">
                                                                💬 Refleksi: {item.catatan}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : item.catatan ? (
                                                    <div className="text-[10.5px] text-blue-800 bg-blue-50/70 rounded px-1.5 py-0.5 border border-blue-100 italic">
                                                        💬 Refleksi: {item.catatan}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-gray-400 font-normal">-</div>
                                                )}
                                            </td>
                                            {/* PARAF */}
                                            <td className="border border-gray-300 px-2 py-2.5 text-center">
                                                {isPengawas ? (
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${item.paraf === "✓"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {item.paraf || "-"}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleParaf(item)}
                                                        title="Klik untuk ubah paraf guru"
                                                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold transition-all ${item.paraf === "✓"
                                                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                            }`}
                                                    >
                                                        {item.paraf || "-"}
                                                    </button>
                                                )}
                                            </td>
                                            {/* ACTION */}
                                            {!isPengawas && (
                                                <td className="border border-gray-300 px-2 py-2.5 text-center no-print whitespace-nowrap">
                                                    <button
                                                        onClick={() => { setEditingJurnal(item); setShowModal(true) }}
                                                        className="p-1 text-blue-600 hover:text-blue-900 rounded hover:bg-blue-50 mr-1"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-1 text-red-600 hover:text-red-900 rounded hover:bg-red-50"
                                                        title="Hapus"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah / Edit Manual */}
            {showModal && (
                <JurnalModal
                    jurnal={editingJurnal}
                    kelas={currentKelas}
                    isModePAI={isModePAI}
                    activeMapel={activeMapel}
                    mapelList={mapelList}
                    schedule={schedule}
                    totalSiswa={totalSiswa}
                    defaultDate={selectedDate}
                    onClose={() => setShowModal(false)}
                    onSave={() => { setShowModal(false); fetchJurnal() }}
                />
            )}

            {/* Modal Pengisian Otomatis dari Jadwal */}
            {showAutoFillModal && (
                <AutoFillScheduleModal
                    kelas={currentKelas}
                    isModePAI={isModePAI}
                    schedule={schedule}
                    existingJurnal={jurnal}
                    totalSiswa={totalSiswa}
                    initialDate={selectedDate}
                    onClose={() => setShowAutoFillModal(false)}
                    onSuccess={() => { setShowAutoFillModal(false); fetchJurnal() }}
                />
            )}

            {/* Modal Pratinjau & Cetak Resmi Per Hari / Mingguan / Bulanan */}
            {showPrintModal && (
                <PrintPreviewModal
                    allJurnal={jurnal}
                    kelas={currentKelas}
                    isModePAI={isModePAI}
                    activeMapel={activeMapel}
                    subjectDisplayName={subjectDisplayName}
                    schoolSettings={schoolSettings}
                    waliKelas={currentWali}
                    initialDate={selectedDate}
                    totalSiswa={totalSiswa}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    )
}

/* =========================================================================
   MODAL PENGISIAN OTOMATIS DARI JADWAL (DENGAN SINKRONISASI NAMA SISWA ABSEN)
   ========================================================================= */
function AutoFillScheduleModal({
    kelas,
    isModePAI,
    schedule,
    existingJurnal,
    totalSiswa,
    initialDate,
    onClose,
    onSuccess
}: {
    kelas: number
    isModePAI?: boolean
    schedule: JadwalPelajaranItem[]
    existingJurnal: Jurnal[]
    totalSiswa: number
    initialDate?: string
    onClose: () => void
    onSuccess: () => void
}) {
    const [selectedDate, setSelectedDate] = useState(() => initialDate || getTodayYMD())
    const [selectedSlots, setSelectedSlots] = useState<Record<number, boolean>>({})
    const [loading, setLoading] = useState(false)
    const [attendanceCount, setAttendanceCount] = useState({
        s: 0,
        i: 0,
        a: 0,
        h: totalSiswa,
        siswaAbsenText: null as string | null
    })

    // Calculate day name
    const dayName = useMemo(() => {
        const [y, m, d] = selectedDate.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        return DAY_NAMES_ID[dt.getDay()] || "Senin"
    }, [selectedDate])

    // Group schedule slots for this day
    const daySlots = useMemo(() => {
        return groupScheduleForDay(schedule, dayName, isModePAI ? undefined : kelas)
    }, [schedule, dayName, isModePAI, kelas])

    // Fetch actual attendance recorded for that date (beserta nama siswa)
    useEffect(() => {
        fetch(`/api/absensi?kelas=${kelas}&tanggal=${selectedDate}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const sList = data.filter((x: any) => x.status === "S").map((x: any) => x.siswa?.nama || "Siswa")
                    const iList = data.filter((x: any) => x.status === "I").map((x: any) => x.siswa?.nama || "Siswa")
                    const aList = data.filter((x: any) => x.status === "A").map((x: any) => x.siswa?.nama || "Siswa")

                    const s = sList.length
                    const i = iList.length
                    const a = aList.length
                    const tdkHadir = s + i + a
                    const h = Math.max(0, totalSiswa - tdkHadir)

                    const parts: string[] = []
                    if (sList.length > 0) parts.push(`Sakit: ${sList.join(", ")}`)
                    if (iList.length > 0) parts.push(`Izin: ${iList.join(", ")}`)
                    if (aList.length > 0) parts.push(`Alpa: ${aList.join(", ")}`)
                    const siswaAbsenText = parts.length > 0 ? parts.join(" | ") : null

                    setAttendanceCount({ s, i, a, h, siswaAbsenText })
                } else {
                    setAttendanceCount({ s: 0, i: 0, a: 0, h: totalSiswa, siswaAbsenText: null })
                }
            })
            .catch(() => {
                setAttendanceCount({ s: 0, i: 0, a: 0, h: totalSiswa, siswaAbsenText: null })
            })
    }, [kelas, selectedDate, totalSiswa])

    // Detect which slots already exist
    const existingMap = useMemo(() => {
        const map: Record<string, boolean> = {}
        existingJurnal.forEach(j => {
            if (getItemYMD(j.tanggal) === selectedDate) {
                const key = `${j.kelas || kelas}-${j.mapel.toLowerCase().trim()}`
                map[key] = true
            }
        })
        return map
    }, [existingJurnal, selectedDate, kelas])

    // Initialize selected checkboxes
    useEffect(() => {
        const initial: Record<number, boolean> = {}
        daySlots.forEach((slot, idx) => {
            const key = `${slot.kelas || kelas}-${slot.mapel.toLowerCase().trim()}`
            const alreadyExists = !!existingMap[key]
            initial[idx] = !alreadyExists
        })
        setSelectedSlots(initial)
    }, [daySlots, existingMap, kelas])

    const isWeekend = dayName === "Sabtu" || dayName === "Minggu"
    const selectedCount = Object.values(selectedSlots).filter(Boolean).length

    const handleToggleAll = (val: boolean) => {
        const updated: Record<number, boolean> = {}
        daySlots.forEach((slot, idx) => {
            const key = `${slot.kelas || kelas}-${slot.mapel.toLowerCase().trim()}`
            const alreadyExists = !!existingMap[key]
            if (!alreadyExists) {
                updated[idx] = val
            } else {
                updated[idx] = false
            }
        })
        setSelectedSlots(updated)
    }

    const handleSubmit = async () => {
        const slotsToCreate = daySlots.filter((_, idx) => selectedSlots[idx])
        if (slotsToCreate.length === 0) {
            toast.error("Pilih setidaknya satu jadwal untuk dimasukkan")
            return
        }

        setLoading(true)
        try {
            const tdkHadir = attendanceCount.s + attendanceCount.i + attendanceCount.a
            const payload = slotsToCreate.map(slot => ({
                tanggal: selectedDate,
                jamKe: slot.jamKeStart === 0 ? "06.25 - 07.00" : slot.jamKeDisplay,
                mapel: slot.mapel,
                materi: slot.kategori === "AGENDA"
                    ? `Pelaksanaan kegiatan ${slot.mapel}`
                    : `Pembelajaran ${slot.mapel} sesuai tujuan pembelajaran modul ajar`,
                metode: "-",
                catatan: null,
                siswaAbsen: attendanceCount.siswaAbsenText,
                kategori: slot.kategori,
                jmlSakit: attendanceCount.s,
                jmlIzin: attendanceCount.i,
                jmlAlpha: attendanceCount.a,
                jmlHadir: attendanceCount.h,
                jmlTdkHadir: tdkHadir,
                paraf: "✓",
                kelas: slot.kelas || kelas
            }))

            const res = await fetch("/api/jurnal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success(`✨ Berhasil memasukkan ${payload.length} mata pelajaran ke agenda harian!`)
                onSuccess()
            } else {
                toast.error("Gagal memasukkan jadwal otomatis")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col my-auto">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-[var(--border)] flex justify-between items-center bg-purple-50 rounded-t-xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
                            ⚡
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-purple-950">
                                Isi Agenda Otomatis dari Jadwal Pelajaran
                            </h2>
                            <p className="text-xs text-purple-700 mt-0.5">
                                Terintegrasi dengan jadwal kelas dan nama-nama siswa yang tidak hadir
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--accents-5)] hover:text-black hover:bg-gray-100 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Date Selector & Auto Attendance Preview */}
                    <div className="bg-gray-50 p-3.5 rounded-lg border border-[var(--border)] space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Pilih Tanggal Mengajar:
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-semibold outline-none focus:ring-1 focus:ring-purple-600"
                                />
                            </div>
                            <div className="text-left sm:text-right">
                                <span className="text-xs text-gray-500 block">Jadwal Untuk:</span>
                                <span className="text-sm font-bold text-purple-900">
                                    Hari {dayName}, {isModePAI ? "Semua Kelas (PAIBP)" : `Kelas ${toRoman(kelas)}`}
                                </span>
                            </div>
                        </div>

                        {/* Kehadiran Terdeteksi Otomatis Beserta Nama */}
                        <div className="pt-2 border-t border-gray-200 space-y-1.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-gray-500 font-medium">Data Presensi Siswa:</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                                    Hadir: {attendanceCount.h}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                    Sakit (S): {attendanceCount.s}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">
                                    Izin (I): {attendanceCount.i}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 font-bold">
                                    Alpha (A): {attendanceCount.a}
                                </span>
                            </div>

                            {/* Nama Siswa Tidak Hadir */}
                            {attendanceCount.siswaAbsenText ? (
                                <div className="p-2 bg-red-50 text-red-800 rounded border border-red-200 text-[11px] font-medium">
                                    <span className="font-bold">🔴 Rincian Tidak Hadir: </span>
                                    <span>{attendanceCount.siswaAbsenText}</span>
                                </div>
                            ) : (
                                <div className="text-[11px] text-emerald-700 font-medium">
                                    ✓ Seluruh siswa hadir lengkap (Nihil Absen).
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Schedule List */}
                    {isWeekend ? (
                        <div className="p-8 text-center bg-amber-50 rounded-lg border border-amber-200 text-amber-800">
                            <p className="font-semibold text-base mb-1">Hari Libur Akhir Pekan ({dayName})</p>
                            <p className="text-xs text-amber-700">
                                Tidak ada KBM terjadwal pada hari Sabtu & Minggu. Silakan pilih hari Senin s.d. Jumat.
                            </p>
                        </div>
                    ) : daySlots.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-sm font-medium">Belum ada jadwal untuk hari {dayName}</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Mata Pelajaran Terjadwal ({daySlots.length} Sesi):
                                </span>
                                <div className="flex gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleAll(true)}
                                        className="text-purple-600 font-semibold hover:underline"
                                    >
                                        Pilih Semua
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleAll(false)}
                                        className="text-gray-500 font-medium hover:underline"
                                    >
                                        Batal Semua
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {daySlots.map((slot, idx) => {
                                    const key = `${slot.kelas || kelas}-${slot.mapel.toLowerCase().trim()}`
                                    const alreadyExists = !!existingMap[key]
                                    const isChecked = !!selectedSlots[idx]

                                    return (
                                        <label
                                            key={idx}
                                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-all ${alreadyExists
                                                ? "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
                                                : isChecked
                                                    ? "bg-purple-50/70 border-purple-300 shadow-2xs"
                                                    : "bg-white border-gray-200 hover:bg-gray-50"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    disabled={alreadyExists}
                                                    checked={isChecked}
                                                    onChange={(e) => setSelectedSlots({ ...selectedSlots, [idx]: e.target.checked })}
                                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-purple-900">
                                                            {slot.jamKeStart === 0 ? "Pagi (06.25 - 07.00)" : `Jam Ke-${slot.jamKeDisplay}`}
                                                        </span>
                                                        <span className="text-[11px] text-gray-500">
                                                            ({slot.waktuDisplay})
                                                        </span>
                                                        {slot.kelas && (
                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                                                Kelas {toRoman(slot.kelas)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-bold text-gray-900 mt-0.5">
                                                        {slot.mapel}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                {alreadyExists ? (
                                                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                                        <span>✓</span> Sudah Ada
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-gray-500 italic">
                                                        {slot.guru ? slot.guru.split(",")[0] : "Wali Kelas"}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-gray-50 border-t border-[var(--border)] flex items-center justify-between rounded-b-xl gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={loading || selectedCount === 0 || isWeekend}
                        onClick={handleSubmit}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        {loading ? "Menyimpan..." : (
                            <>
                                <span>✨</span>
                                <span>Masukkan ke Agenda ({selectedCount} Mapel)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* =========================================================================
   MODAL FORM TAMBAH / EDIT MANUAL (DENGAN TEMPLATE REFLEKSI TP)
   ========================================================================= */
function JurnalModal({
    jurnal,
    kelas,
    isModePAI,
    activeMapel,
    mapelList,
    schedule,
    totalSiswa,
    defaultDate,
    onClose,
    onSave
}: {
    jurnal: Jurnal | null
    kelas: number
    isModePAI?: boolean
    activeMapel?: string | null
    mapelList: string[]
    schedule: JadwalPelajaranItem[]
    totalSiswa: number
    defaultDate?: string
    onClose: () => void
    onSave: () => void
}) {
    const [selectedEntryKelas, setSelectedEntryKelas] = useState<number>(jurnal?.kelas || (isModePAI ? 1 : kelas))
    const [form, setForm] = useState({
        tanggal: jurnal?.tanggal ? getItemYMD(jurnal.tanggal) : defaultDate || getTodayYMD(),
        jamKe: jurnal?.jamKe || "1-2",
        mapel: jurnal?.mapel || (isModePAI && activeMapel ? activeMapel : mapelList[0]) || "",
        materi: jurnal?.materi || "",
        jmlSakit: jurnal?.jmlSakit ?? 0,
        jmlIzin: jurnal?.jmlIzin ?? 0,
        jmlAlpha: jurnal?.jmlAlpha ?? 0,
        siswaAbsen: jurnal?.siswaAbsen || "",
        paraf: jurnal?.paraf || "✓",
        catatan: jurnal?.catatan || "",
    })

    const [loading, setLoading] = useState(false)
    const [customMapel, setCustomMapel] = useState(false)

    // Calculate day name
    const dayName = useMemo(() => {
        const [y, m, d] = form.tanggal.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        return DAY_NAMES_ID[dt.getDay()] || "Senin"
    }, [form.tanggal])

    // Group schedule for this day and effective class
    const effectiveKelas = isModePAI ? selectedEntryKelas : kelas
    const daySchedule = useMemo(() => {
        return groupScheduleForDay(schedule, dayName, effectiveKelas)
    }, [schedule, dayName, effectiveKelas])

    // Fetch absensi siswa otomatis saat tanggal/kelas berubah jika belum ada jurnal
    useEffect(() => {
        if (!jurnal) {
            fetch(`/api/absensi?kelas=${effectiveKelas}&tanggal=${form.tanggal}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        const sList = data.filter((x: any) => x.status === "S").map((x: any) => x.siswa?.nama || "Siswa")
                        const iList = data.filter((x: any) => x.status === "I").map((x: any) => x.siswa?.nama || "Siswa")
                        const aList = data.filter((x: any) => x.status === "A").map((x: any) => x.siswa?.nama || "Siswa")

                        const parts: string[] = []
                        if (sList.length > 0) parts.push(`Sakit: ${sList.join(", ")}`)
                        if (iList.length > 0) parts.push(`Izin: ${iList.join(", ")}`)
                        if (aList.length > 0) parts.push(`Alpa: ${aList.join(", ")}`)

                        setForm(f => ({
                            ...f,
                            jmlSakit: sList.length,
                            jmlIzin: iList.length,
                            jmlAlpha: aList.length,
                            siswaAbsen: parts.join(" | ")
                        }))
                    }
                })
                .catch(() => { })
        }
    }, [effectiveKelas, form.tanggal, jurnal])

    const tdkHadir = (form.jmlSakit || 0) + (form.jmlIzin || 0) + (form.jmlAlpha || 0)
    const hadir = Math.max(0, totalSiswa - tdkHadir)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const url = jurnal ? `/api/jurnal/${jurnal.id}` : "/api/jurnal"
            const method = jurnal ? "PUT" : "POST"

            const isAgenda = form.jamKe.includes("06.") ||
                form.mapel.toLowerCase().includes("upacara") ||
                form.mapel.toLowerCase().includes("senam") ||
                form.mapel.toLowerCase().includes("literasi")

            const payload = {
                ...form,
                kelas: effectiveKelas,
                metode: "-",
                kategori: isAgenda ? "AGENDA" : "KBM",
                jmlHadir: hadir,
                jmlTdkHadir: tdkHadir,
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success(jurnal ? "Catatan berhasil diperbarui" : "Catatan berhasil ditambahkan")
                onSave()
            } else {
                toast.error("Gagal menyimpan catatan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    // Quick Reflection Templates
    const quickReflections = [
        "✨ Tujuan Pembelajaran (TP) tercapai optimal",
        "🔄 Perlu pendampingan remedial untuk sebagian siswa",
        "⏳ Materi dilanjutkan pada pertemuan berikutnya",
        "🎯 Asesmen formatif terlaksana dengan baik"
    ]

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-lg overflow-hidden my-auto">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-gray-50">
                    <h2 className="text-base font-bold text-[var(--foreground)]">
                        {jurnal ? "Edit Agenda Mengajar Guru" : "Tambah Agenda Mengajar Guru"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--accents-5)] hover:text-black transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[85vh] overflow-y-auto">
                    {/* Tanggal & Hari */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--accents-6)] mb-1">
                                Tanggal Pembelajaran
                            </label>
                            <input
                                type="date"
                                value={form.tanggal}
                                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black font-semibold"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--accents-6)] mb-1">
                                {isModePAI ? "Kelas Sasaran (Lintas Kelas)" : "Hari / Jadwal"}
                            </label>
                            {isModePAI ? (
                                <select
                                    value={selectedEntryKelas}
                                    onChange={(e) => setSelectedEntryKelas(Number(e.target.value))}
                                    className="w-full h-[38px] px-3 bg-white border border-[var(--border)] rounded-md text-sm font-semibold outline-none focus:ring-1 focus:ring-black"
                                >
                                    {[1, 2, 3, 4, 5, 6].map(k => (
                                        <option key={k} value={k}>Kelas {toRoman(k)} ({dayName})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="h-[38px] px-3 flex items-center bg-gray-100 rounded-md text-sm font-bold text-gray-800 border border-gray-200">
                                    {dayName}, Kelas {toRoman(kelas)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rekomendasi Jadwal Hari Ini */}
                    {daySchedule.length > 0 && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                            <span className="block text-[11px] font-bold text-blue-900 mb-1.5">
                                💡 Klik Jadwal Hari {dayName} untuk Mengisi Cepat:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {daySchedule.map((s, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setForm(prev => ({
                                                ...prev,
                                                jamKe: s.jamKeDisplay,
                                                mapel: s.mapel,
                                                materi: prev.materi || (s.kategori === "AGENDA" ? `Pelaksanaan kegiatan ${s.mapel}` : `Pembelajaran ${s.mapel} sesuai tujuan pembelajaran modul ajar`)
                                            }))
                                        }}
                                        className="px-2 py-1 bg-white border border-blue-300 rounded text-[11px] font-medium text-blue-900 hover:bg-blue-600 hover:text-white transition-colors shadow-2xs"
                                    >
                                        {s.jamKeDisplay === "06.25 - 07.00" ? "06.25" : `Jam ${s.jamKeDisplay}`}: {s.mapel}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Jam Ke & Mata Pelajaran */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--accents-6)] mb-1">
                                Jam Pelajaran Ke-
                            </label>
                            <input
                                type="text"
                                value={form.jamKe}
                                onChange={(e) => setForm({ ...form, jamKe: e.target.value })}
                                placeholder="Contoh: 1-2 atau 06.25 - 07.00"
                                className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black"
                                required
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-[var(--accents-6)]">
                                    Mata Pelajaran
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setCustomMapel(!customMapel)}
                                    className="text-[11px] text-blue-600 hover:underline"
                                >
                                    {customMapel ? "Pilih dari Daftar" : "Ketik Manual"}
                                </button>
                            </div>
                            {customMapel ? (
                                <input
                                    type="text"
                                    value={form.mapel}
                                    onChange={(e) => setForm({ ...form, mapel: e.target.value })}
                                    placeholder="Nama Mapel / Kegiatan..."
                                    className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black"
                                    required
                                />
                            ) : (
                                <select
                                    value={form.mapel}
                                    onChange={(e) => setForm({ ...form, mapel: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black"
                                    required
                                >
                                    {mapelList.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Materi Ajar */}
                    <div>
                        <label className="block text-xs font-semibold text-[var(--accents-6)] mb-1">
                            Materi Ajar / Tujuan Pembelajaran
                        </label>
                        <textarea
                            value={form.materi}
                            onChange={(e) => setForm({ ...form, materi: e.target.value })}
                            placeholder="Tuliskan materi pokok atau capaian pembelajaran yang diajarkan..."
                            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black"
                            rows={2}
                            required
                        />
                    </div>

                    {/* KEHADIRAN SISWA & RINCIAN NAMA SISWA TIDAK HADIR */}
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                        <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Kehadiran Siswa:
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                                    Sakit (S)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.jmlSakit}
                                    onChange={(e) => setForm({ ...form, jmlSakit: Number(e.target.value) })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-center text-sm font-bold text-amber-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-800 mb-1">
                                    Izin (I)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.jmlIzin}
                                    onChange={(e) => setForm({ ...form, jmlIzin: Number(e.target.value) })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-center text-sm font-bold text-blue-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-red-800 mb-1">
                                    Alpha (A)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.jmlAlpha}
                                    onChange={(e) => setForm({ ...form, jmlAlpha: Number(e.target.value) })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-center text-sm font-bold text-red-900"
                                />
                            </div>
                        </div>

                        {/* Rincian Nama Siswa Tidak Hadir */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                Rincian Nama Siswa Tidak Hadir (Otomatis dari Presensi):
                            </label>
                            <input
                                type="text"
                                value={form.siswaAbsen}
                                onChange={(e) => setForm({ ...form, siswaAbsen: e.target.value })}
                                placeholder="Contoh: Sakit: Budi, Siti | Alpa: Rian"
                                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 outline-none focus:ring-1 focus:ring-black"
                            />
                        </div>

                        {/* Rekap Otomatis */}
                        <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-center">
                                <span className="text-emerald-700 block text-[11px] font-medium">Jml Hadir:</span>
                                <span className="text-base font-bold text-emerald-900">{hadir} Siswa</span>
                            </div>
                            <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                                <span className="text-red-700 block text-[11px] font-medium">Jml Tdk Hadir:</span>
                                <span className="text-base font-bold text-red-900">{tdkHadir} Siswa</span>
                            </div>
                        </div>
                    </div>

                    {/* Refleksi Pembelajaran / Catatan (Quick Templates) */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-semibold text-[var(--accents-6)]">
                                Refleksi KBM / Catatan Tindak Lanjut
                            </label>
                            <span className="text-[10px] text-gray-400">Pilih template cepat di bawah:</span>
                        </div>
                        <input
                            type="text"
                            value={form.catatan}
                            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                            placeholder="Catatan hasil KBM / ketercapaian materi..."
                            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black mb-1.5"
                        />
                        <div className="flex flex-wrap gap-1">
                            {quickReflections.map((tmpl, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, catatan: tmpl }))}
                                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] transition-colors"
                                >
                                    {tmpl}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Paraf Guru */}
                    <div>
                        <label className="block text-xs font-semibold text-[var(--accents-6)] mb-1">
                            Paraf Guru
                        </label>
                        <input
                            type="text"
                            value={form.paraf}
                            onChange={(e) => setForm({ ...form, paraf: e.target.value })}
                            placeholder="✓ / Inisial"
                            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black text-center font-bold"
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black border border-[var(--border)] rounded-md transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {loading ? "Menyimpan..." : (jurnal ? "Simpan Perubahan" : "Simpan Agenda")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* =========================================================================
   MODAL PRATINJAU & CETAK RESMI (HARIAN 1 LEMBAR, MINGGUAN, BULANAN)
   ========================================================================= */
function PrintPreviewModal({
    allJurnal,
    kelas,
    isModePAI,
    activeMapel,
    subjectDisplayName,
    schoolSettings,
    waliKelas,
    initialDate,
    totalSiswa,
    onClose
}: {
    allJurnal: Jurnal[]
    kelas: number
    isModePAI?: boolean
    activeMapel?: string | null
    subjectDisplayName?: string
    schoolSettings: SchoolSettings | null
    waliKelas?: WaliKelasInfo
    initialDate: string
    totalSiswa: number
    onClose: () => void
}) {
    const { data: session } = useSession()

    // Mode Cetak: HARIAN (default), MINGGUAN (Senin-Jumat), BULANAN
    const [printMode, setPrintMode] = useState<"HARIAN" | "MINGGUAN" | "BULANAN">("HARIAN")
    const [currentDate, setCurrentDate] = useState<string>(initialDate || getTodayYMD())
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const d = new Date(initialDate ? initialDate + "T00:00:00" : new Date())
        return d.getMonth().toString()
    })

    const teacherName = isModePAI
        ? (session?.user?.name || "Guru Mata Pelajaran")
        : (waliKelas?.nama || session?.user?.name || "Guru Kelas")
    const schoolName = schoolSettings?.namaSekolah || "SD Negeri 2 Nangerang"
    const subjectName = isModePAI
        ? (subjectDisplayName || (activeMapel === "PAI" ? "Pendidikan Agama Islam dan Budi Pekerti (PAIBP)" : `${activeMapel || "Mata Pelajaran"} (Lintas Kelas)`))
        : `${getKelasWord(kelas)} (${toRoman(kelas)})`

    // Hitung tanggal terpilih
    const dateObj = useMemo(() => {
        const [y, m, d] = currentDate.split("-").map(Number)
        return new Date(y, m - 1, d)
    }, [currentDate])

    const dayName = DAY_NAMES_ID[dateObj.getDay()] || "Senin"
    const fullDateText = dateObj.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
    })

    // Hitung Rentang Pekan (Senin s.d. Jumat)
    const weekInfo = useMemo(() => {
        const [y, m, d] = currentDate.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        const day = dt.getDay()
        const diffToMon = day === 0 ? -6 : 1 - day
        const mon = new Date(dt)
        mon.setDate(dt.getDate() + diffToMon)
        const fri = new Date(mon)
        fri.setDate(mon.getDate() + 4)

        const monYMD = getItemYMD(mon.toISOString())
        const friYMD = getItemYMD(fri.toISOString())
        const monText = mon.toLocaleDateString("id-ID", { day: "numeric", month: "long" })
        const friText = fri.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

        return { monYMD, friYMD, monText, friText }
    }, [currentDate])

    const monthLabel = selectedMonth === "ALL"
        ? "JULI - DESEMBER"
        : MONTH_NAMES[parseInt(selectedMonth)].toUpperCase()

    // Filter data untuk dicetak
    const printItems = useMemo(() => {
        if (printMode === "HARIAN") {
            return allJurnal
                .filter(item => getItemYMD(item.tanggal) === currentDate)
                .sort((a, b) => parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe))
        } else if (printMode === "MINGGUAN") {
            return allJurnal
                .filter(item => {
                    const ymd = getItemYMD(item.tanggal)
                    return ymd >= weekInfo.monYMD && ymd <= weekInfo.friYMD
                })
                .sort((a, b) => {
                    const diff = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
                    if (diff !== 0) return diff
                    return parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe)
                })
        } else {
            return allJurnal
                .filter(item => {
                    if (selectedMonth === "ALL") return true
                    const itemDate = new Date(item.tanggal)
                    return itemDate.getMonth() === parseInt(selectedMonth)
                })
                .sort((a, b) => {
                    const diff = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
                    if (diff !== 0) return diff
                    return parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe)
                })
        }
    }, [allJurnal, printMode, currentDate, weekInfo, selectedMonth])

    const handleShiftDate = (offset: number) => {
        const [y, m, d] = currentDate.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        dt.setDate(dt.getDate() + (printMode === "MINGGUAN" ? offset * 7 : offset))
        const newY = dt.getFullYear()
        const newM = String(dt.getMonth() + 1).padStart(2, "0")
        const newD = String(dt.getDate()).padStart(2, "0")
        setCurrentDate(`${newY}-${newM}-${newD}`)
    }

    // Print Handler
    const handlePrint = () => {
        document.body.classList.add("printing-jurnal")
        window.print()
        setTimeout(() => {
            document.body.classList.remove("printing-jurnal")
        }, 1000)
    }

    // Export to Excel (Landscape A4 via Backend ExcelJS)
    const handleExportExcel = async () => {
        if (printItems.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        try {
            toast.loading("Menyiapkan file Excel Landscape...", { id: "export-excel" })
            const response = await fetch("/api/jurnal/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    printItems,
                    printMode,
                    kelas,
                    isModePAI,
                    subjectName,
                    teacherName,
                    schoolName,
                    currentDate,
                    selectedMonth,
                    totalSiswa,
                    schoolSettings,
                    waliKelas
                })
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || "Gagal mengunduh Excel")
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            const fileSubject = isModePAI ? (activeMapel || "Mapel") : `Kelas_${kelas}`
            const fileName = printMode === "HARIAN"
                ? `Agenda_Mengajar_${fileSubject}_${currentDate}.xlsx`
                : printMode === "MINGGUAN"
                    ? `Agenda_Mengajar_${fileSubject}_Pekan_${currentDate}.xlsx`
                    : `Agenda_Mengajar_${fileSubject}_${monthLabel}.xlsx`
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("Excel Landscape berhasil diunduh!", { id: "export-excel" })
        } catch (err: any) {
            console.error("Export Excel error:", err)
            toast.error(err.message || "Gagal mengexport Excel", { id: "export-excel" })
        }
    }

    // Kelompokkan data per hari untuk preview & cetak per lembar A4 Landscape
    const dailySections = useMemo(() => {
        if (printMode === "HARIAN") {
            const sorted = allJurnal
                .filter(item => getItemYMD(item.tanggal) === currentDate)
                .sort((a, b) => parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe))
            const [y, m, d] = currentDate.split("-").map(Number)
            const dt = new Date(y, m - 1, d)
            return [{
                ymd: currentDate,
                dateObj: dt,
                dayName: DAY_NAMES_ID[dt.getDay()] || "Senin",
                fullDateText: dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
                items: sorted
            }]
        }

        const map = new Map<string, Jurnal[]>()
        for (const item of printItems) {
            const ymd = getItemYMD(item.tanggal)
            if (!ymd) continue
            if (!map.has(ymd)) map.set(ymd, [])
            map.get(ymd)!.push(item)
        }

        if (printMode === "MINGGUAN") {
            const [y, m, d] = currentDate.split("-").map(Number)
            const dt = new Date(y, m - 1, d)
            const dayOfWeek = dt.getDay()
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const mon = new Date(dt)
            mon.setDate(dt.getDate() + diffToMon)

            const list = []
            for (let offset = 0; offset < 5; offset++) {
                const cur = new Date(mon)
                cur.setDate(mon.getDate() + offset)
                const ymd = getItemYMD(cur.toISOString())
                const items = (map.get(ymd) || []).sort((a, b) => parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe))

                // Jika mode PAI dan tidak ada KBM pada hari itu, lewati
                if (isModePAI && items.length === 0) continue

                list.push({
                    ymd,
                    dateObj: cur,
                    dayName: DAY_NAMES_ID[cur.getDay()] || "Senin",
                    fullDateText: cur.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
                    items
                })
            }
            return list
        }

        // BULANAN: Urutkan tanggal, lewati akhir pekan (Sabtu & Minggu)
        const uniqueYMDs = Array.from(map.keys()).sort()
        const list = []
        for (const ymd of uniqueYMDs) {
            const [y, m, d] = ymd.split("-").map(Number)
            const dt = new Date(y, m - 1, d)
            if (dt.getDay() === 0 || dt.getDay() === 6) continue

            const items = (map.get(ymd) || []).sort((a, b) => parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe))
            list.push({
                ymd,
                dateObj: dt,
                dayName: DAY_NAMES_ID[dt.getDay()] || "Senin",
                fullDateText: dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
                items
            })
        }
        return list
    }, [printMode, allJurnal, currentDate, printItems, isModePAI])

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex flex-col z-50 p-2 sm:p-4 overflow-y-auto">
            {/* Top Toolbar (Hidden when printing) */}
            <div className="bg-white rounded-xl shadow-lg border border-[var(--border)] p-4 max-w-5xl w-full mx-auto mb-4 no-print space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>🖨️</span> Cetak Agenda Mengajar Guru (Jurnal Harian)
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Pilih cetak per hari agar pas 1 lembar, atau cetak mingguan/bulanan sesuai kebutuhan dinas
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="h-9 px-4 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Cetak Sekarang / Simpan PDF
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="h-9 px-3.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export Excel
                        </button>

                        <button
                            onClick={onClose}
                            className="h-9 px-3.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                            ✕ Tutup
                        </button>
                    </div>
                </div>

                {/* Print Options Bar */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Toggle Harian vs Mingguan vs Bulanan */}
                    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100 font-semibold">
                        <button
                            type="button"
                            onClick={() => setPrintMode("HARIAN")}
                            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${printMode === "HARIAN"
                                ? "bg-white text-blue-700 shadow-xs font-bold"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <span>📄</span>
                            <span>Cetak Per Hari (1 Lembar)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrintMode("MINGGUAN")}
                            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${printMode === "MINGGUAN"
                                ? "bg-white text-blue-700 shadow-xs font-bold"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <span>📅</span>
                            <span>Cetak Mingguan (Senin-Jumat)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrintMode("BULANAN")}
                            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${printMode === "BULANAN"
                                ? "bg-white text-blue-700 shadow-xs font-bold"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <span>📑</span>
                            <span>Cetak 1 Bulan Penuh</span>
                        </button>
                    </div>

                    {/* Date Navigator inside Print Modal */}
                    {printMode !== "BULANAN" ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                            <span className="text-gray-600 font-medium px-1">
                                {printMode === "MINGGUAN" ? "Pekan:" : "Hari:"}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleShiftDate(-1)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold"
                            >
                                ◀
                            </button>
                            <input
                                type="date"
                                value={currentDate}
                                onChange={(e) => setCurrentDate(e.target.value)}
                                className="h-7 px-2 bg-white border border-gray-300 rounded font-bold text-gray-900"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftDate(1)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold"
                            >
                                ▶
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentDate(getTodayYMD())}
                                className="h-7 px-2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                            >
                                Hari Ini
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 font-medium">Bulan:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="h-8 pl-2 pr-6 bg-white border border-gray-300 rounded text-xs font-bold"
                            >
                                <option value="ALL">Semua Bulan (Semester)</option>
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx} value={idx.toString()}>{name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Preview Canvas (FORMAT PERSIS GAMBAR USER PER LEMBAR A4 LANDSCAPE) */}
            <div className="flex-1 overflow-auto flex flex-col items-center pb-8 gap-8 print:gap-0 print:p-0">
                <style jsx global>{`
                    @media print {
                        @page {
                            size: A4 landscape;
                            margin: 8mm;
                        }
                        .lembar-harian {
                            page-break-after: always !important;
                            break-after: page !important;
                            margin-bottom: 0 !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                            max-width: none !important;
                            min-height: auto !important;
                        }
                    }
                `}</style>

                {dailySections.length === 0 ? (
                    <div className="bg-white shadow-2xl p-10 max-w-[1100px] w-full text-center text-gray-500 italic rounded-xl border border-gray-200">
                        Belum ada catatan agenda mengajar pada periode ini.
                    </div>
                ) : (
                    dailySections.map((sec, secIdx) => {
                        const sItems = sec.items
                        return (
                            <div
                                key={sec.ymd}
                                id={`print-section-${secIdx}`}
                                className="lembar-harian bg-white shadow-2xl p-6 sm:p-10 max-w-[1100px] w-full text-black font-sans print:shadow-none print:max-w-none print:p-0"
                                style={{ minHeight: "210mm" }}
                            >
                                {/* JUDUL UTAMA */}
                                <div className="text-center mb-6">
                                    <h1 className="text-lg sm:text-xl font-bold tracking-wide uppercase">
                                        AGENDA MENGAJAR GURU
                                    </h1>
                                    <h2 className="text-base sm:text-lg font-bold tracking-wide">
                                        (JURNAL HARIAN)
                                    </h2>
                                </div>

                                {/* IDENTITAS GURU & SEKOLAH */}
                                <div className="text-xs sm:text-sm mb-4 space-y-1">
                                    <div className="flex">
                                        <span className="w-36 font-semibold">Nama Guru</span>
                                        <span>: {teacherName}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-36 font-semibold">Nama Sekolah</span>
                                        <span>: {schoolName}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-36 font-semibold">
                                            {isModePAI ? "Mata Pelajaran" : "Kelas"}
                                        </span>
                                        <span>: {isModePAI ? subjectName : `${getKelasWord(kelas)} (${toRoman(kelas)})`}</span>
                                    </div>
                                </div>

                                {/* SUB-HEADER: HARI / TANGGAL SESUAI LEMBAR INI */}
                                <div className="text-xs sm:text-sm font-bold uppercase mb-2">
                                    <span>HARI / TANGGAL : {sec.dayName.toUpperCase()}, {sec.fullDateText.toUpperCase()}</span>
                                </div>

                                {/* TABEL FORMAT RESMI */}
                                <table className="w-full border-collapse border border-black text-xs font-sans">
                                    <thead>
                                        <tr className="bg-[#dae3f3] text-black text-center font-bold">
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-8">NO</th>
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-20">JAM PELAJARAN</th>
                                            {isModePAI && (
                                                <th rowSpan={2} className="border border-black px-2 py-2 w-12">KELAS</th>
                                            )}
                                            <th rowSpan={2} className="border border-black px-2.5 py-2 w-28 text-center">MATA PELAJARAN</th>
                                            <th rowSpan={2} className="border border-black px-3 py-2 text-center">MATERI AJAR</th>
                                            <th colSpan={3} className="border border-black px-2 py-1">KEHADIRAN SISWA</th>
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-14">JML HADIR</th>
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-14">JML TDK HADIR</th>
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-44 text-center">KET</th>
                                            <th rowSpan={2} className="border border-black px-2 py-2 w-12">PARAF</th>
                                        </tr>
                                        <tr className="bg-[#dae3f3] text-black text-center font-bold">
                                            <th className="border border-black px-1.5 py-1 w-7">S</th>
                                            <th className="border border-black px-1.5 py-1 w-7">I</th>
                                            <th className="border border-black px-1.5 py-1 w-7">A</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sItems.length === 0 ? (
                                            Array.from({ length: 6 }).map((_, emptyIdx) => (
                                                <tr key={`empty-${emptyIdx}`} className="h-8">
                                                    <td className="border border-black px-2 py-2 text-center text-gray-400">{emptyIdx + 1}</td>
                                                    <td className="border border-black px-2 py-2 text-center"></td>
                                                    {isModePAI && <td className="border border-black px-2 py-2 text-center"></td>}
                                                    <td className="border border-black px-2.5 py-2 text-center"></td>
                                                    <td className="border border-black px-3 py-2"></td>
                                                    <td className="border border-black px-1 py-2 text-center"></td>
                                                    <td className="border border-black px-1 py-2 text-center"></td>
                                                    <td className="border border-black px-1 py-2 text-center"></td>
                                                    <td className="border border-black px-2 py-2 text-center"></td>
                                                    <td className="border border-black px-2 py-2 text-center"></td>
                                                    <td className="border border-black px-2 py-2 text-center"></td>
                                                    <td className="border border-black px-2 py-2 text-center"></td>
                                                </tr>
                                            ))
                                        ) : (
                                            <>
                                                {sItems.map((item, index) => {
                                                    const s = item.jmlSakit || 0
                                                    const i = item.jmlIzin || 0
                                                    const a = item.jmlAlpha || 0
                                                    const tdkHadir = item.jmlTdkHadir !== undefined && item.jmlTdkHadir !== null ? item.jmlTdkHadir : (s + i + a)
                                                    const hadir = item.jmlHadir !== undefined && item.jmlHadir !== null ? item.jmlHadir : Math.max(0, totalSiswa - tdkHadir)

                                                    return (
                                                        <tr key={item.id} className="align-middle">
                                                            <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                                                            <td className="border border-black px-2 py-2 text-center font-semibold">
                                                                {item.jamKe}
                                                            </td>
                                                            {isModePAI && (
                                                                <td className="border border-black px-2 py-2 text-center font-bold">
                                                                    {toRoman(item.kelas || kelas)}
                                                                </td>
                                                            )}
                                                            <td className="border border-black px-2.5 py-2 text-center font-bold text-black leading-tight">
                                                                {item.mapel}
                                                            </td>
                                                            <td className="border border-black px-3 py-2 leading-snug">
                                                                {item.materi}
                                                            </td>
                                                            <td className="border border-black px-1 py-2 text-center">
                                                                {s > 0 ? s : ""}
                                                            </td>
                                                            <td className="border border-black px-1 py-2 text-center">
                                                                {i > 0 ? i : ""}
                                                            </td>
                                                            <td className="border border-black px-1 py-2 text-center">
                                                                {a > 0 ? a : ""}
                                                            </td>
                                                            <td className="border border-black px-2 py-2 text-center font-semibold">
                                                                {hadir}
                                                            </td>
                                                            <td className="border border-black px-2 py-2 text-center font-semibold">
                                                                {tdkHadir > 0 ? tdkHadir : ""}
                                                            </td>
                                                            <td className="border border-black px-2 py-1.5 text-[11px] leading-tight">
                                                                {item.siswaAbsen ? (
                                                                    <div>
                                                                        <div className="font-medium">{item.siswaAbsen}</div>
                                                                        {item.catatan && (
                                                                            <div className="text-[9.5px] text-gray-600 italic mt-0.5">
                                                                                * {item.catatan}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : item.catatan ? (
                                                                    <div className="text-[10px] text-gray-700 italic">
                                                                        * {item.catatan}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center text-gray-400">-</div>
                                                                )}
                                                            </td>
                                                            <td className="border border-black px-2 py-2 text-center font-bold">
                                                                {item.paraf || "✓"}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}

                                                {/* Baris Tambahan Kosong Bila Kurang dari 6 Baris */}
                                                {sItems.length < 6 && (
                                                    Array.from({ length: 6 - sItems.length }).map((_, emptyIdx) => (
                                                        <tr key={`empty-${emptyIdx}`} className="h-8">
                                                            <td className="border border-black px-2 py-2 text-center text-gray-400">{sItems.length + emptyIdx + 1}</td>
                                                            <td className="border border-black px-2 py-2 text-center"></td>
                                                            {isModePAI && <td className="border border-black px-2 py-2 text-center"></td>}
                                                            <td className="border border-black px-2.5 py-2 text-center"></td>
                                                            <td className="border border-black px-3 py-2"></td>
                                                            <td className="border border-black px-1 py-2 text-center"></td>
                                                            <td className="border border-black px-1 py-2 text-center"></td>
                                                            <td className="border border-black px-1 py-2 text-center"></td>
                                                            <td className="border border-black px-2 py-2 text-center"></td>
                                                            <td className="border border-black px-2 py-2 text-center"></td>
                                                            <td className="border border-black px-2 py-2 text-center"></td>
                                                            <td className="border border-black px-2 py-2 text-center"></td>
                                                        </tr>
                                                    ))
                                                )}
                                            </>
                                        )}
                                    </tbody>
                                </table>

                                {/* KOLOM TANDA TANGAN LEMBAR INI */}
                                <div className="mt-8 pt-4 break-inside-avoid text-xs sm:text-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="text-center w-72">
                                            <p className="mb-1">Mengetahui,</p>
                                            <p className="font-semibold">Kepala Sekolah</p>
                                            <div className="h-20"></div>
                                            <p className="font-bold underline uppercase">
                                                {schoolSettings?.kepalaSekolah || "-"}
                                            </p>
                                            <p className="text-[11px] mt-0.5">
                                                {schoolSettings?.nipKepsek ? `NIP. ${schoolSettings.nipKepsek}` : "-"}
                                            </p>
                                        </div>

                                        <div className="text-center w-72">
                                            <p className="mb-1">
                                                Wanayasa, {sec.fullDateText}
                                            </p>
                                            <p className="font-semibold">
                                                {isModePAI ? "Guru Mata Pelajaran PAI & BP" : `Guru Pengampu / Wali Kelas ${getKelasWord(kelas)} (${toRoman(kelas)})`}
                                            </p>
                                            <div className="h-20"></div>
                                            <p className="font-bold underline uppercase">
                                                {teacherName}
                                            </p>
                                            <p className="text-[11px] mt-0.5">
                                                NIP. {isModePAI ? "196607101986102010" : (waliKelas?.nip && waliKelas.nip !== "-" ? waliKelas.nip : "-")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
