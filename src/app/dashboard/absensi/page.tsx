"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { getWIBDateString } from "@/lib/dateUtils"

interface Siswa {
    id: string
    nis: string
    nama: string
}

interface AbsensiData {
    [studentId: string]: string
}

export default function AbsensiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isGuruMapel = session?.user?.role === "guru_mapel"
    const canSelectKelas = isAdmin || isGuruMapel  // Admin dan guru_mapel bisa pilih kelas
    const userKelas = session?.user?.kelas

    const [siswa, setSiswa] = useState<Siswa[]>([])
    const [absensi, setAbsensi] = useState<AbsensiData>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [kelas, setKelas] = useState(userKelas || 1)  // Default ke kelas 1 untuk guru_mapel
    const [tanggal, setTanggal] = useState(getWIBDateString())

    // Lock kelas untuk guru biasa saja
    useEffect(() => {
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        }
    }, [canSelectKelas, userKelas])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const [siswaRes, absensiRes] = await Promise.all([
                fetch(`/api/siswa?kelas=${kelas}`),
                fetch(`/api/absensi?kelas=${kelas}&tanggal=${tanggal}`)
            ])
            const siswaData = await siswaRes.json()
            const absensiData = await absensiRes.json()
            setSiswa(siswaData)
            setAbsensi(absensiData.reduce((acc: AbsensiData, a: { siswaId: string; status: string }) => {
                acc[a.siswaId] = a.status
                return acc
            }, {}))
        } catch {
            toast.error("Gagal memuat data")
        } finally {
            setLoading(false)
        }
    }, [kelas, tanggal])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleStatusChange = (studentId: string, status: string) => {
        setAbsensi((prev) => ({ ...prev, [studentId]: status }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const entries = Object.entries(absensi).map(([siswaId, status]) => ({
                siswaId,
                status,
                tanggal,
            }))
            const res = await fetch("/api/absensi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries, kelas }),
            })
            if (res.ok) {
                toast.success("Absensi berhasil disimpan!")
            } else {
                toast.error("Gagal menyimpan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const statusOptions = [
        { value: "H", label: "H", color: "bg-emerald-600" },
        { value: "S", label: "S", color: "bg-amber-600" },
        { value: "I", label: "I", color: "bg-blue-600" },
        { value: "A", label: "A", color: "bg-red-600" },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Daftar Hadir Kelas {kelas}</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">Kelola absensi harian siswa</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Class Selector untuk admin dan guru_mapel */}
                    {canSelectKelas ? (
                        <div className="relative">
                            <select
                                value={kelas}
                                onChange={(e) => setKelas(Number(e.target.value))}
                                className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                            >
                                {[1, 2, 3, 4, 5, 6].map((k) => (<option key={k} value={k}>Kelas {k}</option>))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </div>
                    ) : (
                        <span className="h-9 px-3 flex items-center bg-[var(--accents-2)] border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground)]">
                            Kelas {kelas}
                        </span>
                    )}

                    {/* Day indicator */}
                    <span className="h-9 px-3 flex items-center bg-blue-50 border border-blue-200 rounded-md text-sm font-semibold text-blue-700">
                        {new Date(tanggal).toLocaleDateString("id-ID", { weekday: "long" })}
                    </span>

                    <input
                        type="date"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        className="h-9 px-3 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black"
                    />

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-9 px-4 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            "Simpan Perubahan"
                        )}
                    </button>
                </div>
            </div>

            {/* Legend & Bulk Action */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs">
                    {statusOptions.map((s) => (
                        <div key={s.value} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-[var(--border)] bg-white">
                            <div className={`w-2 h-2 rounded-full ${s.color.replace("bg-", "bg-").replace("600", "500")}`} />
                            <span className="font-medium text-[var(--accents-6)]">{s.value === "H" ? "Hadir" : s.value === "S" ? "Sakit" : s.value === "I" ? "Izin" : "Alpha"}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => {
                        const newAbsensi: AbsensiData = { ...absensi }
                        siswa.forEach(s => newAbsensi[s.id] = "H")
                        setAbsensi(newAbsensi)
                        toast.success("Semua siswa ditandai Hadir")
                    }}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5 6 4.5 9 9.5 3"></polyline></svg>
                    Mark All Hadir
                </button>
            </div>

            {/* Table - Turbo Card */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-14 text-center">No</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-28">NIS</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-48">Status Kehadiran</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {loading ? (
                                <tr><td colSpan={4} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                            ) : siswa.length === 0 ? (
                                <tr><td colSpan={4} className="px-4 py-12 text-center text-[var(--accents-5)]">Belum ada data siswa di kelas ini</td></tr>
                            ) : (
                                siswa.map((s, i) => (
                                    <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors">
                                        <td className="px-4 py-2.5 text-[var(--accents-5)] text-center tabular-nums">{i + 1}</td>
                                        <td className="px-4 py-2.5 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                        <td className="px-4 py-2.5 text-[var(--foreground)] font-medium">{s.nama}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                {statusOptions.map((opt) => {
                                                    const isActive = absensi[s.id] === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => handleStatusChange(s.id, opt.value)}
                                                            className={`w-10 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all duration-150 ${isActive
                                                                ? `${opt.color} text-white shadow-sm scale-105`
                                                                : "bg-[var(--accents-1)] text-[var(--accents-5)] hover:bg-[var(--accents-2)] hover:text-[var(--foreground)] border border-[var(--border)]"
                                                                }`}
                                                            title={opt.value === "H" ? "Hadir" : opt.value === "S" ? "Sakit" : opt.value === "I" ? "Izin" : "Alpha"}
                                                        >
                                                            {isActive ? (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            ) : (
                                                                opt.label
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
