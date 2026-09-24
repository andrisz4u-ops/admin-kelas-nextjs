"use client"

import React, { useEffect } from "react"

export interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl"
    showCloseButton?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = "lg",
    showCloseButton = true,
}: ModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const maxWidthStyles = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "4xl": "max-w-4xl",
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Dialog Content */}
            <div
                className={`relative w-full ${maxWidthStyles[maxWidth]} bg-white rounded-2xl border border-neutral-200 shadow-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200`}
            >
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-5 border-b border-neutral-100">
                        <div>
                            {title && <h3 className="text-lg font-bold text-neutral-900 tracking-tight">{title}</h3>}
                            {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}
