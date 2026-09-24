"use client"

import React from "react"
import { Badge } from "@/components/ui"
import { RekapSiswa } from "./types"

interface RekapTableProps {
    recap: RekapSiswa[]
    loading: boolean
}

export function RekapTable({ recap, loading }: RekapTableProps) {
    return (
        <div className="turbo-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-12">No</th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-24">NIS</th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />H
                                </span>
                            </th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />S
                                </span>
                            </th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />I
                                </span>
                            </th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />A
                                </span>
                            </th>
                            <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-24">Kehadiran</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-[var(--accents-5)]">
                                    Memuat data...
                                </td>
                            </tr>
                        ) : recap.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-[var(--accents-5)]">
                                    Belum ada data siswa
                                </td>
                            </tr>
                        ) : (
                            recap.map((s, i) => (
                                <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors">
                                    <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                    <td className="px-4 py-3 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                    <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                    <td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{s.hadir}</td>
                                    <td className="px-4 py-3 text-center font-bold text-amber-600 tabular-nums">{s.sakit}</td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-600 tabular-nums">{s.izin}</td>
                                    <td className="px-4 py-3 text-center font-bold text-red-600 tabular-nums">{s.alpha}</td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge variant={s.percentage >= 90 ? "success" : s.percentage >= 75 ? "warning" : "danger"}>
                                            {s.percentage}%
                                        </Badge>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
