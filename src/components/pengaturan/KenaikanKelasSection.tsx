"use client"

import React, { useState } from "react"
import toast from "react-hot-toast"
import { KenaikanPreview, SchoolSettings } from "./types"
import { Chevron } from "./SharedUI"

interface KenaikanKelasSectionProps {
    kenaikanPreview: KenaikanPreview | null
    kenaikanLoading: boolean
    expanded: boolean
    onToggle: () => void
    fetchKenaikanPreview: () => void
    setSchool: React.Dispatch<React.SetStateAction<SchoolSettings>>
}

export function KenaikanKelasSection({
    kenaikanPreview,
    kenaikanLoading,
    expanded,
    onToggle,
    fetchKenaikanPreview,
    setSchool,
}: KenaikanKelasSectionProps) {
    const [showModal, setShowModal] = useState(false)
    const [tahunAjaranBaru, setTahunAjaranBaru] = useState("")
    const [processing, setProcessing] = useState(false)

    const handleOpenModal = () => {
        if (!kenaikanPreview) {
            fetchKenaikanPreview()
        } else {
            setTahunAjaranBaru(kenaikanPreview.tahunAjaranBaru)
        }
        setShowModal(true)
    }

    const handleKenaikanKelas = async () => {
        if (!tahunAjaranBaru.trim()) {
            toast.error("Tahun ajaran baru harus diisi")
            return
        }
        setProcessing(true)
        try {
            const res = await fetch("/api/siswa/kenaikan-kelas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tahunAjaranBaru }),
            })
            const result = await res.json()
            if (res.ok) {
                toast.success(result.message)
                setShowModal(false)
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
            setProcessing(false)
        }
    }

    return (
        <>
            <div className="turbo-card overflow-hidden border-l-4 border-l-green-500">
                <div
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--accents-1)] transition-colors"
                    onClick={() => {
                        onToggle()
                        if (!expanded && !kenaikanPreview) {
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
                    <Chevron open={expanded} />
                </div>

                {expanded && (
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
                                    onClick={handleOpenModal}
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
            {showModal && (
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
                            <button onClick={() => setShowModal(false)} className="text-[var(--accents-5)] hover:text-black text-xl">
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {kenaikanPreview && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-[var(--foreground)] mb-2">Rincian Kenaikan:</p>
                                    {[1, 2, 3, 4, 5].map((k) => (
                                        <div key={k} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-[var(--accents-1)]">
                                            <span className="text-[var(--accents-6)]">
                                                Kelas {k} ({kenaikanPreview.perKelas[k] || 0} siswa)
                                            </span>
                                            <span className="font-medium text-green-600">→ Kelas {k + 1}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-amber-50 border border-amber-200">
                                        <span className="text-amber-700">Kelas 6 ({kenaikanPreview.perKelas[6] || 0} siswa)</span>
                                        <span className="font-medium text-amber-700">→ 🎓 Alumni (diarsipkan)</span>
                                    </div>
                                </div>
                            )}

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
                                onClick={() => setShowModal(false)}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium text-[var(--accents-6)] hover:text-black disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleKenaikanKelas}
                                disabled={processing || !tahunAjaranBaru.trim()}
                                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <span className="animate-spin inline-block">⏳</span> Memproses...
                                    </>
                                ) : (
                                    <>✅ Ya, Proses Sekarang</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
