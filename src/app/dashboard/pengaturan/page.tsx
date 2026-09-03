"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

interface SchoolSettings {
    namaSekolah: string
    kepalaSekolah: string
    nipKepsek: string
    tahunAjaran: string
}

interface MyAccount {
    name: string
    username: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    fotoProfilUrl?: string
    role?: string
    nip?: string | null
    kelas?: number | null
    mapelDiampu?: string | null
}

export default function PengaturanPage() {
    const { data: session, update } = useSession()
    const router = useRouter()
    const isAdmin = session?.user?.role === "admin"

    const [school, setSchool] = useState<SchoolSettings>({
        namaSekolah: "SDN 2 Nangerang",
        kepalaSekolah: "",
        nipKepsek: "",
        tahunAjaran: "2025/2026",
    })

    const [myAccount, setMyAccount] = useState<MyAccount>({
        name: "",
        username: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        fotoProfilUrl: ""
    })

    const [dbInfo, setDbInfo] = useState<{
        counts: { siswa: number; absensi: number; nilai: number; jurnal: number; buku: number; aset: number; user: number }
    } | null>(null)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dbLoading, setDbLoading] = useState(false)
    const [uploadingFoto, setUploadingFoto] = useState(false)
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [showConfirmPw, setShowConfirmPw] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Kenaikan kelas state
    const [kenaikanPreview, setKenaikanPreview] = useState<{
        perKelas: Record<number, number>
        tahunAjaranSekarang: string
        tahunAjaranBaru: string
    } | null>(null)
    const [kenaikanLoading, setKenaikanLoading] = useState(false)
    const [kenaikanProcessing, setKenaikanProcessing] = useState(false)
    const [showKenaikanModal, setShowKenaikanModal] = useState(false)
    const [tahunAjaranBaru, setTahunAjaranBaru] = useState("")

    const [expanded, setExpanded] = useState({
        myAccount: true,
        school: false,
        kenaikanKelas: false,
        database: false
    })

    const toggle = (key: keyof typeof expanded) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const myAccountRes = await fetch("/api/settings/my-account")
                if (myAccountRes.ok) {
                    const data = await myAccountRes.json()
                    setMyAccount(prev => ({
                        ...prev,
                        name: data.name || "",
                        username: data.username || "",
                        nip: data.nip || "",
                        role: data.role || "",
                        kelas: data.kelas || null,
                        mapelDiampu: data.mapelDiampu || null,
                        fotoProfilUrl: data.fotoProfilUrl || ""
                    }))
                }

                if (isAdmin) {
                    const schoolRes = await fetch("/api/settings/school")
                    if (schoolRes.ok) {
                        const data = await schoolRes.json()
                        if (data) setSchool(data)
                    }
                }
            } catch {
                console.error("Failed to fetch settings")
            } finally {
                setLoading(false)
            }
        }
        if (session) fetchSettings()
    }, [session, isAdmin])

    const handleFotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran foto maksimal 2MB")
            return
        }

        if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type.toLowerCase())) {
            toast.error("Format foto harus JPG, PNG, atau WEBP")
            return
        }

        try {
            setUploadingFoto(true)
            const formData = new FormData()
            formData.append("file", file)

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            const uploadData = await uploadRes.json()
            if (!uploadRes.ok) {
                throw new Error(uploadData.error || "Gagal mengunggah foto")
            }

            const newFotoUrl = uploadData.url

            // Update to account API
            const saveRes = await fetch("/api/settings/my-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fotoProfilUrl: newFotoUrl }),
            })

            if (!saveRes.ok) {
                throw new Error("Gagal menyimpan URL foto profil")
            }

            setMyAccount(prev => ({ ...prev, fotoProfilUrl: newFotoUrl }))
            await update({ fotoProfilUrl: newFotoUrl })
            toast.success("Foto profil berhasil diperbarui!")
        } catch (error: any) {
            toast.error(error.message || "Gagal mengunggah foto profil")
        } finally {
            setUploadingFoto(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleHapusFoto = async () => {
        if (!confirm("Hapus foto profil Anda?")) return

        try {
            setUploadingFoto(true)
            const res = await fetch("/api/settings/my-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fotoProfilUrl: null }),
            })

            if (!res.ok) throw new Error("Gagal menghapus foto profil")

            setMyAccount(prev => ({ ...prev, fotoProfilUrl: "" }))
            await update({ fotoProfilUrl: null })
            toast.success("Foto profil berhasil dihapus")
        } catch (error: any) {
            toast.error(error.message || "Gagal menghapus foto")
        } finally {
            setUploadingFoto(false)
        }
    }

    const handleSaveMyAccount = async () => {
        if (myAccount.newPassword) {
            if (myAccount.newPassword.length < 6) {
                toast.error("Password baru minimal 6 karakter")
                return
            }
            if (myAccount.newPassword !== myAccount.confirmPassword) {
                toast.error("Konfirmasi password tidak cocok")
                return
            }
            if (!myAccount.currentPassword) {
                toast.error("Masukkan password lama untuk mengubah password")
                return
            }
        }

        setSaving(true)
        try {
            const bodyPayload: any = {
                name: myAccount.name,
            }
            if (isAdmin) {
                bodyPayload.username = myAccount.username
            }
            if (myAccount.newPassword) {
                bodyPayload.currentPassword = myAccount.currentPassword
                bodyPayload.newPassword = myAccount.newPassword
            }

            const res = await fetch("/api/settings/my-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload),
            })
            const result = await res.json()
            if (res.ok) {
                toast.success("Akun berhasil diperbarui!")
                setMyAccount(prev => ({
                    ...prev,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: ""
                }))
                await update({ name: myAccount.name })
            } else {
                toast.error(result.error || "Gagal memperbarui akun")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan akun")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveSchool = async () => {
        if (!isAdmin) return
        
        // Validasi format Tahun Ajaran (contoh: 2026/2027)
        const formatRegex = /^\d{4}\/\d{4}$/
        if (!formatRegex.test(school.tahunAjaran.trim())) {
            toast.error("Format Tahun Ajaran harus TTTT/TTTT (contoh: 2026/2027)")
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/settings/school", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(school),
            })
            if (res.ok) toast.success("Informasi sekolah berhasil disimpan!")
            else toast.error("Gagal menyimpan")
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const fetchDbInfo = async () => {
        setDbLoading(true)
        try {
            const res = await fetch("/api/settings/database")
            if (res.ok) {
                const data = await res.json()
                setDbInfo(data)
            }
        } catch {
            console.error("Failed to fetch database info")
        } finally {
            setDbLoading(false)
        }
    }

    const handleExportBackup = async () => {
        try {
            const res = await fetch("/api/settings/database", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "export-backup" })
            })
            if (res.ok) {
                const backup = await res.json()
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `backup_admkelas_${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
                toast.success("Backup berhasil diunduh!")
            }
        } catch {
            toast.error("Gagal membuat backup")
        }
    }

    const handleDbAction = async (action: string, confirmMessage: string) => {
        if (!confirm(confirmMessage)) return

        setSaving(true)
        try {
            const res = await fetch("/api/settings/database", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            })
            const result = await res.json()
            if (res.ok) {
                toast.success(result.message)
                fetchDbInfo()
            } else {
                toast.error(result.error || "Operasi gagal")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const fetchKenaikanPreview = async () => {
        setKenaikanLoading(true)
        try {
            const res = await fetch("/api/siswa/kenaikan-kelas")
            if (res.ok) {
                const data = await res.json()
                setKenaikanPreview(data)
                setTahunAjaranBaru(data.tahunAjaranBaru)
            }
        } catch {
            console.error("Failed to fetch kenaikan preview")
        } finally {
            setKenaikanLoading(false)
        }
    }

    const handleKenaikanKelas = async () => {
        if (!tahunAjaranBaru.trim()) {
            toast.error("Tahun ajaran baru harus diisi")
            return
        }
        setKenaikanProcessing(true)
        try {
            const res = await fetch("/api/siswa/kenaikan-kelas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tahunAjaranBaru }),
            })
            const result = await res.json()
            if (res.ok) {
                toast.success(result.message)
                setShowKenaikanModal(false)
                // Refresh school settings and preview
                const schoolRes = await fetch("/api/settings/school")
                if (schoolRes.ok) {
                    const data = await schoolRes.json()
                    if (data) setSchool(data)
                }
                fetchKenaikanPreview()
            } else {
                toast.error(result.error || "Gagal memproses kenaikan kelas")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setKenaikanProcessing(false)
        }
    }

    if (loading) {
        return <div className="text-center text-[var(--accents-5)] py-12">Memuat pengaturan...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    {isAdmin ? "⚙️ Pengaturan Sistem & Akun" : "👤 Pengaturan Profil & Akun"}
                </h1>
                <p className="text-sm text-[var(--accents-5)]">
                    {isAdmin
                        ? "Kelola akun administrator, identitas sekolah, kenaikan kelas, dan database"
                        : "Kelola foto profil, identitas guru, dan kata sandi akun Anda"}
                </p>
            </div>

            {/* Profil & Akun Saya (Bisa Diakses Semua Guru & Pengguna) */}
            <div className="turbo-card overflow-hidden">
                <div
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                    onClick={() => toggle('myAccount')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-md">
                            👤
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--foreground)]">Profil & Akun Saya</h2>
                            <p className="text-sm text-[var(--accents-5)]">Foto profil, nama lengkap, dan ganti kata sandi</p>
                        </div>
                    </div>
                    <Chevron open={expanded.myAccount} />
                </div>

                {expanded.myAccount && (
                    <div className="p-6 pt-0 border-t border-[var(--border)]">
                        <div className="pt-6 space-y-6">
                            {/* Avatar & Foto Profil Uploader */}
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 bg-[var(--accents-1)] rounded-xl border border-[var(--border)]">
                                <div className="relative flex-shrink-0">
                                    {myAccount.fotoProfilUrl ? (
                                        <img
                                            src={myAccount.fotoProfilUrl}
                                            alt={myAccount.name || "Foto Profil"}
                                            className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-3xl flex items-center justify-center shadow-md border-2 border-white">
                                            {myAccount.name ? myAccount.name.charAt(0).toUpperCase() : "U"}
                                        </div>
                                    )}
                                    {uploadingFoto && (
                                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                                            <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 text-center sm:text-left">
                                    <h3 className="text-base font-bold text-[var(--foreground)]">{myAccount.name || "Nama Belum Diatur"}</h3>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 capitalize">
                                            {myAccount.role === "admin" ? "Administrator" :
                                                myAccount.role === "guru_mapel" ? `Guru Mapel (${myAccount.mapelDiampu || 'Semua'})` :
                                                    myAccount.kelas ? `Wali Kelas ${myAccount.kelas}` :
                                                        myAccount.role ? myAccount.role.replace('_', ' ') : "Guru"}
                                        </span>
                                        {myAccount.nip && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 font-mono">
                                                NIP: {myAccount.nip}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFotoSelect}
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingFoto}
                                            className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                            </svg>
                                            {uploadingFoto ? "Mengunggah..." : "Unggah Foto Profil"}
                                        </button>
                                        {myAccount.fotoProfilUrl && (
                                            <button
                                                type="button"
                                                onClick={handleHapusFoto}
                                                disabled={uploadingFoto}
                                                className="h-9 px-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                                Hapus Foto
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-[var(--accents-5)] mt-2">
                                        Format berkas: JPG, PNG, atau WEBP. Maksimal ukuran 2 MB.
                                    </p>
                                </div>
                            </div>

                            {/* Identitas Akun */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field
                                    label="Nama Lengkap"
                                    value={myAccount.name}
                                    onChange={(v) => setMyAccount(prev => ({ ...prev, name: v }))}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Username</label>
                                    <input
                                        type="text"
                                        value={myAccount.username}
                                        disabled={!isAdmin}
                                        onChange={(e) => setMyAccount(prev => ({ ...prev, username: e.target.value }))}
                                        className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all ${
                                            !isAdmin
                                                ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                                : "bg-white border-[var(--border)] focus:ring-1 focus:ring-black"
                                        }`}
                                    />
                                    {!isAdmin && (
                                        <p className="text-[11px] text-[var(--accents-5)] mt-1">Username ditetapkan oleh Administrator</p>
                                    )}
                                </div>
                            </div>

                            {/* Keamanan & Ganti Password */}
                            <div className="p-5 bg-[var(--accents-1)] rounded-xl border border-[var(--border)]">
                                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
                                    🔒 Keamanan Akun & Ganti Password
                                </h3>
                                <p className="text-xs text-[var(--accents-5)] mb-4">
                                    Kosongkan bagian password jika Anda hanya ingin memperbarui nama/foto profil.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Password Lama</label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPw ? "text" : "password"}
                                                value={myAccount.currentPassword}
                                                onChange={(e) => setMyAccount(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm outline-none focus:ring-1 focus:ring-black"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPw(!showCurrentPw)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                                            >
                                                {showCurrentPw ? "🙈" : "👁️"}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Password Baru (min. 6)</label>
                                        <div className="relative">
                                            <input
                                                type={showNewPw ? "text" : "password"}
                                                value={myAccount.newPassword}
                                                onChange={(e) => setMyAccount(prev => ({ ...prev, newPassword: e.target.value }))}
                                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm outline-none focus:ring-1 focus:ring-black"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPw(!showNewPw)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                                            >
                                                {showNewPw ? "🙈" : "👁️"}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Konfirmasi Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPw ? "text" : "password"}
                                                value={myAccount.confirmPassword}
                                                onChange={(e) => setMyAccount(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                className={`w-full pl-4 pr-10 py-2.5 bg-white border rounded-lg text-sm outline-none transition-all ${
                                                    myAccount.confirmPassword && myAccount.newPassword !== myAccount.confirmPassword
                                                        ? 'border-red-400 focus:ring-red-400'
                                                        : myAccount.confirmPassword && myAccount.newPassword === myAccount.confirmPassword
                                                            ? 'border-emerald-400 focus:ring-emerald-400'
                                                            : 'border-[var(--border)] focus:ring-1 focus:ring-black'
                                                }`}
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPw(!showConfirmPw)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                                            >
                                                {showConfirmPw ? "🙈" : "👁️"}
                                            </button>
                                        </div>
                                        {myAccount.confirmPassword && myAccount.newPassword !== myAccount.confirmPassword && (
                                            <p className="text-xs text-red-500 mt-1">Password baru tidak cocok</p>
                                        )}
                                        {myAccount.confirmPassword && myAccount.newPassword && myAccount.newPassword === myAccount.confirmPassword && (
                                            <p className="text-xs text-emerald-600 mt-1">✓ Konfirmasi password cocok</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveMyAccount}
                                    disabled={saving}
                                    className="h-10 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 shadow-md transition-all"
                                >
                                    {saving ? "Menyimpan..." : "💾 Simpan Perubahan Akun"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isAdmin && (
                <>
            {/* Informasi Sekolah */}
            <div className="turbo-card overflow-hidden">
                <div
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                    onClick={() => toggle('school')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl border border-blue-100">
                            🏫
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--foreground)]">Informasi Sekolah</h2>
                            <p className="text-sm text-[var(--accents-5)]">Data identitas sekolah</p>
                        </div>
                    </div>
                    <Chevron open={expanded.school} />
                </div>

                {expanded.school && (
                    <div className="p-6 pt-0 border-t border-[var(--border)]">
                        <div className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Nama Sekolah" value={school.namaSekolah} onChange={(v) => setSchool({ ...school, namaSekolah: v })} />
                                <Field label="Tahun Ajaran" value={school.tahunAjaran} onChange={(v) => setSchool({ ...school, tahunAjaran: v })} />
                                <Field label="Nama Kepala Sekolah" value={school.kepalaSekolah} onChange={(v) => setSchool({ ...school, kepalaSekolah: v })} />
                                <Field label="NIP Kepala Sekolah" value={school.nipKepsek} onChange={(v) => setSchool({ ...school, nipKepsek: v })} />
                            </div>

                            <div className="flex justify-end">
                                <button onClick={handleSaveSchool} disabled={saving} className="h-10 px-6 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-md">
                                    {saving ? "Menyimpan..." : "💾 Simpan Informasi Sekolah"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Maintenance Database */}
            <div className="turbo-card overflow-hidden border-2 border-dashed border-red-200">
                <div
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-red-50/50 transition-colors"
                    onClick={() => { toggle('database'); if (!dbInfo) fetchDbInfo() }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl border border-red-200">
                            🗄️
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--foreground)]">Maintenance Database</h2>
                            <p className="text-sm text-[var(--accents-5)]">Backup, reset data, dan proses naik kelas</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">⚠️ Hati-hati</span>
                        <Chevron open={expanded.database} />
                    </div>
                </div>

                {expanded.database && (
                    <div className="p-6 pt-0 border-t border-[var(--border)] space-y-6">
                        <div className="pt-6">
                            {/* Database Stats */}
                            {dbLoading ? (
                                <div className="text-center py-4 text-[var(--accents-5)]">Memuat statistik...</div>
                            ) : dbInfo ? (
                                <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-6">
                                    {Object.entries(dbInfo.counts).map(([key, value]) => (
                                        <div key={key} className="p-3 bg-[var(--accents-1)] rounded-lg text-center">
                                            <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
                                            <p className="text-xs text-[var(--accents-5)] capitalize">{key}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Backup Section */}
                            <div className="p-5 bg-blue-50 rounded-xl border border-blue-200 mb-4">
                                <h3 className="font-semibold text-blue-900 mb-2">💾 Export Backup</h3>
                                <p className="text-sm text-blue-700 mb-3">Unduh semua data sebagai file JSON</p>
                                <button onClick={handleExportBackup} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                                    Download Backup
                                </button>
                            </div>

                            {/* Naik Kelas */}
                            <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-200 mb-4">
                                <h3 className="font-semibold text-emerald-900 mb-2">🎓 Proses Kenaikan Kelas & Arsip Alumni</h3>
                                <p className="text-sm text-emerald-700 mb-3">
                                    Proses kenaikan kelas yang aman dengan pengarsipan otomatis alumni (tanpa menghapus data) dikelola pada tab Kenaikan Kelas.
                                </p>
                                <button
                                    onClick={() => {
                                        setExpanded(prev => ({ ...prev, kenaikanKelas: true }))
                                        if (!kenaikanPreview) fetchKenaikanPreview()
                                    }}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                                >
                                    Buka Menu Kenaikan Kelas →
                                </button>
                            </div>

                            {/* Maintenance Tools */}
                            <div className="p-5 bg-purple-50 rounded-xl border border-purple-200 mb-4">
                                <h3 className="font-semibold text-purple-900 mb-2">🧹 Pembersihan Data</h3>
                                <p className="text-sm text-purple-700 mb-3">Hapus akun guru/user yang ganda (duplikat nama).</p>
                                <button
                                    onClick={() => handleDbAction("clean-duplicate-users", "Sistem akan mencari user dengan nama sama dan menghapus duplikatnya secara otomatis.\n\nLanjutkan?")}
                                    disabled={saving}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {saving ? "Memproses..." : "Bersihkan User Ganda"}
                                </button>
                            </div>

                            {/* Danger Zone */}
                            <div className="p-5 bg-red-50 rounded-xl border-2 border-red-300">
                                <h3 className="font-semibold text-red-900 mb-4">⚠️ Zona Bahaya - Reset Data</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        onClick={() => handleDbAction("reset-absensi", "BAHAYA: Semua data absensi akan dihapus!\n\nApakah Anda yakin?")}
                                        disabled={saving}
                                        className="p-3 bg-white border border-red-200 rounded-lg text-center hover:bg-red-50"
                                    >
                                        <p className="font-medium text-red-800 text-sm">Reset Absensi</p>
                                        <p className="text-xs text-red-600">Hapus semua kehadiran</p>
                                    </button>
                                    <button
                                        onClick={() => handleDbAction("reset-nilai", "BAHAYA: Semua data nilai akan dihapus!\n\nApakah Anda yakin?")}
                                        disabled={saving}
                                        className="p-3 bg-white border border-red-200 rounded-lg text-center hover:bg-red-50"
                                    >
                                        <p className="font-medium text-red-800 text-sm">Reset Nilai</p>
                                        <p className="text-xs text-red-600">Hapus semua nilai</p>
                                    </button>
                                    <button
                                        onClick={() => handleDbAction("reset-jurnal", "BAHAYA: Semua data jurnal akan dihapus!\n\nApakah Anda yakin?")}
                                        disabled={saving}
                                        className="p-3 bg-white border border-red-200 rounded-lg text-center hover:bg-red-50"
                                    >
                                        <p className="font-medium text-red-800 text-sm">Reset Jurnal</p>
                                        <p className="text-xs text-red-600">Hapus semua jurnal</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Kenaikan Kelas */}
            <div className="turbo-card overflow-hidden border-l-4 border-l-green-500">
                <div
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                    onClick={() => {
                        toggle('kenaikanKelas')
                        if (!expanded.kenaikanKelas && !kenaikanPreview) {
                            fetchKenaikanPreview()
                        }
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 flex items-center justify-center text-xl border border-green-200">
                            🎓
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--foreground)]">Kenaikan Kelas</h2>
                            <p className="text-sm text-[var(--accents-5)]">Proses kenaikan kelas massal untuk tahun ajaran baru</p>
                        </div>
                    </div>
                    <Chevron open={expanded.kenaikanKelas} />
                </div>

                {expanded.kenaikanKelas && (
                    <div className="p-6 pt-0 border-t border-[var(--border)]">
                        <div className="pt-6 space-y-6">
                            {/* Info box */}
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
                                <span className="text-green-600 text-xl">ℹ️</span>
                                <div>
                                    <p className="text-sm font-semibold text-green-800">Cara Kerja Kenaikan Kelas</p>
                                    <ul className="text-xs text-green-700 mt-1 space-y-0.5 list-disc ml-4">
                                        <li>Siswa kelas 1 → naik ke kelas 2, dst.</li>
                                        <li>Siswa kelas 6 → diarsipkan sebagai <strong>Alumni</strong> (tidak dihapus)</li>
                                        <li>Kelas 1 dikosongkan (siap untuk siswa baru)</li>
                                        <li>Tahun ajaran sekolah diperbarui otomatis</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Preview data */}
                            {kenaikanLoading ? (
                                <div className="text-center py-6 text-[var(--accents-5)] text-sm">Memuat data siswa...</div>
                            ) : kenaikanPreview ? (
                                <div>
                                    <p className="text-sm font-semibold text-[var(--foreground)] mb-3">
                                        Tahun Ajaran Sekarang: <span className="text-green-600">{kenaikanPreview.tahunAjaranSekarang}</span>
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                                        {[1, 2, 3, 4, 5, 6].map((k) => (
                                            <div
                                                key={k}
                                                className={`p-3 rounded-lg border text-center ${
                                                    k === 6
                                                        ? "bg-amber-50 border-amber-200"
                                                        : "bg-[var(--accents-1)] border-[var(--border)]"
                                                }`}
                                            >
                                                <p className="text-xs text-[var(--accents-5)] mb-1">Kelas {k}</p>
                                                <p className="text-2xl font-bold text-[var(--foreground)]">
                                                    {kenaikanPreview.perKelas[k] || 0}
                                                </p>
                                                <p className="text-xs mt-1">
                                                    {k === 6 ? (
                                                        <span className="text-amber-600 font-medium">→ Alumni</span>
                                                    ) : (
                                                        <span className="text-green-600">→ Kelas {k + 1}</span>
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-[var(--accents-5)]">
                                        Total siswa aktif: <strong>{Object.values(kenaikanPreview.perKelas).reduce((a, b) => a + b, 0)}</strong> siswa
                                    </p>
                                </div>
                            ) : null}

                            {/* Action button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        if (!kenaikanPreview) fetchKenaikanPreview()
                                        setShowKenaikanModal(true)
                                    }}
                                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    🎓 Proses Kenaikan Kelas
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Konfirmasi Kenaikan Kelas */}
            {showKenaikanModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-5 border-b border-[var(--border)] bg-green-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🎓</span>
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--foreground)]">Konfirmasi Kenaikan Kelas</h2>
                                    <p className="text-xs text-[var(--accents-5)]">Tindakan ini tidak dapat dibatalkan</p>
                                </div>
                            </div>
                            <button onClick={() => setShowKenaikanModal(false)} className="text-[var(--accents-5)] hover:text-black text-xl">✕</button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Rincian kenaikan */}
                            {kenaikanPreview && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-[var(--foreground)] mb-2">Rincian Kenaikan:</p>
                                    {[1, 2, 3, 4, 5].map((k) => (
                                        <div key={k} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-[var(--accents-1)]">
                                            <span className="text-[var(--accents-6)]">Kelas {k} ({kenaikanPreview.perKelas[k] || 0} siswa)</span>
                                            <span className="font-medium text-green-600">→ Kelas {k + 1}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-amber-50 border border-amber-200">
                                        <span className="text-amber-700">Kelas 6 ({kenaikanPreview.perKelas[6] || 0} siswa)</span>
                                        <span className="font-medium text-amber-700">→ 🎓 Alumni (diarsipkan)</span>
                                    </div>
                                </div>
                            )}

                            {/* Input tahun ajaran baru */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                                    Tahun Ajaran Baru
                                </label>
                                <input
                                    type="text"
                                    value={tahunAjaranBaru}
                                    onChange={(e) => setTahunAjaranBaru(e.target.value)}
                                    placeholder="Contoh: 2026/2027"
                                    className="w-full px-4 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                />
                                <p className="text-xs text-[var(--accents-5)] mt-1">Format: YYYY/YYYY (contoh: 2026/2027)</p>
                            </div>

                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-700">
                                    ⚠️ <strong>Perhatian:</strong> Proses ini akan mengubah data kelas semua siswa aktif dan tidak dapat dibatalkan. Pastikan data sudah benar sebelum melanjutkan.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--accents-1)]">
                            <button
                                onClick={() => setShowKenaikanModal(false)}
                                disabled={kenaikanProcessing}
                                className="px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleKenaikanKelas}
                                disabled={kenaikanProcessing || !tahunAjaranBaru.trim()}
                                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {kenaikanProcessing ? (
                                    <><span className="animate-spin inline-block">⏳</span> Memproses...</>
                                ) : (
                                    <>✅ Ya, Proses Sekarang</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    )
}

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 text-[var(--accents-4)] ${open ? 'rotate-180' : ''}`}
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    )
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{label}</label>
            <input
                type={type}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
                placeholder={type === "password" ? "••••••••" : ""}
            />
        </div>
    )
}
