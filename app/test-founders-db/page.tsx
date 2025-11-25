'use client';

import { useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function TestFoundersDBPage() {
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const setupDatabase = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/setup-founders-db', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(JSON.stringify(data, null, 2));
      } else {
        setError(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              Founders Database Setup
            </h1>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This page will help you set up the founders table in your Supabase database.
            </p>
            <p className="text-gray-600 mb-4">
              Before clicking the button below, make sure you have created the founders table in your Supabase dashboard.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">SQL to create the table:</h3>
              <pre className="text-xs bg-blue-100 p-3 rounded overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS founders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  founder_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  founder_email TEXT NOT NULL,
  founder_linkedin TEXT NOT NULL,
  founder_address TEXT NOT NULL,
  company_industry TEXT[] NOT NULL,
  company_website TEXT NOT NULL,
  company_linkedin TEXT NOT NULL,
  company_blogpost TEXT,
  company_angellist TEXT,
  company_phone TEXT,
  verification BOOLEAN DEFAULT false,
  five_min_sent BOOLEAN DEFAULT false,
  ten_min_sent BOOLEAN DEFAULT false,
  mail_status TEXT,
  priority_based_on_reply TEXT,
  thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on founders" ON founders FOR ALL USING (true);`}
              </pre>
            </div>
          </div>

          <button
            onClick={setupDatabase}
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Setting up...' : 'Setup Founders Database'}
          </button>

          {message && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">Success!</h3>
              <pre className="text-xs bg-green-100 p-3 rounded overflow-x-auto">
                {message}
              </pre>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Error</h3>
              <pre className="text-xs bg-red-100 p-3 rounded overflow-x-auto">
                {error}
              </pre>
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
              <li>Go to your Supabase dashboard at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">supabase.com/dashboard</a></li>
              <li>Select your project</li>
              <li>Navigate to SQL Editor</li>
              <li>Copy and paste the SQL code above</li>
              <li>Click &quot;Run&quot; to create the table</li>
              <li>Come back here and click &quot;Setup Founders Database&quot; to add sample data</li>
              <li>Go to <a href="/database" className="text-blue-600 underline">/database</a> to view your data</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}


