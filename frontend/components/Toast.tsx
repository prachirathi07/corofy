"use client"

import { useEffect } from 'react'
import { X, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
    message: string
    type: ToastType
    onClose: () => void
    duration?: number
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(onClose, duration)
            return () => clearTimeout(timer)
        }
    }, [duration, onClose])

    const getStyles = () => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-50 border-green-500',
                    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
                    text: 'text-green-800'
                }
            case 'error':
                return {
                    bg: 'bg-red-50 border-red-500',
                    icon: <AlertCircle className="h-5 w-5 text-red-600" />,
                    text: 'text-red-800'
                }
            case 'warning':
                return {
                    bg: 'bg-yellow-50 border-yellow-500',
                    icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
                    text: 'text-yellow-800'
                }
            case 'info':
                return {
                    bg: 'bg-blue-50 border-blue-500',
                    icon: <Info className="h-5 w-5 text-blue-600" />,
                    text: 'text-blue-800'
                }
        }
    }

    const styles = getStyles()

    return (
        <div className={`fixed top-4 right-4 z-50 max-w-md border-l-4 rounded-lg shadow-lg ${styles.bg} p-4 animate-slide-in`}>
            <div className="flex items-start gap-3">
                {styles.icon}
                <div className="flex-1">
                    <p className={`text-sm font-medium ${styles.text}`}>{message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

// Toast container for managing multiple toasts
interface ToastContainerProps {
    toasts: Array<{ id: string; message: string; type: ToastType }>
    removeToast: (id: string) => void
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    )
}
