"use client"

import React from "react"
import { RekapMeta } from "./types"

interface RekapInfoCardProps {
    meta: RekapMeta
}

export function RekapInfoCard({ meta }: RekapInfoCardProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    }

    return (
        <div className="turbo-card p-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
                <div>
                    <span className="text-[var(--accents-5)]">Periode:</span>{" "}
                    <span className="font-medium text-[var(--foreground)]">
                        {formatDate(meta.startDate)} - {formatDate(meta.endDate)}
                    </span>
                </div>
                <div>
                    <span className="text-[var(--accents-5)]">Hari Efektif:</span>{" "}
                    <span className="font-bold text-emerald-600">{meta.totalSchoolDays} hari</span>
                </div>
                {meta.holidaysInPeriod && meta.holidaysInPeriod.length > 0 && (
                    <div>
                        <span className="text-[var(--accents-5)]">Hari Libur:</span>{" "}
                        <span className="font-bold text-red-600">{meta.holidaysInPeriod.length} hari</span>
                    </div>
                )}
            </div>
            <p className="text-xs text-[var(--accents-4)] mt-2">
                * Tidak termasuk Sabtu, Minggu, dan hari libur nasional/sekolah
            </p>
        </div>
    )
}
