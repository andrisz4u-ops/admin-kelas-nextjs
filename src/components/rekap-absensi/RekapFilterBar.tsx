"use client"

import React from "react"
import { SelectKelas, Button } from "@/components/ui"
import { MONTH_NAMES } from "./types"

interface RekapFilterBarProps {
    kelas: number
    setKelas: (k: number) => void
    canSelectKelas: boolean
    type: "month" | "semester"
    setType: (t: "month" | "semester") => void
    month: number
    setMonth: (m: number) => void
    year: number
    setYear: (y: number) => void
    semester: number
    setSemester: (s: number) => void
    tahunAjaran: string
    setTahunAjaran: (ta: string) => void
    onExport: () => void
}

export function RekapFilterBar({
    kelas,
    setKelas,
    canSelectKelas,
    type,
    setType,
    month,
    setMonth,
    year,
    setYear,
    semester,
    setSemester,
    tahunAjaran,
    setTahunAjaran,
    onExport,
}: RekapFilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Class selector */}
            <SelectKelas
                value={kelas}
                onChange={setKelas}
                disabled={!canSelectKelas}
            />

            {/* Type selector */}
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                <button
                    onClick={() => setType("month")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                        type === "month"
                            ? "bg-black text-white"
                            : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"
                    }`}
                >
                    Bulanan
                </button>
                <button
                    onClick={() => setType("semester")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                        type === "semester"
                            ? "bg-black text-white"
                            : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"
                    }`}
                >
                    Semester
                </button>
            </div>

            {/* Period selector */}
            {type === "month" ? (
                <>
                    <div className="relative">
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                        >
                            {MONTH_NAMES.map((m, i) => (
                                <option key={i} value={i}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                        >
                            {[2024, 2025, 2026, 2027].map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </>
            ) : (
                <>
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
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={tahunAjaran}
                            onChange={(e) => {
                                const selectedTa = e.target.value
                                setTahunAjaran(selectedTa)
                                const endYear = parseInt(selectedTa.split("/")[1]) || 2026
                                setYear(endYear)
                            }}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none font-medium"
                        >
                            <option value="2024/2025">2024/2025</option>
                            <option value="2025/2026">2025/2026</option>
                            <option value="2026/2027">2026/2027</option>
                            <option value="2027/2028">2027/2028</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </>
            )}

            {/* Export button */}
            <Button
                onClick={onExport}
                variant="secondary"
                size="sm"
                className="bg-emerald-600! text-white! hover:bg-emerald-700! border-emerald-600!"
                icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                }
            >
                Export Excel
            </Button>
        </div>
    )
}
