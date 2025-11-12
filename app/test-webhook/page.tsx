'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function TestWebhookPage() {
  const [testResult, setTestResult] = useState<{success: boolean; error?: string; [key: string]: unknown} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState('get_products');
  const [industry, setIndustry] = useState('');

  const testWebhook = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        action,
        ...(industry && { industry })
      });
      
      const response = await fetch(`/api/webhook-fetch?${params}`);
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Failed to test webhook' });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestData = async () => {
    setIsLoading(true);
    try {
      const testPayload = {
        action: 'submit_product',
        industry: 'Agrochemical',
        brandName: 'Test Brand',
        chemicalName: 'Test Chemical',
        application: 'Test Application',
        targetCountries: ['USA', 'Canada'],
        source: 'test'
      };

      const response = await fetch('/api/webhook-fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Failed to send test data' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Webhook Test Page</h1>
        
        <div className="space-y-6">
          {/* Test GET Request */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Webhook GET Request</h2>
            <p className="text-gray-600 mb-4">
              Test fetching data from your n8n webhook.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="get_products">Get Products</option>
                  <option value="get_industries">Get Industries</option>
                  <option value="get_brands">Get Brands</option>
                  <option value="get_chemicals">Get Chemicals</option>
                  <option value="get_countries">Get Countries</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry (optional)
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Agrochemical"
                  className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={testWebhook}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test GET Request'}
              </button>
            </div>
          </div>

          {/* Test POST Request */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Webhook POST Request</h2>
            <p className="text-gray-600 mb-4">
              Test sending data to your n8n webhook.
            </p>
            
            <button
              onClick={sendTestData}
              disabled={isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Test Data'}
            </button>
          </div>

          {/* Results */}
          {testResult && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Test Result</h3>
              <div className="mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  testResult.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.success ? 'Success' : 'Error'}
                </span>
              </div>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Navigation */}
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
