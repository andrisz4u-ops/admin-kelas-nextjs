"use client"

import React from "react"
import toast from "react-hot-toast"
import { DbInfo } from "./types"
import { Chevron } from "./SharedUI"

interface DatabaseSectionProps {
    dbInfo: DbInfo | null
    dbLoading: boolean
    expanded: boolean
    onToggle: () => void
    saving: boolean
    setSaving: (saving: boolean) => void
    fetchDbInfo: () => void
    onOpenKenaikanKelas: () => void
}

export function DatabaseSection({
    dbInfo,
    dbLoading,
    expanded,
    onToggle,
    saving,
    setSaving,
    fetchDbInfo,
    onOpenKenaikanKelas,
}: DatabaseSectionProps) {
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

    return (
        <div className="turbo-card overflow-hidden border-2 border-dashed border-red-200">
            <div
                className="flex justify-between items-center p-5 cursor-pointer hover:bg-red-50/50 transition-colors"
                onClick={onToggle}
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
                    <Chevron open={expanded} />
                </div>
            </div>

            {expanded && (
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
                            <button
                                onClick={handleExportBackup}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                                Download Backup
                            </button>
                        </div>

                        {/* Naik Kelas Link */}
                        <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-200 mb-4">
                            <h3 className="font-semibold text-emerald-900 mb-2">🎓 Proses Kenaikan Kelas & Arsip Alumni</h3>
                            <p className="text-sm text-emerald-700 mb-3">
                                Proses kenaikan kelas yang aman dengan pengarsipan otomatis alumni (tanpa menghapus data) dikelola pada tab Kenaikan Kelas.
                            </p>
                            <button
                                onClick={onOpenKenaikanKelas}
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
                                onClick={() =>
                                    handleDbAction(
                                        "clean-duplicate-users",
                                        "Sistem akan mencari user dengan nama sama dan menghapus duplikatnya secara otomatis.\n\nLanjutkan?"
                                    )
                                }
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
                                    onClick={() =>
                                        handleDbAction(
                                            "reset-absensi",
                                            "BAHAYA: Semua data absensi akan dihapus!\n\nApakah Anda yakin?"
                                        )
                                    }
                                    disabled={saving}
                                    className="p-3 bg-white border border-red-200 rounded-lg text-center hover:bg-red-50"
                                >
                                    <p className="font-medium text-red-800 text-sm">Reset Absensi</p>
                                    <p className="text-xs text-red-600">Hapus semua kehadiran</p>
                                </button>
                                <button
                                    onClick={() =>
                                        handleDbAction(
                                            "reset-nilai",
                                            "BAHAYA: Semua data nilai akan dihapus!\n\nApakah Anda yakin?"
                                        )
                                    }
                                    disabled={saving}
                                    className="p-3 bg-white border border-red-200 rounded-lg text-center hover:bg-red-50"
                                >
                                    <p className="font-medium text-red-800 text-sm">Reset Nilai</p>
                                    <p className="text-xs text-red-600">Hapus semua nilai</p>
                                </button>
                                <button
                                    onClick={() =>
                                        handleDbAction(
                                            "reset-jurnal",
                                            "BAHAYA: Semua data jurnal akan dihapus!\n\nApakah Anda yakin?"
                                        )
                                    }
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
    )
}
