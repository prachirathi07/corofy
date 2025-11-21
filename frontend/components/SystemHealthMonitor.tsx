"use client"

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface SystemStatus {
    status: string
    services: {
        [key: string]: {
            status: string
            message: string
        }
    }
}

export default function SystemHealthMonitor() {
    const [health, setHealth] = useState<SystemStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const response = await fetch('http://localhost:8000/health')
                const data = await response.json()
                setHealth(data)
                setError(null)
            } catch (err) {
                setError('Unable to connect to backend server')
            } finally {
                setLoading(false)
            }
        }

        checkHealth()
        // Check health every 30 seconds
        const interval = setInterval(checkHealth, 30000)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    <span className="text-sm text-gray-600">Checking system health...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Backend Offline</p>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
            case 'running':
            case 'configured':
            case 'connected':
                return 'text-green-600'
            case 'degraded':
            case 'not_configured':
                return 'text-yellow-600'
            case 'unhealthy':
            case 'stopped':
                return 'text-red-600'
            default:
                return 'text-gray-600'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
            case 'running':
            case 'configured':
            case 'connected':
                return <CheckCircle className="h-4 w-4 text-green-600" />
            case 'degraded':
            case 'not_configured':
                return <AlertTriangle className="h-4 w-4 text-yellow-600" />
            case 'unhealthy':
            case 'stopped':
                return <XCircle className="h-4 w-4 text-red-600" />
            default:
                return <AlertCircle className="h-4 w-4 text-gray-600" />
        }
    }

    const overallStatus = health?.status || 'unknown'
    const bgColor = overallStatus === 'healthy' ? 'bg-green-50 border-green-200' :
        overallStatus === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'

    return (
        <div className={`border rounded-lg p-4 ${bgColor}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {getStatusIcon(overallStatus)}
                    <h3 className="text-sm font-semibold">System Status</h3>
                </div>
                <span className={`text-xs font-medium ${getStatusColor(overallStatus)}`}>
                    {overallStatus.toUpperCase()}
                </span>
            </div>

            <div className="space-y-2">
                {health?.services && Object.entries(health.services).map(([service, details]) => (
                    <div key={service} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(details.status)}
                            <span className="capitalize">{service}</span>
                        </div>
                        <span className={`${getStatusColor(details.status)}`}>
                            {details.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
