"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { getMapelByKelas, isExclusiveMapel, getMapelForGuruMapel } from "@/lib/mapelConfig"
import { getAcademicYearOptions } from "@/lib/academicYear"

interface Siswa {
    id: string
    nis: string
    nama: string
}

interface NilaiData {
    [studentId: string]: number
}

const jenisNilaiList = ["UH1", "UH2", "UH3", "UTS", "UAS"]
const KKM = 70

export default function NilaiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isGuruMapel = session?.user?.role === "guru_mapel"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isGuruMapel || isPengawas || isKepsek
    const isReadOnly = isPengawas || isKepsek
    const userKelas = session?.user?.kelas
    const userMapelDiampu = session?.user?.mapelDiampu

    const [siswa, setSiswa] = useState<Siswa[]>([])
    const [nilai, setNilai] = useState<NilaiData>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [kelas, setKelas] = useState(userKelas || 1)
    const [semester, setSemester] = useState(1)
    const [tahunAjaran, setTahunAjaran] = useState("2026/2027")
    const [mapel, setMapel] = useState("")
    const [jenisNilai, setJenisNilai] = useState("")

    const yearOptions = useMemo(() => getAcademicYearOptions(tahunAjaran), [tahunAjaran])

    // Get subjects for current class, filtered by role
    const mapelList = useMemo(() => {
        // Guru mapel: only their assigned subjects
        if (isGuruMapel && userMapelDiampu) {
            return getMapelForGuruMapel(userMapelDiampu)
        }
        // Admin, Pengawas, Kepsek: all subjects
        if (isAdmin || isPengawas || isKepsek) {
            return getMapelByKelas(kelas)
        }
        // Regular guru: all except exclusive subjects (AKPK, PAI)
        return getMapelByKelas(kelas).filter(m => !isExclusiveMapel(m))
    }, [kelas, isAdmin, isPengawas, isKepsek, isGuruMapel, userMapelDiampu])

    // Cek query param ?kelas= dan lock kelas untuk guru biasa saja, serta load semester dan tahun ajaran aktif
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
        if (!mapel || !jenisNilai) return
        try {
            setLoading(true)
            const [siswaRes, nilaiRes] = await Promise.all([
                fetch(`/api/siswa?kelas=${kelas}`),
                fetch(`/api/nilai?kelas=${kelas}&mapel=${encodeURIComponent(mapel)}&jenisNilai=${jenisNilai}&semester=${semester}&tahunAjaran=${encodeURIComponent(tahunAjaran)}`)
            ])
            const siswaData = await siswaRes.json()
            const nilaiData = await nilaiRes.json()
            setSiswa(siswaData)
            setNilai(nilaiData.reduce((acc: NilaiData, n: { siswaId: string; nilai: number }) => {
                acc[n.siswaId] = n.nilai
                return acc
            }, {}))
        } catch {
            toast.error("Gagal memuat data")
        } finally {
            setLoading(false)
        }
    }, [kelas, mapel, jenisNilai, semester, tahunAjaran])

    useEffect(() => {
        if (mapel && jenisNilai) fetchData()
    }, [fetchData, mapel, jenisNilai, semester, tahunAjaran])

    const handleNilaiChange = (studentId: string, value: string) => {
        if (isReadOnly) return
        const num = parseInt(value)
        if (value === "" || (num >= 0 && num <= 100)) {
            setNilai((prev) => ({ ...prev, [studentId]: num }))
        }
    }

    const handleSave = async () => {
        if (isReadOnly) return
        if (!mapel || !jenisNilai) { toast.error("Pilih mapel dan jenis nilai"); return }
        setSaving(true)
        try {
            const entries = Object.entries(nilai).filter(([, v]) => !isNaN(v)).map(([siswaId, nilaiValue]) => ({
                siswaId, mapel, jenisNilai, nilai: nilaiValue, semester, kelas, tahunAjaran
            }))
            const res = await fetch("/api/nilai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries, semester, kelas, tahunAjaran }),
            })
            if (res.ok) toast.success("Nilai berhasil disimpan!")
            else {
                const errData = await res.json().catch(() => null)
                toast.error(errData?.error || "Gagal menyimpan")
            }
        } catch { toast.error("Terjadi kesalahan") }
        finally { setSaving(false) }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Daftar Nilai Kelas {kelas}</h1>
                        {isReadOnly && (
                            <span className="px-2.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                                Mode Supervisi (Pemantauan)
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        {isReadOnly ? "Pemantauan hasil penilaian capaian siswa per mata pelajaran" : "Input penilaian siswa per mata pelajaran"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Class Selector untuk admin, guru_mapel, pengawas, kepsek */}
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

                    {/* Semester Selector */}
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

                    <div className="relative">
                        <select
                            value={mapel}
                            onChange={(e) => setMapel(e.target.value)}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none min-w-[150px]"
                        >
                            <option value="">-- Pilih Mapel --</option>
                            {mapelList.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            value={jenisNilai}
                            onChange={(e) => setJenisNilai(e.target.value)}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                        >
                            <option value="">-- Jenis Nilai --</option>
                            {jenisNilaiList.map((j) => (<option key={j} value={j}>{j}</option>))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-9 px-4 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                "Simpan"
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Table - Turbo Card */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-16">No</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-32">NIS</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-32">Nilai (0-100)</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-40">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {!mapel || !jenisNilai ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--accents-5)]">Silakan pilih Mata Pelajaran dan Jenis Nilai terlebih dahulu</td></tr>
                            ) : loading ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                            ) : siswa.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--accents-5)]">Belum ada data siswa</td></tr>
                            ) : (
                                siswa.map((s, i) => {
                                    const n = nilai[s.id]
                                    const tuntas = n !== undefined && n >= KKM
                                    return (
                                        <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors group">
                                            <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                            <td className="px-4 py-3 text-[var(--foreground)] font-mono text-xs">{s.nis}</td>
                                            <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="number"
                                                    min="0" max="100"
                                                    value={n ?? ""}
                                                    disabled={isReadOnly}
                                                    onChange={(e) => handleNilaiChange(s.id, e.target.value)}
                                                    className={`w-20 px-3 py-1.5 rounded text-center font-bold text-sm text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--accents-3)] ${isReadOnly
                                                        ? "bg-[var(--accents-1)] border border-[var(--border)] cursor-default"
                                                        : "bg-white border border-[var(--border)] focus:ring-1 focus:ring-black focus:border-black"
                                                        }`}
                                                    placeholder="-"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {n !== undefined && (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tuntas
                                                        ? "bg-green-100 text-green-800 border border-green-200"
                                                        : "bg-red-100 text-red-800 border border-red-200"
                                                        }`}>
                                                        {tuntas ? "Tuntas" : "Belum Tuntas"}
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
            </div>
        </div>
    )
}
