import React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "success" | "warning" | "danger" | "info" | "purple"
    size?: "sm" | "md"
}

export function Badge({
    children,
    className = "",
    variant = "default",
    size = "sm",
    ...props
}: BadgeProps) {
    const variantStyles = {
        default: "bg-neutral-100 text-neutral-700 border-neutral-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        danger: "bg-rose-50 text-rose-700 border-rose-200",
        info: "bg-blue-50 text-blue-700 border-blue-200",
        purple: "bg-purple-50 text-purple-700 border-purple-200",
    }

    const sizeStyles = {
        sm: "px-2.5 py-0.5 text-xs font-semibold",
        md: "px-3 py-1 text-sm font-semibold",
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...props}
        >
            {children}
        </span>
    )
}
