import React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "outline" | "ghost"
    size?: "sm" | "md" | "lg"
    loading?: boolean
    icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            className = "",
            variant = "primary",
            size = "md",
            loading = false,
            disabled,
            icon,
            ...props
        },
        ref
    ) => {
        const baseStyles =
            "inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]"

        const variantStyles = {
            primary: "bg-black text-white hover:bg-neutral-800 focus:ring-black shadow-sm",
            secondary: "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 focus:ring-neutral-400 border border-neutral-200",
            danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
            outline: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-400 shadow-sm",
            ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-300",
        }

        const sizeStyles = {
            sm: "text-xs px-3 py-1.5 gap-1.5",
            md: "text-sm px-4 py-2.5 gap-2",
            lg: "text-base px-5 py-3 gap-2.5",
        }

        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
                {...props}
            >
                {loading ? (
                    <svg
                        className="animate-spin -ml-0.5 h-4 w-4 text-current"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                        />
                    </svg>
                ) : icon ? (
                    <span className="shrink-0">{icon}</span>
                ) : null}
                {children}
            </button>
        )
    }
)

Button.displayName = "Button"
