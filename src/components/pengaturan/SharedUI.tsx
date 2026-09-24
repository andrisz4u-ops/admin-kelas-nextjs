import React from "react"

export function Chevron({ open }: { open: boolean }) {
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

export function Field({
    label,
    value,
    onChange,
    type = "text",
}: {
    label: string
    value: string
    onChange: (v: string) => void
    type?: string
}) {
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
