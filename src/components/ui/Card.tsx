import React from "react"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean
}

export function Card({ children, className = "", hover = false, ...props }: CardProps) {
    return (
        <div
            className={`bg-white rounded-2xl border border-neutral-200/80 shadow-sm ${
                hover ? "transition-all duration-200 hover:shadow-md hover:border-neutral-300" : ""
            } ${className}`}
            {...props}
        >
            {children}
        </div>
    )
}

export function CardHeader({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`p-5 border-b border-neutral-100 flex items-center justify-between ${className}`} {...props}>
            {children}
        </div>
    )
}

export function CardContent({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`p-5 ${className}`} {...props}>
            {children}
        </div>
    )
}

export function CardFooter({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`p-4 bg-neutral-50/50 border-t border-neutral-100 rounded-b-2xl ${className}`} {...props}>
            {children}
        </div>
    )
}
