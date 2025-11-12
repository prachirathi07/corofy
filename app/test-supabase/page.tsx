'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function TestSupabasePage() {
  const [testResult, setTestResult] = useState<{success: boolean; error?: string; [key: string]: unknown} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testSupabaseConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-supabase');
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Failed to test connection' });
    } finally {
      setIsLoading(false);
    }
  };

  const setupDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/setup-db', { method: 'POST' });
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Failed to setup database' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Supabase Test Page</h1>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Supabase Connection</h2>
            <p className="text-gray-600 mb-4">
              Test the connection to your Supabase database and verify the setup.
            </p>
            
            <div className="space-x-4">
              <button
                onClick={testSupabaseConnection}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test Connection'}
              </button>
              
              <button
                onClick={setupDatabase}
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Setting up...' : 'Setup Database'}
              </button>
            </div>
          </div>

          {testResult && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Test Result</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Navigation</h2>
            <div className="space-x-4">
              <Link 
                href="/" 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Go to Dashboard (Product Form)
              </Link>
              <Link 
                href="/database" 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Go to Database Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
