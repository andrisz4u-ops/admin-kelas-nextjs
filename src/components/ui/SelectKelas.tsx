import React from "react"

export interface SelectKelasProps {
    value: number
    onChange: (kelas: number) => void
    disabled?: boolean
    className?: string
    showAllOption?: boolean
    allValue?: number
}

export function SelectKelas({
    value,
    onChange,
    disabled = false,
    className = "",
    showAllOption = false,
    allValue = 0,
}: SelectKelasProps) {
    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider shrink-0">
                Pilih Kelas:
            </label>
            <select
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed transition-all"
            >
                {showAllOption && <option value={allValue}>Semua Kelas</option>}
                {[1, 2, 3, 4, 5, 6].map((k) => (
                    <option key={k} value={k}>
                        Kelas {k}
                    </option>
                ))}
            </select>
        </div>
    )
}
