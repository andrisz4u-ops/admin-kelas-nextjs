"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

interface SpecialAccount {
    id: string
    name: string
    username: string
    password?: string
    role: string
    mapelDiampu?: string
    nip?: string
    kelas?: number | null
    fotoProfilUrl?: string
}

interface WaliKelasWithAccount {
    kelas: number
    nama: string
    nip: string
    username: string
    password?: string
    fotoProfilUrl?: string
}

interface MapelItem {
    code: string
    name: string
    isCustom: boolean
}

// Tab component
function Tab({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${active
                    ? 'bg-black text-white shadow-lg'
                    : 'bg-white text-[var(--accents-6)] hover:bg-[var(--accents-1)] border border-[var(--border)]'
                }`}
        >
            <span className="text-lg">{icon}</span>
            {children}
        </button>
    )
}

export default function ManajemenAkunPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const isAdmin = session?.user?.role === "admin"

    const [activeTab, setActiveTab] = useState<'wali' | 'special' | 'mapel'>('wali')
    const [waliKelas, setWaliKelas] = useState<WaliKelasWithAccount[]>([])
    const [specialAccounts, setSpecialAccounts] = useState<SpecialAccount[]>([])
    const [mapelKelas, setMapelKelas] = useState<number>(1)
    const [mapelList, setMapelList] = useState<MapelItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean
        accountIndex: number
        accountId: string
        accountName: string
        accountRole: string
    } | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (session && !isAdmin) {
            toast.error("Akses ditolak. Hanya admin.")
            router.push("/dashboard")
        }
    }, [session, isAdmin, router])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [waliRes, specialRes] = await Promise.all([
                    fetch("/api/settings/wali-kelas"),
                    fetch("/api/settings/special-accounts")
                ])

                if (waliRes.ok) {
                    const data = await waliRes.json()
                    setWaliKelas(data)
                }

                if (specialRes.ok) {
                    const data = await specialRes.json()
                    const defaultRoles = [
                        { role: "kepsek", name: "", username: "" },
                        { role: "pengawas", name: "", username: "" }
                    ]

                    const existing = data || []
                    const mergedDefaults = defaultRoles.map(def => {
                        const found = existing.find((e: SpecialAccount) => e.role === def.role)
                        return found ? { ...found, password: "" } : { ...def, id: "", password: "", role: def.role }
                    })

                    const otherAccounts = existing.filter((e: SpecialAccount) =>
                        e.role === "guru_mapel" || (e.role === "guru" && !e.kelas)
                    ).map((acc: SpecialAccount) => ({ ...acc, password: "" }))

                    setSpecialAccounts([...mergedDefaults, ...otherAccounts])
                }
            } catch {
                console.error("Failed to fetch data")
            } finally {
                setLoading(false)
            }
        }
        if (isAdmin) fetchData()
    }, [isAdmin])

    // Fetch mapel when class changes
    useEffect(() => {
        const fetchMapel = async () => {
            try {
                const res = await fetch(`/api/settings/mapel?kelas=${mapelKelas}`)
                if (res.ok) {
                    const data = await res.json()
                    setMapelList(data)
                }
            } catch {
                console.error("Failed to fetch mapel")
            }
        }
        if (activeTab === 'mapel') fetchMapel()
    }, [mapelKelas, activeTab])

    const updateWali = (kelas: number, field: keyof WaliKelasWithAccount, value: string) => {
        setWaliKelas(prev => prev.map(w => w.kelas === kelas ? { ...w, [field]: value } : w))
    }

    const handleSaveWali = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/wali-kelas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ waliKelasData: waliKelas }),
            })
            if (res.ok) toast.success("Data wali kelas berhasil disimpan!")
            else toast.error("Gagal menyimpan")
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const updateSpecialAccount = (index: number, field: string, value: string) => {
        setSpecialAccounts(prev => prev.map((acc, i) => i === index ? { ...acc, [field]: value } : acc))
    }

    const addSpecialAccount = (role: string) => {
        setSpecialAccounts(prev => [...prev, {
            id: "",
            name: "",
            username: "",
            password: "",
            role,
            mapelDiampu: role === "guru_mapel" ? "" : undefined,
        }])
    }

    const removeSpecialAccount = (index: number) => {
        const acc = specialAccounts[index]
        if (acc.role === "kepsek" || acc.role === "pengawas") {
            toast.error("Akun ini tidak bisa dihapus")
            return
        }
        // If account has ID (already in database), show confirm dialog
        if (acc.id) {
            setDeleteConfirm({
                show: true,
                accountIndex: index,
                accountId: acc.id,
                accountName: acc.name || "(tanpa nama)",
                accountRole: acc.role,
            })
        } else {
            // New account (not yet saved), just remove from UI
            setSpecialAccounts(prev => prev.filter((_, i) => i !== index))
        }
    }

    const handleDeleteAccount = async () => {
        if (!deleteConfirm) return
        setDeleting(true)
        try {
            if (deleteConfirm.accountId) {
                const res = await fetch("/api/settings/special-accounts", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: deleteConfirm.accountId }),
                })
                const result = await res.json()
                if (res.ok) {
                    toast.success(result.message || "Akun berhasil dihapus")
                    setSpecialAccounts(prev => prev.filter((_, i) => i !== deleteConfirm.accountIndex))
                } else {
                    toast.error(result.error || "Gagal menghapus akun")
                    return
                }
            } else {
                setSpecialAccounts(prev => prev.filter((_, i) => i !== deleteConfirm.accountIndex))
            }
            setDeleteConfirm(null)
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setDeleting(false)
        }
    }

    const handleSaveSpecial = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/special-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accounts: specialAccounts }),
            })
            if (res.ok) toast.success("Akun berhasil disimpan!")
            else toast.error("Gagal menyimpan")
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveMapel = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/mapel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kelas: mapelKelas, mapelList }),
            })
            if (res.ok) toast.success(`Nama mapel Kelas ${mapelKelas} berhasil disimpan!`)
            else toast.error("Gagal menyimpan")
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const getRoleLabel = (role: string) => {
        const labels: Record<string, { label: string; color: string; icon: string }> = {
            kepsek: { label: "Kepala Sekolah", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "👨‍💼" },
            pengawas: { label: "Pengawas", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "👁️" },
            guru_mapel: { label: "Guru Mapel", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "📚" },
            guru: { label: "Staff/Lainnya", color: "bg-gray-100 text-gray-700 border-gray-200", icon: "👤" },
        }
        return labels[role] || labels.guru
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <span className="text-6xl">🔒</span>
                    <h2 className="text-xl font-bold mt-4">Akses Ditolak</h2>
                    <p className="text-[var(--accents-5)] mt-2">Hanya admin yang bisa mengakses halaman ini</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="text-center text-[var(--accents-5)] py-12">Memuat data...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">👥 Manajemen Akun</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        Kelola akun wali kelas, guru mapel, dan konfigurasi mata pelajaran
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                <Tab active={activeTab === 'wali'} onClick={() => setActiveTab('wali')} icon="👩‍🏫">
                    Wali Kelas
                </Tab>
                <Tab active={activeTab === 'special'} onClick={() => setActiveTab('special')} icon="⭐">
                    Akun Khusus
                </Tab>
                <Tab active={activeTab === 'mapel'} onClick={() => setActiveTab('mapel')} icon="📖">
                    Nama Mapel
                </Tab>
            </div>

            {/* Tab Content: Wali Kelas */}
            {activeTab === 'wali' && (
                <div className="space-y-4">
                    {/* Panduan skenario */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                        <span className="text-blue-500 text-xl mt-0.5">ℹ️</span>
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Panduan Pergantian Wali Kelas</p>
                            <ul className="space-y-0.5 text-xs list-disc ml-4 text-blue-700">
                                <li><strong>Guru Pensiun / Mutasi:</strong> Ganti nama, NIP, dan username pada kelas yang bersangkutan → klik Simpan</li>
                                <li><strong>Guru Baru:</strong> Isi nama baru, username baru, dan password baru pada slot kelas → klik Simpan</li>
                                <li>Slot kelas 1–6 selalu tersedia. Password dikosongkan = tidak berubah.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {waliKelas.map((w) => (
                            <div key={w.kelas} className="turbo-card p-5 hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border)]">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                        {w.kelas}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[var(--foreground)]">Kelas {w.kelas}</h3>
                                        <p className="text-xs text-[var(--accents-5)]">Wali Kelas</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Nama Guru</label>
                                        <input
                                            type="text"
                                            value={w.nama}
                                            onChange={(e) => updateWali(w.kelas, "nama", e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                            placeholder="Nama lengkap..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">NIP</label>
                                        <input
                                            type="text"
                                            value={w.nip}
                                            onChange={(e) => updateWali(w.kelas, "nip", e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                            placeholder="NIP..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Username</label>
                                            <input
                                                type="text"
                                                value={w.username}
                                                onChange={(e) => updateWali(w.kelas, "username", e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                placeholder="username"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={w.password || ""}
                                                onChange={(e) => updateWali(w.kelas, "password", e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center pt-4">
                        <button
                            onClick={handleSaveWali}
                            disabled={saving}
                            className="h-11 px-8 bg-black text-white rounded-full font-medium shadow-lg hover:bg-gray-800 transition-all disabled:opacity-50"
                        >
                            {saving ? "Menyimpan..." : "💾 Simpan Semua Wali Kelas"}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Content: Akun Khusus */}
            {activeTab === 'special' && (
                <div className="space-y-4">
                    {/* Panduan skenario akun khusus */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                        <span className="text-amber-500 text-xl mt-0.5">ℹ️</span>
                        <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">Panduan Guru Mapel / Staff</p>
                            <ul className="space-y-0.5 text-xs list-disc ml-4 text-amber-700">
                                <li><strong>Guru Baru:</strong> Klik &quot;+ Guru Mapel&quot; atau &quot;+ Staff&quot; → isi data → Simpan</li>
                                <li><strong>Guru Pensiun / Mutasi:</strong> Klik tombol <span className="font-mono bg-red-100 text-red-700 px-1 rounded">🗑️ Hapus</span> pada kartu guru → konfirmasi → akun terhapus dari sistem</li>
                                <li><strong>Kepala Sekolah / Pengawas:</strong> Edit nama dan password langsung → tidak bisa dihapus</li>
                            </ul>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['kepsek', 'pengawas', 'guru_mapel', 'guru'].map(role => {
                            const info = getRoleLabel(role)
                            const count = specialAccounts.filter(a => a.role === role).length
                            return (
                                <div key={role} className={`p-4 rounded-xl border ${info.color}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{info.icon}</span>
                                        <div>
                                            <p className="text-2xl font-bold">{count}</p>
                                            <p className="text-xs font-medium">{info.label}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Account Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {specialAccounts.map((acc, index) => {
                            const info = getRoleLabel(acc.role)
                            return (
                                <div key={index} className="turbo-card p-5 hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{info.icon}</span>
                                            <div>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${info.color}`}>
                                                    {info.label}
                                                </span>
                                            </div>
                                        </div>
                                        {acc.role !== "kepsek" && acc.role !== "pengawas" && (
                                            <button
                                                onClick={() => removeSpecialAccount(index)}
                                                className="text-xs px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 transition-colors"
                                                title="Hapus akun ini dari sistem"
                                            >
                                                🗑️ Hapus
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Nama</label>
                                            <input
                                                type="text"
                                                value={acc.name}
                                                onChange={(e) => updateSpecialAccount(index, "name", e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                placeholder="Nama lengkap..."
                                            />
                                        </div>
                                        {acc.role === "guru_mapel" && (
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Mapel Diampu</label>
                                                <input
                                                    type="text"
                                                    value={acc.mapelDiampu || ""}
                                                    onChange={(e) => updateSpecialAccount(index, "mapelDiampu", e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                    placeholder="PAI, PJOK, dll..."
                                                />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Username</label>
                                                <input
                                                    type="text"
                                                    value={acc.username}
                                                    onChange={(e) => updateSpecialAccount(index, "username", e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                    placeholder="username"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Password</label>
                                                <input
                                                    type="password"
                                                    value={acc.password || ""}
                                                    onChange={(e) => updateSpecialAccount(index, "password", e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md outline-none focus:ring-1 focus:ring-black"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Add New Account Card */}
                        <div className="turbo-card p-5 border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-3 min-h-[200px]">
                            <p className="text-sm text-[var(--accents-5)]">Tambah Akun Baru</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => addSpecialAccount("guru_mapel")}
                                    className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"
                                >
                                    + Guru Mapel
                                </button>
                                <button
                                    onClick={() => addSpecialAccount("guru")}
                                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                                >
                                    + Staff
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center pt-4">
                        <button
                            onClick={handleSaveSpecial}
                            disabled={saving}
                            className="h-11 px-8 bg-black text-white rounded-full font-medium shadow-lg hover:bg-gray-800 transition-all disabled:opacity-50"
                        >
                            {saving ? "Menyimpan..." : "💾 Simpan Semua Akun"}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Content: Nama Mapel */}
            {activeTab === 'mapel' && (
                <div className="space-y-4">
                    {/* Class Selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[var(--accents-5)]">Pilih Kelas:</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5, 6].map(k => (
                                <button
                                    key={k}
                                    onClick={() => setMapelKelas(k)}
                                    className={`w-10 h-10 rounded-lg font-bold transition-all ${mapelKelas === k
                                            ? 'bg-black text-white shadow-lg'
                                            : 'bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accents-1)]'
                                        }`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mapel Grid */}
                    <div className="turbo-card p-6">
                        <h3 className="font-semibold text-[var(--foreground)] mb-4">
                            📚 Daftar Mata Pelajaran Kelas {mapelKelas}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {mapelList.map((m, i) => (
                                <div key={m.code} className="flex items-center gap-3 p-3 bg-[var(--accents-1)] rounded-lg">
                                    <span className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--accents-5)]">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-xs text-[var(--accents-5)]">{m.code}</p>
                                        <input
                                            type="text"
                                            value={m.name}
                                            onChange={(e) => {
                                                setMapelList(prev => prev.map((item, idx) =>
                                                    idx === i ? { ...item, name: e.target.value, isCustom: true } : item
                                                ))
                                            }}
                                            className="w-full px-2 py-1 text-sm bg-white border border-[var(--border)] rounded outline-none focus:ring-1 focus:ring-black"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center pt-6">
                            <button
                                onClick={handleSaveMapel}
                                disabled={saving}
                                className="h-11 px-8 bg-black text-white rounded-full font-medium shadow-lg hover:bg-gray-800 transition-all disabled:opacity-50"
                            >
                                {saving ? "Menyimpan..." : `💾 Simpan Mapel Kelas ${mapelKelas}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Hapus Akun */}
            {deleteConfirm?.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-[var(--border)] bg-red-50 flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h2 className="text-lg font-bold text-red-800">Hapus Akun Guru</h2>
                                <p className="text-xs text-red-600">Tindakan ini tidak dapat dibatalkan</p>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-[var(--foreground)]">
                                Anda akan menghapus akun <strong>{deleteConfirm.accountName}</strong> dari sistem.
                            </p>

                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1.5">
                                <p className="text-xs font-semibold text-red-700">Yang akan terjadi:</p>
                                <ul className="text-xs text-red-700 list-disc ml-4 space-y-0.5">
                                    <li>Akun login guru ini akan dihapus permanen</li>
                                    <li>Data absensi guru (jika ada) juga ikut terhapus</li>
                                    <li>Guru tidak bisa lagi masuk ke sistem</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    💡 <strong>Untuk guru pensiun / mutasi:</strong> Hapus akun ini, lalu tambahkan guru pengganti dengan klik &quot;+ Guru Mapel&quot; atau &quot;+ Staff&quot;.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--accents-1)]">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                                className="px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {deleting ? (
                                    <><span className="animate-spin inline-block">⏳</span> Menghapus...</>
                                ) : (
                                    <>🗑️ Ya, Hapus Permanen</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
