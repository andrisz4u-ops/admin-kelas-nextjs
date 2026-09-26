"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { getAcademicYearOptions } from "@/lib/academicYear"

interface NilaiByMapel {
    [mapel: string]: { [jenis: string]: number }
}

interface MapelAverages {
    [mapel: string]: number
}

interface RekapSiswa {
    id: string
    nis: string
    nama: string
    nilaiByMapel: NilaiByMapel
    mapelAverages: MapelAverages
    overallAverage: number
}

interface RekapMeta {
    kelas: number
    semester: number
    mapelList: string[]
    jenisNilaiList: string[]
    selectedMapel: string
}

const KKM = 70

export default function RekapNilaiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [recap, setRecap] = useState<RekapSiswa[]>([])
    const [meta, setMeta] = useState<RekapMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [kelas, setKelas] = useState(userKelas || 1)
    const [semester, setSemester] = useState(1)
    const [tahunAjaran, setTahunAjaran] = useState("2026/2027")
    const [selectedMapel, setSelectedMapel] = useState("")
    const [viewMode, setViewMode] = useState<"summary" | "detail">("summary")

    const yearOptions = useMemo(() => getAcademicYearOptions(tahunAjaran), [tahunAjaran])

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas && [1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                setKelas(Number(qKelas))
            }
        }
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        }

        // Ambil semester dan tahun ajaran aktif dari pengaturan sekolah
        fetch("/api/settings/school")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.semesterAktif) {
                    setSemester(Number(data.semesterAktif))
                }
                if (data?.tahunAjaran) {
                    setTahunAjaran(data.tahunAjaran)
                }
            })
            .catch(() => {})
    }, [canSelectKelas, userKelas])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                kelas: kelas.toString(),
                semester: semester.toString(),
                mapel: selectedMapel,
                tahunAjaran,
            })
            const res = await fetch(`/api/rekap/nilai?${params}`, { cache: "no-store" })
            const data = await res.json()
            setRecap(data.recap)
            setMeta(data.meta)
        } catch {
            toast.error("Gagal memuat data rekap")
        } finally {
            setLoading(false)
        }
    }, [kelas, semester, selectedMapel, tahunAjaran])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleExportSummary = () => {
        if (recap.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        const mapelList = meta?.mapelList || []

        const data = recap.map((s, i) => {
            const row: { [key: string]: string | number } = {
                No: i + 1,
                NIS: s.nis,
                "Nama Siswa": s.nama,
            }
            mapelList.forEach((m) => {
                row[m] = s.mapelAverages[m] ?? "-"
            })
            row["Rata-rata"] = s.overallAverage
            row["Keterangan"] = s.overallAverage >= KKM ? "Tuntas" : "Belum Tuntas"
            return row
        })

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai")
        XLSX.writeFile(wb, `Rekap_Nilai_Kelas${kelas}_${tahunAjaran.replace(/\//g, "-")}_Semester${semester}.xlsx`)
        toast.success("Data berhasil diexport!")
    }

    const handleExportDetail = () => {
        if (recap.length === 0 || !selectedMapel) {
            toast.error("Pilih mapel dan pastikan ada data")
            return
        }

        const jenisNilaiList = meta?.jenisNilaiList || []

        const data = recap.map((s, i) => {
            const row: { [key: string]: string | number } = {
                No: i + 1,
                NIS: s.nis,
                "Nama Siswa": s.nama,
            }
            jenisNilaiList.forEach((j) => {
                row[j] = s.nilaiByMapel[selectedMapel]?.[j] ?? "-"
            })
            row["Rata-rata"] = s.mapelAverages[selectedMapel] ?? "-"
            return row
        })

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, selectedMapel)
        XLSX.writeFile(wb, `Nilai_${selectedMapel.replace(/\s/g, "_")}_Kelas${kelas}_${tahunAjaran.replace(/\//g, "-")}_Semester${semester}.xlsx`)
        toast.success("Data berhasil diexport!")
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Rekapitulasi Nilai</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">Download rekap nilai per semester dan mata pelajaran</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Class selector */}
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

                    {/* Tahun Ajaran selector */}
                    <div className="relative">
                        <select
                            value={tahunAjaran}
                            onChange={(e) => setTahunAjaran(e.target.value)}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none font-medium"
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>TP {y}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

                    {/* Semester selector */}
                    <div className="relative">
                        <select
                            value={semester}
                            onChange={(e) => setSemester(Number(e.target.value))}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                        >
                            <option value={1}>Semester 1</option>
                            <option value={2}>Semester 2</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

                    {/* View mode toggle */}
                    <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                        <button
                            onClick={() => setViewMode("summary")}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${viewMode === "summary" ? "bg-black text-white" : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"}`}
                        >
                            Ringkasan
                        </button>
                        <button
                            onClick={() => setViewMode("detail")}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${viewMode === "detail" ? "bg-black text-white" : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"}`}
                        >
                            Per Mapel
                        </button>
                    </div>

                    {/* Mapel selector (for detail view) */}
                    {viewMode === "detail" && meta && (
                        <div className="relative">
                            <select
                                value={selectedMapel}
                                onChange={(e) => setSelectedMapel(e.target.value)}
                                className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none min-w-[150px]"
                            >
                                <option value="">-- Pilih Mapel --</option>
                                {meta.mapelList.map((m) => (<option key={m} value={m}>{m}</option>))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </div>
                    )}

                    {/* Export button */}
                    <button
                        onClick={viewMode === "summary" ? handleExportSummary : handleExportDetail}
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

            {/* Summary View */}
            {viewMode === "summary" && (
                <div className="turbo-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-12">No</th>
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-24">NIS</th>
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-48">Nama Siswa</th>
                                    {meta?.mapelList.map((m) => (
                                        <th key={m} className="px-3 py-3 font-medium text-[var(--accents-5)] text-center w-16" title={m}>
                                            {m.length > 6 ? m.slice(0, 4) + ".." : m}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-20 bg-[var(--accents-2)]">Rata²</th>
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-24">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {loading ? (
                                    <tr><td colSpan={12} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                                ) : recap.length === 0 ? (
                                    <tr><td colSpan={12} className="px-4 py-12 text-center text-[var(--accents-5)]">Belum ada data</td></tr>
                                ) : (
                                    recap.map((s, i) => (
                                        <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors">
                                            <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                            <td className="px-4 py-3 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                            <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                            {meta?.mapelList.map((m) => {
                                                const val = s.mapelAverages[m]
                                                return (
                                                    <td key={m} className={`px-3 py-3 text-center font-bold tabular-nums ${val !== undefined ? (val >= KKM ? "text-emerald-600" : "text-red-600") : "text-[var(--accents-4)]"}`}>
                                                        {val ?? "-"}
                                                    </td>
                                                )
                                            })}
                                            <td className="px-4 py-3 text-center font-bold tabular-nums text-[var(--foreground)] bg-[var(--accents-1)]">{s.overallAverage || "-"}</td>
                                            <td className="px-4 py-3 text-center">
                                                {s.overallAverage > 0 && (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${s.overallAverage >= KKM ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                                        {s.overallAverage >= KKM ? "Tuntas" : "Belum"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail View (Per Mapel) */}
            {viewMode === "detail" && (
                <div className="turbo-card overflow-hidden">
                    {!selectedMapel ? (
                        <div className="px-4 py-12 text-center text-[var(--accents-5)]">Silakan pilih Mata Pelajaran</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-12">No</th>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-24">NIS</th>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                                        {meta?.jenisNilaiList.map((j) => (
                                            <th key={j} className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">{j}</th>
                                        ))}
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-20 bg-[var(--accents-2)]">Rata²</th>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-24">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {loading ? (
                                        <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                                    ) : recap.length === 0 ? (
                                        <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--accents-5)]">Belum ada data</td></tr>
                                    ) : (
                                        recap.map((s, i) => {
                                            const mapelNilai = s.nilaiByMapel[selectedMapel] || {}
                                            const avg = s.mapelAverages[selectedMapel]
                                            return (
                                                <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors">
                                                    <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                                    <td className="px-4 py-3 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                                    <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                                    {meta?.jenisNilaiList.map((j) => {
                                                        const val = mapelNilai[j]
                                                        return (
                                                            <td key={j} className={`px-4 py-3 text-center font-bold tabular-nums ${val !== undefined ? (val >= KKM ? "text-emerald-600" : "text-red-600") : "text-[var(--accents-4)]"}`}>
                                                                {val ?? "-"}
                                                            </td>
                                                        )
                                                    })}
                                                    <td className="px-4 py-3 text-center font-bold tabular-nums text-[var(--foreground)] bg-[var(--accents-1)]">{avg ?? "-"}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {avg !== undefined && (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${avg >= KKM ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                                                {avg >= KKM ? "Tuntas" : "Belum"}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-[var(--accents-5)]">
                <span>KKM: <span className="font-bold text-[var(--foreground)]">{KKM}</span></span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
                    <span>≥ KKM (Tuntas)</span>
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                    <span>&lt; KKM (Belum Tuntas)</span>
                </span>
            </div>
        </div>
    )
}
