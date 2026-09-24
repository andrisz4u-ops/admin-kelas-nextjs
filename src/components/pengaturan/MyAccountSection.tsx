"use client"

import React, { useState, useRef } from "react"
import toast from "react-hot-toast"
import { MyAccount } from "./types"
import { Chevron, Field } from "./SharedUI"

interface MyAccountSectionProps {
    myAccount: MyAccount
    setMyAccount: React.Dispatch<React.SetStateAction<MyAccount>>
    expanded: boolean
    onToggle: () => void
    isAdmin: boolean
    saving: boolean
    setSaving: (saving: boolean) => void
    updateSession: (data: any) => Promise<any>
}

function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width)
                        width = maxWidth
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height)
                        height = maxHeight
                    }
                }

                const canvas = document.createElement("canvas")
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    resolve(e.target?.result as string)
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)
                const dataUrl = canvas.toDataURL("image/jpeg", quality)
                resolve(dataUrl)
            }
            img.onerror = () => reject(new Error("Gagal membaca berkas gambar"))
            img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error("Gagal memproses berkas"))
        reader.readAsDataURL(file)
    })
}

export function MyAccountSection({
    myAccount,
    setMyAccount,
    expanded,
    onToggle,
    isAdmin,
    saving,
    setSaving,
    updateSession,
}: MyAccountSectionProps) {
    const [uploadingFoto, setUploadingFoto] = useState(false)
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [showConfirmPw, setShowConfirmPw] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran foto maksimal 5MB")
            return
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Format berkas harus berupa gambar (JPG, PNG, atau WEBP)")
            return
        }

        try {
            setUploadingFoto(true)
            const compressedDataUrl = await compressImage(file, 400, 400, 0.8)

            const saveRes = await fetch("/api/settings/my-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fotoProfilUrl: compressedDataUrl }),
            })

            const saveData = await saveRes.json()
            if (!saveRes.ok) {
                throw new Error(saveData.error || "Gagal menyimpan foto profil")
            }

            setMyAccount(prev => ({ ...prev, fotoProfilUrl: compressedDataUrl }))
            await updateSession({ fotoProfilUrl: compressedDataUrl })
            toast.success("Foto profil berhasil diperbarui!")
        } catch (error: any) {
            console.error("Upload error:", error)
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
            await updateSession({ fotoProfilUrl: null })
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
                await updateSession({ name: myAccount.name })
            } else {
                toast.error(result.error || "Gagal memperbarui akun")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan akun")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="turbo-card overflow-hidden">
            <div
                className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                onClick={onToggle}
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
                <Chevron open={expanded} />
            </div>

            {expanded && (
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
    )
}
