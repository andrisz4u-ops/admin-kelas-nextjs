"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

const PRESET_TIMES = [
    { jam: 0, waktu: "06.25 - 07.00" },
    { jam: 1, waktu: "07.00 - 07.35" },
    { jam: 2, waktu: "07.35 - 08.10" },
    { jam: 3, waktu: "08.10 - 08.45" },
    { jam: 4, waktu: "08.45 - 09.20" },
    // Istirahat 09.20 - 09.40
    { jam: 5, waktu: "09.40 - 10.15" },
    { jam: 6, waktu: "10.15 - 10.50" },
    { jam: 7, waktu: "10.50 - 11.25" },
    { jam: 8, waktu: "11.25 - 12.00" },
    { jam: 9, waktu: "12.00 - 12.35" },
]

interface ScheduleItem {
    id: string
    kelas: number
    hari: string
    jamKe: number
    waktu: string
    mapel: string
    guru: string | null
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]

export default function JadwalPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isGuruMapel = session?.user?.role === "guru_mapel"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const isGuru = session?.user?.role === "guru" || isGuruMapel
    const canSelectKelas = isAdmin || isGuruMapel || isPengawas || isKepsek
    const isReadOnly = isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [kelas, setKelas] = useState<number>(userKelas || 1)

    // Lock kelas untuk wali kelas biasa, izinkan admin, pengawas, kepsek, guru_mapel pilih kelas
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas && [1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                setKelas(Number(qKelas))
                return
            }
        }
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        } else if (!kelas) {
            setKelas(userKelas || 1)
        }
    }, [canSelectKelas, userKelas, kelas])


    const [schedule, setSchedule] = useState<ScheduleItem[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null)

    // Delete confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [itemToDelete, setItemToDelete] = useState<string | null>(null)


    const fetchSchedule = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/jadwal?kelas=${kelas}`)
            if (res.ok) {
                const data = await res.json()
                setSchedule(data)
            }
        } catch (error) {
            toast.error("Gagal memuat jadwal")
        } finally {
            setLoading(false)
        }
    }, [kelas])

    useEffect(() => {
        if (kelas) fetchSchedule()
    }, [fetchSchedule, kelas])

    // Use Preset Times for rows
    const rows = PRESET_TIMES

    const getScheduleItem = (day: string, jam: number) => {
        return schedule.find(s => s.hari === day && s.jamKe === jam)
    }

    // Helper to get time text for a row (take from preset or data)
    const getTimeForRow = (jam: number) => {
        const preset = PRESET_TIMES.find(p => p.jam === jam)
        if (preset) return preset.waktu

        const item = schedule.find(s => s.jamKe === jam && s.waktu)
        return item ? item.waktu : ""
    }

    const handleCellClick = (day: string, jam: number) => {
        if (isReadOnly || (!isAdmin && !isGuru)) return // View only for supervisor/kepsek

        const existing = getScheduleItem(day, jam)
        if (existing) {
            setEditingItem(existing)
        } else {
            // New item
            // Try to pre-fill time from other cells in this row
            const existingTime = getTimeForRow(jam)
            setEditingItem({
                kelas,
                hari: day,
                jamKe: jam,
                waktu: existingTime,
                mapel: "",
                guru: ""
            })
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isReadOnly || !editingItem || !editingItem.mapel) return

        try {
            const payload = {
                ...editingItem,
                kelas // Ensure current class is used
            }

            const res = await fetch("/api/jadwal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success("Jadwal berhasil disimpan")
                setIsModalOpen(false)
                fetchSchedule()
            } else {
                toast.error("Gagal menyimpan jadwal")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    const handleDelete = async () => {
        if (isReadOnly || !itemToDelete) return
        try {
            const res = await fetch(`/api/jadwal?id=${itemToDelete}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("Jadwal dihapus")
                setIsDeleteModalOpen(false)
                setIsModalOpen(false) // Close edit modal if open (though logic separates them)
                setEditingItem(null)
                fetchSchedule()
            } else {
                toast.error("Gagal menghapus")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    // Additional Delete trigger from Edit Modal
    const promptDelete = (id: string) => {
        if (isReadOnly) return
        setItemToDelete(id)
        setIsDeleteModalOpen(true)
    }


    const handleExport = () => {
        window.open(`/api/jadwal/export?kelas=${kelas}`, '_blank')
    }

    const getSubjectColor = (mapel: string) => {
        const m = mapel.toLowerCase()
        // Format: BG Strong, Text White for high contrast
        if (m.includes("upacara")) return "bg-gray-600 text-white"
        if (m.includes("indonesia")) return "bg-blue-600 text-white"
        if (m.includes("ipas")) return "bg-emerald-600 text-white"
        if (m.includes("mtk") || m.includes("matematika")) return "bg-red-600 text-white"
        if (m.includes("pancasila")) return "bg-amber-500 text-black" // Yellow needs black text for contrast
        if (m.includes("seni")) return "bg-pink-600 text-white"
        if (m.includes("sunda")) return "bg-cyan-600 text-white"
        if (m.includes("pai")) return "bg-green-600 text-white"
        if (m.includes("pjok") || m.includes("senam")) return "bg-orange-500 text-white"
        if (m.includes("inggris")) return "bg-indigo-600 text-white"
        if (m.includes("p5")) return "bg-lime-600 text-white"
        if (m.includes("kaulinan")) return "bg-yellow-600 text-white"
        if (m.includes("koding")) return "bg-violet-600 text-white"
        if (m.includes("literasi")) return "bg-sky-600 text-white"
        return "bg-white text-gray-900 border-l-4 border-gray-300" // Fallback
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Jadwal Pelajaran Kelas {kelas}</h1>
                        {isReadOnly && (
                            <span className="px-2.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                                Mode Supervisi (Hanya Lihat)
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        {isReadOnly ? "Pemantauan jadwal mata pelajaran mingguan (Senin - Jumat)" : "Atur jadwal mata pelajaran mingguan (Senin - Jumat)"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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

                    <button
                        onClick={handleExport}
                        className="h-9 px-4 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Schedule Grid */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-[var(--accents-1)]">
                                <th className="border border-[var(--border)] px-2 py-2 font-medium text-[var(--accents-5)] w-12 text-center text-xs">Jam</th>
                                <th className="border border-[var(--border)] px-2 py-2 font-medium text-[var(--accents-5)] w-24 text-center text-xs">Waktu</th>
                                {DAYS.map(day => (
                                    <th key={day} className="border border-[var(--border)] px-2 py-2 font-medium text-[var(--foreground)] text-center min-w-[100px] text-sm">
                                        {day}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <Fragment key={row.jam}>
                                    {/* Insert Break after Jam 4 */}
                                    {row.jam === 5 && (
                                        <tr className="bg-[var(--accents-2)]">
                                            <td className="border border-[var(--border)] px-2 py-2 text-center font-bold text-[var(--accents-6)] bg-gray-200" colSpan={2}>
                                                09.20 - 09.40
                                            </td>
                                            <td className="border border-[var(--border)] px-2 py-2 text-center font-bold text-[var(--accents-6)] bg-gray-200 tracking-widest" colSpan={5}>
                                                ISTIRAHAT
                                            </td>
                                        </tr>
                                    )}
                                    <tr key={row.jam} className="hover:bg-gray-50">
                                        <td className="border border-[var(--border)] px-2 py-3 text-center font-bold text-[var(--accents-4)]">
                                            {row.jam === 0 ? "" : row.jam}
                                        </td>
                                        <td className="border border-[var(--border)] px-2 py-3 text-center text-[var(--accents-6)] text-xs">
                                            {row.waktu}
                                        </td>
                                        {DAYS.map(day => {
                                            const item = getScheduleItem(day, row.jam)
                                            return (
                                                <td
                                                    key={day}
                                                    onClick={() => handleCellClick(day, row.jam)}
                                                    className={`border border-[var(--border)] px-2 py-2 cursor-pointer transition-colors relative group h-20 align-top
                                                        ${item ? `${getSubjectColor(item.mapel)} hover:brightness-95` : 'bg-gray-50/50 hover:bg-gray-100'}
                                                    `}
                                                >
                                                    {item ? (
                                                        <div className="flex flex-col h-full justify-center text-center gap-1">
                                                            <span className="font-semibold line-clamp-2 leading-tight">
                                                                {item.mapel}
                                                            </span>
                                                            {item.guru && (
                                                                <span className="text-[10px] opacity-75 italic line-clamp-1">
                                                                    ({item.guru})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <span className="text-[10px] text-[var(--accents-4)]">+</span>
                                                        </div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit/Add Modal */}
            {isModalOpen && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <form onSubmit={handleSave}>
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg">
                                    {editingItem.id ? "Edit Jadwal" : "Tambah Jadwal"}
                                </h3>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">✕</button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hari</label>
                                        <input type="text" value={editingItem.hari} disabled className="w-full px-3 py-2 bg-gray-100 border rounded-md text-sm text-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Jam Ke</label>
                                        <input type="number" value={editingItem.jamKe}
                                            onChange={e => setEditingItem({ ...editingItem, jamKe: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-black outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Waktu (Contoh: 07:00 - 07:35)</label>
                                    <input
                                        type="text"
                                        value={editingItem.waktu || ""}
                                        onChange={e => setEditingItem({ ...editingItem, waktu: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-black outline-none"
                                        placeholder="HH:MM - HH:MM"
                                        required
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">* Waktu akan tersimpan untuk semua jadwal di jam ke-{editingItem.jamKe || "?"}</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mata Pelajaran</label>
                                    <input
                                        type="text"
                                        value={editingItem.mapel || ""}
                                        onChange={e => setEditingItem({ ...editingItem, mapel: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-black outline-none"
                                        placeholder="Contoh: Matematika"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Guru (Opsional)</label>
                                    <input
                                        type="text"
                                        value={editingItem.guru || ""}
                                        onChange={e => setEditingItem({ ...editingItem, guru: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-black outline-none"
                                        placeholder="Nama Guru Pengampu"
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
                                {editingItem.id ? (
                                    <button
                                        type="button"
                                        onClick={() => promptDelete(editingItem.id!)}
                                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        Hapus
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-md transition-colors"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-xs overflow-hidden p-6 text-center">
                        <h3 className="font-bold text-lg mb-2">Hapus Jadwal?</h3>
                        <p className="text-sm text-gray-500 mb-6">Tindakan ini tidak dapat dibatalkan.</p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
