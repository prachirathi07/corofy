"use client"

import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9)
        setToasts((prev) => [...prev, { id, message, type }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast])
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast])
    const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast])
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast])

    return {
        toasts,
        removeToast,
        success,
        error,
        warning,
        info
    }
}

// API Error Handler Hook
export function useApiErrorHandler() {
    const { error, warning } = useToast()

    const handleApiError = useCallback((err: any) => {
        // Check if it's a structured API error
        if (err.response?.data?.error) {
            const apiError = err.response.data.error

            // Handle specific error codes
            switch (apiError.code) {
                case 'OPENAI_QUOTA_EXCEEDED':
                    error('⚠️ OpenAI API quota exceeded. Please add credits to your account.')
                    break
                case 'OPENAI_RATE_LIMIT':
                    warning('⏳ OpenAI rate limit reached. Please wait a moment and try again.')
                    break
                case 'FIRECRAWL_QUOTA_EXCEEDED':
                    error('⚠️ Firecrawl API quota exceeded. Please check your subscription.')
                    break
                case 'FIRECRAWL_RATE_LIMIT':
                    warning('⏳ Too many scraping requests. They are being queued automatically.')
                    break
                case 'SUPABASE_CONNECTION_ERROR':
                    error('❌ Database connection failed. Please contact support.')
                    break
                case 'LEAD_NOT_FOUND':
                    error('❌ Lead not found. It may have been deleted.')
                    break
                case 'EMAIL_GENERATION_ERROR':
                    error(`❌ Email generation failed: ${apiError.message}`)
                    break
                case 'WEBSITE_SCRAPING_ERROR':
                    warning(`⚠️ Website scraping failed: ${apiError.message}`)
                    break
                case 'INTERNAL_SERVER_ERROR':
                    error('❌ Server error occurred. Please try again later.')
                    break
                default:
                    error(apiError.message || 'An error occurred')
            }
        } else if (err.message) {
            // Network or other errors
            if (err.message.includes('Network Error') || err.message.includes('ERR_CONNECTION_REFUSED')) {
                error('❌ Cannot connect to server. Please check if the backend is running.')
            } else {
                error(err.message)
            }
        } else {
            error('An unexpected error occurred')
        }
    }, [error, warning])

    return { handleApiError }
}
