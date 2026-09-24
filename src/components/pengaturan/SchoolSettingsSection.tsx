"use client"

import React from "react"
import toast from "react-hot-toast"
import { SchoolSettings } from "./types"
import { Chevron, Field } from "./SharedUI"

interface SchoolSettingsSectionProps {
    school: SchoolSettings
    setSchool: React.Dispatch<React.SetStateAction<SchoolSettings>>
    expanded: boolean
    onToggle: () => void
    isAdmin: boolean
    saving: boolean
    setSaving: (saving: boolean) => void
}

export function SchoolSettingsSection({
    school,
    setSchool,
    expanded,
    onToggle,
    isAdmin,
    saving,
    setSaving,
}: SchoolSettingsSectionProps) {
    const handleSaveSchool = async () => {
        if (!isAdmin) return

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

    return (
        <div className="turbo-card overflow-hidden">
            <div
                className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                onClick={onToggle}
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
                <Chevron open={expanded} />
            </div>

            {expanded && (
                <div className="p-6 pt-0 border-t border-[var(--border)]">
                    <div className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field
                                label="Nama Sekolah"
                                value={school.namaSekolah}
                                onChange={(v) => setSchool({ ...school, namaSekolah: v })}
                            />
                            <Field
                                label="Tahun Ajaran"
                                value={school.tahunAjaran}
                                onChange={(v) => setSchool({ ...school, tahunAjaran: v })}
                            />
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Semester Aktif Berjalan
                                </label>
                                <div className="relative">
                                    <select
                                        value={school.semesterAktif || 1}
                                        onChange={(e) => setSchool({ ...school, semesterAktif: Number(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                    >
                                        <option value={1}>Semester 1 (Ganjil)</option>
                                        <option value={2}>Semester 2 (Genap)</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                                <p className="text-[11px] text-[var(--accents-5)] mt-1">
                                    Menentukan semester default saat membuka menu nilai dan rekapitulasi
                                </p>
                            </div>
                            <Field
                                label="Nama Kepala Sekolah"
                                value={school.kepalaSekolah}
                                onChange={(v) => setSchool({ ...school, kepalaSekolah: v })}
                            />
                            <Field
                                label="NIP Kepala Sekolah"
                                value={school.nipKepsek}
                                onChange={(v) => setSchool({ ...school, nipKepsek: v })}
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveSchool}
                                disabled={saving}
                                className="h-10 px-6 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-md"
                            >
                                {saving ? "Menyimpan..." : "💾 Simpan Informasi Sekolah"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
