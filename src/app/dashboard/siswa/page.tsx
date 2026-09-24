"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"

interface Siswa {
    id: string
    nis: string
    nama: string
    jenisKelamin: string
    alamat?: string
    namaOrtu?: string
    noHp?: string
    kelas?: number  // For multi-class import
    status?: string  // "aktif" atau "alumni"
    tahunLulus?: string  // Tahun kelulusan untuk alumni
}

export default function SiswaPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isGuru = session?.user?.role === "guru"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isPengawas || isKepsek
    const isSupervisor = isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [siswa, setSiswa] = useState<Siswa[]>([])
    const [loading, setLoading] = useState(true)
    const [kelas, setKelas] = useState(userKelas || 1)
    const [showModal, setShowModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null)
    const [importData, setImportData] = useState<Siswa[]>([])
    const [importAllClasses, setImportAllClasses] = useState(false)  // Multi-class import mode
    const [showAlumni, setShowAlumni] = useState(false)  // Toggle tampilan alumni
    const [alumniTahunFilter, setAlumniTahunFilter] = useState("all") // Filter tahun lulus
    const [searchQuery, setSearchQuery] = useState("") // Search NIS / Nama
    const [availableTahunLulus, setAvailableTahunLulus] = useState<string[]>([])

    const canEditSiswa = isAdmin || (isGuru && !showAlumni && kelas === userKelas)

    // Cek query param ?kelas= dan lock kelas untuk guru biasa
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
        }
    }, [canSelectKelas, userKelas])

    const fetchSiswa = useCallback(async () => {
        try {
            setLoading(true)
            const url = showAlumni
                ? `/api/siswa?status=alumni${alumniTahunFilter !== "all" ? `&tahunLulus=${encodeURIComponent(alumniTahunFilter)}` : ""}`
                : `/api/siswa?kelas=${kelas}&status=aktif`
            const res = await fetch(url, { cache: "no-store" })
            const data = await res.json()
            const studentList: Siswa[] = Array.isArray(data) ? data : []
            setSiswa(studentList)

            // Extract unique tahun kelulusan for dropdown if alumni
            if (showAlumni && alumniTahunFilter === "all") {
                const years = Array.from(new Set(studentList.map(s => s.tahunLulus).filter(Boolean))) as string[]
                if (years.length > 0) {
                    setAvailableTahunLulus(years.sort().reverse())
                }
            }
        } catch {
            toast.error("Gagal memuat data siswa")
        } finally {
            setLoading(false)
        }
    }, [kelas, showAlumni, alumniTahunFilter])

    useEffect(() => {
        fetchSiswa()
    }, [fetchSiswa])

    const handleDelete = async (id: string) => {
        if (!isAdmin) {
            toast.error("Hanya admin yang bisa menghapus siswa")
            return
        }
        if (!confirm("Hapus data siswa ini?")) return
        try {
            const res = await fetch(`/api/siswa/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Gagal menghapus siswa")
            }
            toast.success("Data siswa berhasil dihapus")
            fetchSiswa()
        } catch (error: any) {
            toast.error(error.message || "Gagal menghapus siswa")
        }
    }

    const handleExport = () => {
        const dataToExport = siswa.filter(s => {
            if (!searchQuery) return true
            return s.nama.toLowerCase().includes(searchQuery.toLowerCase()) || s.nis.includes(searchQuery)
        })

        if (dataToExport.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        if (showAlumni) {
            const data = dataToExport.map((s, i) => ({
                No: i + 1,
                NIS: s.nis,
                Nama: s.nama,
                "L/P": s.jenisKelamin,
                "Tahun Kelulusan": s.tahunLulus || "-",
                Alamat: s.alamat || "-",
                "Nama Ortu": s.namaOrtu || "-",
                "No HP": s.noHp || "-",
            }))
            const ws = XLSX.utils.json_to_sheet(data)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Data Alumni")
            const fileSuffix = alumniTahunFilter === "all" ? "Semua_Tahun" : alumniTahunFilter.replace("/", "-")
            XLSX.writeFile(wb, `Data_Alumni_${fileSuffix}.xlsx`)
            toast.success("Data alumni berhasil diexport!")
        } else {
            const data = dataToExport.map((s, i) => ({
                No: i + 1,
                NIS: s.nis,
                Nama: s.nama,
                "L/P": s.jenisKelamin,
                Alamat: s.alamat || "-",
                "Nama Ortu": s.namaOrtu || "-",
                "No HP": s.noHp || "-",
            }))
            const ws = XLSX.utils.json_to_sheet(data)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Data Siswa")
            XLSX.writeFile(wb, `Data_Siswa_Kelas${kelas}.xlsx`)
            toast.success("Data siswa aktif berhasil diexport!")
        }
    }

    const downloadTemplate = () => {
        // Sample data untuk template import dengan kolom Kelas
        const sampleData = [
            { NIS: "0001", Nama: "Ahmad Zaki", "L/P": "L", Kelas: 1, Alamat: "Jl. Merdeka No. 1", "Nama Ortu": "Budi Santoso", "No HP": "081234567890" },
            { NIS: "0002", Nama: "Siti Aminah", "L/P": "P", Kelas: 1, Alamat: "Jl. Sudirman No. 2", "Nama Ortu": "Ahmad Dahlan", "No HP": "081234567891" },
            { NIS: "0003", Nama: "Rizky Pratama", "L/P": "L", Kelas: 2, Alamat: "Jl. Gatot Subroto No. 3", "Nama Ortu": "Joko Widodo", "No HP": "081234567892" },
            { NIS: "0004", Nama: "Dewi Lestari", "L/P": "P", Kelas: 2, Alamat: "Jl. Asia Afrika No. 4", "Nama Ortu": "Sri Mulyani", "No HP": "081234567893" },
            { NIS: "0005", Nama: "Budi Setiawan", "L/P": "L", Kelas: 3, Alamat: "Jl. Diponegoro No. 5", "Nama Ortu": "Susilo Bambang", "No HP": "081234567894" },
            { NIS: "0006", Nama: "Rina Anggraini", "L/P": "P", Kelas: 3, Alamat: "Jl. Pahlawan No. 6", "Nama Ortu": "Megawati Soekarno", "No HP": "081234567895" },
            { NIS: "0007", Nama: "Andi Firmansyah", "L/P": "L", Kelas: 4, Alamat: "Jl. Kartini No. 7", "Nama Ortu": "Habibie Ainun", "No HP": "081234567896" },
            { NIS: "0008", Nama: "Maya Indah", "L/P": "P", Kelas: 4, Alamat: "Jl. Cut Nyak Dien No. 8", "Nama Ortu": "Gus Dur", "No HP": "081234567897" },
            { NIS: "0009", Nama: "Fajar Nugroho", "L/P": "L", Kelas: 5, Alamat: "Jl. RA Kartini No. 9", "Nama Ortu": "Prabowo Subianto", "No HP": "081234567898" },
            { NIS: "0010", Nama: "Putri Handayani", "L/P": "P", Kelas: 5, Alamat: "Jl. Veteran No. 10", "Nama Ortu": "Anies Baswedan", "No HP": "081234567899" },
            { NIS: "0011", Nama: "Dimas Prasetyo", "L/P": "L", Kelas: 6, Alamat: "Jl. Pemuda No. 11", "Nama Ortu": "Ridwan Kamil", "No HP": "081234567800" },
            { NIS: "0012", Nama: "Ayu Wulandari", "L/P": "P", Kelas: 6, Alamat: "Jl. Pelajar No. 12", "Nama Ortu": "Ganjar Pranowo", "No HP": "081234567801" },
        ]
        const ws = XLSX.utils.json_to_sheet(sampleData)

        // Set column widths
        ws['!cols'] = [
            { wch: 8 },   // NIS
            { wch: 25 },  // Nama
            { wch: 5 },   // L/P
            { wch: 7 },   // Kelas
            { wch: 30 },  // Alamat
            { wch: 25 },  // Nama Ortu
            { wch: 15 },  // No HP
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template Import Siswa")
        XLSX.writeFile(wb, "Template_Import_Siswa_Semua_Kelas.xlsx")
        toast.success("Template berhasil didownload!")
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAdmin) {
            toast.error("Hanya admin yang bisa import data")
            return
        }
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: "array" })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

            if (jsonData.length < 2) {
                toast.error("File tidak memiliki data")
                return
            }

            const headers = jsonData[0].map((h) => String(h).toLowerCase().trim())
            const findCol = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)))

            const colMap = {
                nis: findCol(["nis", "nisn", "no induk"]),
                nama: findCol(["nama"]),
                jk: findCol(["l/p", "jk", "jenis kelamin"]),
                alamat: findCol(["alamat"]),
                ortu: findCol(["ortu", "orang tua", "wali"]),
                hp: findCol(["hp", "telepon"]),
                kelas: findCol(["kelas", "class", "tingkat"]),  // Detect class column
            }

            // Check if file has class column for multi-class import
            const hasKelasColumn = colMap.kelas !== -1

            if (colMap.nis === -1 || colMap.nama === -1) {
                toast.error("Kolom NIS dan Nama harus ada!")
                return
            }

            const imported: Siswa[] = []
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i]
                if (!row[colMap.nama]) continue

                let jk = colMap.jk !== -1 ? String(row[colMap.jk] || "").toUpperCase() : ""
                if (jk.includes("LAKI")) jk = "L"
                if (jk.includes("PEREMPUAN")) jk = "P"

                // Get kelas value if column exists
                let studentKelas = kelas  // Default to currently selected class
                if (hasKelasColumn) {
                    const kelasVal = parseInt(String(row[colMap.kelas] || ""))
                    if (kelasVal >= 1 && kelasVal <= 6) {
                        studentKelas = kelasVal
                    }
                }

                imported.push({
                    id: "",
                    nis: String(row[colMap.nis] || "").trim(),
                    nama: String(row[colMap.nama] || "").trim(),
                    jenisKelamin: jk || "L",
                    alamat: colMap.alamat !== -1 ? String(row[colMap.alamat] || "") : "",
                    namaOrtu: colMap.ortu !== -1 ? String(row[colMap.ortu] || "") : "",
                    noHp: colMap.hp !== -1 ? String(row[colMap.hp] || "") : "",
                    kelas: studentKelas,  // Include class for each student
                })
            }

            setImportData(imported)
            setImportAllClasses(hasKelasColumn)  // Set multi-class mode if kelas column exists
            setShowImportModal(true)
        }
        reader.readAsArrayBuffer(file)
    }

    const handleImport = async (replace: boolean) => {
        try {
            const res = await fetch("/api/siswa/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ students: importData, kelas, replace, allClasses: importAllClasses }),
            })
            const result = await res.json()
            if (res.ok) {
                toast.success(result.message)
                setShowImportModal(false)
                setImportData([])
                fetchSiswa()
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Gagal import data")
        }
    }

    const displayedSiswa = siswa.filter(s => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return s.nama.toLowerCase().includes(q) || s.nis.includes(q)
    })

    return (
        <div className="space-y-6">
            {/* Top Navigation Tabs: Siswa Aktif vs Alumni */}
            <div className="flex border-b border-[var(--border)] gap-2">
                <button
                    onClick={() => {
                        setShowAlumni(false)
                        setSearchQuery("")
                    }}
                    className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        !showAlumni
                            ? "border-black text-black"
                            : "border-transparent text-[var(--accents-5)] hover:text-black"
                    }`}
                >
                    <span>👥 Siswa Aktif</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">Kelas 1 - 6</span>
                </button>
                <button
                    onClick={() => {
                        setShowAlumni(true)
                        setSearchQuery("")
                    }}
                    className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        showAlumni
                            ? "border-amber-600 text-amber-700"
                            : "border-transparent text-[var(--accents-5)] hover:text-amber-700"
                    }`}
                >
                    <span>🎓 Data Alumni</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">Lulus</span>
                </button>
            </div>

            {/* Header & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] flex items-center gap-2">
                        <span>{showAlumni ? "🎓 Direktori Alumni SDN 2 Nangerang" : `Data Siswa Kelas ${kelas}`}</span>
                        {isSupervisor && !showAlumni && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                                Mode Supervisi
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        {showAlumni
                            ? `Arsip siswa yang telah lulus (${displayedSiswa.length} alumni ditampilkan)`
                            : isSupervisor ? `Supervisi data siswa aktif (${displayedSiswa.length} siswa)` : isAdmin ? `Kelola data siswa aktif (${displayedSiswa.length} siswa)` : `Daftar siswa aktif kelas ${kelas}`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Mode Alumni: Filter Tahun & Search */}
                    {showAlumni ? (
                        <>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Cari nama / NIS alumni..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 px-3 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black w-48 sm:w-56"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={alumniTahunFilter}
                                    onChange={(e) => setAlumniTahunFilter(e.target.value)}
                                    className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                >
                                    <option value="all">Semua Angkatan</option>
                                    {availableTahunLulus.map((thn) => (
                                        <option key={thn} value={thn}>Lulus {thn}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Mode Siswa Aktif: Dropdown Kelas */}
                            {canSelectKelas ? (
                                <div className="relative">
                                    <select
                                        value={kelas}
                                        onChange={(e) => setKelas(Number(e.target.value))}
                                        className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                    >
                                        {[1, 2, 3, 4, 5, 6].map((k) => (
                                            <option key={k} value={k}>Kelas {k}</option>
                                        ))}
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

                            {/* Tombol tambah, import hanya untuk admin di mode aktif */}
                            {isAdmin && (
                                <>
                                    <button onClick={() => { setEditingSiswa(null); setShowModal(true) }} className="h-9 px-3 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
                                        + Tambah
                                    </button>
                                    <button onClick={downloadTemplate} className="h-9 px-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        Template
                                    </button>
                                    <label className="h-9 px-3 bg-white border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium hover:bg-[var(--accents-1)] transition-colors cursor-pointer flex items-center gap-2">
                                        <span>Import Excel</span>
                                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </>
                            )}
                        </>
                    )}

                    {/* Export button */}
                    <button onClick={handleExport} className="h-9 px-3 bg-white border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium hover:bg-[var(--accents-1)] transition-colors flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-12">No</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-28">NIS</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-16">L/P</th>
                                {showAlumni ? (
                                    <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Tahun Kelulusan</th>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Alamat</th>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Ortu</th>
                                        <th className="px-4 py-3 font-medium text-[var(--accents-5)]">No. HP</th>
                                    </>
                                )}
                                {canEditSiswa && <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-right">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {loading ? (
                                <tr><td colSpan={canEditSiswa ? 8 : 7} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                            ) : displayedSiswa.length === 0 ? (
                                <tr><td colSpan={canEditSiswa ? 8 : 7} className="px-4 py-12 text-center text-[var(--accents-5)]">
                                    {showAlumni ? "Belum ada data alumni untuk angkatan ini" : "Belum ada data siswa di kelas ini"}
                                </td></tr>
                            ) : (
                                displayedSiswa.map((s, i) => (
                                    <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors group">
                                        <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                        <td className="px-4 py-3 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                        <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                        <td className="px-4 py-3 text-[var(--accents-6)]">{s.jenisKelamin}</td>
                                        {showAlumni ? (
                                            <td className="px-4 py-3">
                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                                    🎓 Angkatan {s.tahunLulus || "-"}
                                                </span>
                                            </td>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 text-[var(--accents-5)] truncate max-w-[150px]">{s.alamat || "-"}</td>
                                                <td className="px-4 py-3 text-[var(--accents-5)] truncate max-w-[150px]">{s.namaOrtu || "-"}</td>
                                                <td className="px-4 py-3 text-[var(--accents-5)] font-medium tabular-nums">{s.noHp || "-"}</td>
                                            </>
                                        )}
                                        {canEditSiswa && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!showAlumni && (
                                                        <button
                                                            onClick={() => { setEditingSiswa(s); setShowModal(true) }}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDelete(s.id)}
                                                            className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                        >
                                                            Hapus
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal - untuk admin & wali kelas */}
            {showModal && (isAdmin || (isGuru && kelas === userKelas)) && (
                <SiswaModal
                    siswa={editingSiswa}
                    kelas={kelas}
                    isAdmin={isAdmin}
                    onClose={() => setShowModal(false)}
                    onSave={() => { setShowModal(false); fetchSiswa() }}
                />
            )}

            {/* Import Preview Modal */}
            {showImportModal && isAdmin && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-[var(--border)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--accents-1)]">
                            <div>
                                <h2 className="text-lg font-semibold">Preview Import ({importData.length} siswa)</h2>
                                {importAllClasses ? (
                                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                                        Mode: Import ke Semua Kelas (1-6)
                                    </p>
                                ) : (
                                    <p className="text-xs text-[var(--accents-5)] mt-1">Target: Kelas {kelas}</p>
                                )}
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="text-[var(--accents-5)] hover:text-black">✕</button>
                        </div>
                        {/* Summary per class for multi-class import */}
                        {importAllClasses && (
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5, 6].map(k => {
                                    const count = importData.filter(s => s.kelas === k).length
                                    if (count === 0) return null
                                    return (
                                        <span key={k} className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700">
                                            Kelas {k}: {count} siswa
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                        <div className="p-0 overflow-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[var(--accents-1)] sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium text-[var(--accents-5)]">No</th>
                                        {importAllClasses && <th className="px-4 py-2 font-medium text-[var(--accents-5)]">Kelas</th>}
                                        <th className="px-4 py-2 font-medium text-[var(--accents-5)]">NIS</th>
                                        <th className="px-4 py-2 font-medium text-[var(--accents-5)]">Nama</th>
                                        <th className="px-4 py-2 font-medium text-[var(--accents-5)]">L/P</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {importData.map((s, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-2 text-[var(--accents-5)]">{i + 1}</td>
                                            {importAllClasses && <td className="px-4 py-2 font-semibold text-blue-600">{s.kelas}</td>}
                                            <td className="px-4 py-2 font-mono text-xs">{s.nis}</td>
                                            <td className="px-4 py-2">{s.nama}</td>
                                            <td className="px-4 py-2">{s.jenisKelamin}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--accents-1)]">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black">Batal</button>
                            <button onClick={() => handleImport(false)} className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800">Tambahkan</button>
                            <button onClick={() => handleImport(true)} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">
                                {importAllClasses ? "Ganti Semua Kelas" : "Ganti Semua"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SiswaModal({ siswa, kelas, isAdmin, onClose, onSave }: { siswa: Siswa | null; kelas: number; isAdmin: boolean; onClose: () => void; onSave: () => void }) {
    const [form, setForm] = useState({
        nis: siswa?.nis || "",
        nama: siswa?.nama || "",
        jenisKelamin: siswa?.jenisKelamin || "L",
        alamat: siswa?.alamat || "",
        namaOrtu: siswa?.namaOrtu || "",
        noHp: siswa?.noHp || "",
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const url = siswa ? `/api/siswa/${siswa.id}` : "/api/siswa"
            const method = siswa ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, kelas }),
            })
            if (res.ok) {
                toast.success(siswa ? "Data diperbarui!" : "Siswa ditambahkan!")
                onSave()
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal menyimpan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[var(--border)] rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--accents-1)]">
                    <h2 className="text-lg font-semibold">{siswa ? "Edit Siswa" : "Tambah Siswa"}</h2>
                    <button onClick={onClose} className="text-[var(--accents-5)] hover:text-black">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">
                            NIS {!isAdmin && <span className="text-gray-400 font-normal">(Terkunci untuk Wali Kelas)</span>}
                        </label>
                        <input
                            type="text"
                            value={form.nis}
                            disabled={!isAdmin}
                            onChange={(e) => setForm({ ...form, nis: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Nama Lengkap</label>
                        <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black" required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Jenis Kelamin</label>
                        <select value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black">
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Alamat</label>
                        <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black" rows={2}></textarea>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Nama Orang Tua</label>
                        <input type="text" value={form.namaOrtu} onChange={(e) => setForm({ ...form, namaOrtu: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">No. HP</label>
                        <input type="text" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black" />
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-[var(--border)] mt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black">Batal</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                            {loading ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
