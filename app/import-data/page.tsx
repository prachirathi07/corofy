'use client';

import { useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ImportDataPage() {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Array<{name: string; company: string; status: string; error?: string}>>([]);
  const [summary, setSummary] = useState<{ success: number; errors: number } | null>(null);

  const sampleFounders = [
    {
      "Founder Name": "Lina Yavuz",
      "Company Name": "Severin",
      "Position": "Key-Account-Manager",
      "Founder Email": "lina.yavuz@severin.de",
      "Founder Linkedin": "http://www.linkedin.com/in/lina-yavuz-751965244",
      "Founder Address": "Germany",
      "Company's Industry": "electrical/electronic manufacturing",
      "Company Website": "http://www.severin.com",
      "Company Linkedin": "http://www.linkedin.com/company/severin-elektroger-te-gmbh",
      "Company Phone": "+49 1516 2418101",
      "Verification": false,
      "5 Min Sent": false,
      "10 Min Sent": false
    },
    {
      "Founder Name": "Mike Braham",
      "Company Name": "Intempo Health",
      "Position": "Chief Growth Officer and Board of Directors",
      "Founder Email": "mike.braham@intempohealth.com",
      "Founder Linkedin": "http://www.linkedin.com/in/mikebraham",
      "Founder Address": "Leesburg, VA, USA",
      "Company's Industry": "information technology & services",
      "Company Website": "http://www.intempohealth.com",
      "Company Linkedin": "http://www.linkedin.com/company/intempo-health",
      "Verification": false,
      "5 Min Sent": false,
      "10 Min Sent": false,
      "Mail Status": "SENT",
      "Thread ID": "19999b56b4952e28"
    },
    {
      "Founder Name": "Bill Gates",
      "Company Name": "Breakthrough Energy",
      "Position": "Founder",
      "Founder Email": "be@breakthroughenergy.org",
      "Founder Linkedin": "http://www.linkedin.com/in/williamhgates",
      "Founder Address": "Seattle, WA, USA",
      "Company's Industry": "management consulting",
      "Company Website": "http://www.breakthroughenergy.org",
      "Company Linkedin": "http://www.linkedin.com/company/breakthrough-energy",
      "Company Phone": "+1 425-497-4303",
      "Verification": false,
      "5 Min Sent": false,
      "10 Min Sent": false,
      "Mail Status": "SENT",
      "Thread ID": "19999b56e7943a3a"
    },
    {
      "Founder Name": "Larry Fink",
      "Company Name": "BlackRock",
      "Position": "Chairman and CEO",
      "Founder Email": "larry_fink@blackrock.com",
      "Founder Linkedin": "http://www.linkedin.com/in/laurencefink",
      "Founder Address": "New York, NY, USA",
      "Company's Industry": "financial services",
      "Company Website": "http://www.blackrock.com",
      "Company Linkedin": "http://www.linkedin.com/company/blackrock",
      "Company Phone": "+1 212-810-5800",
      "Verification": false,
      "5 Min Sent": false,
      "10 Min Sent": false,
      "Mail Status": "SENT",
      "Thread ID": "19999b588bc3d458"
    },
    {
      "Founder Name": "Christian Luedders",
      "Company Name": "NovaTaste",
      "Position": "Product Designer",
      "Founder Email": "christian.luedders@novataste.com",
      "Founder Linkedin": "http://www.linkedin.com/in/christian-l%c3%bcdders-580481178",
      "Founder Address": "Hamburg, Germany",
      "Company's Industry": "food & beverages",
      "Company Website": "http://www.novataste.com",
      "Company Linkedin": "http://www.linkedin.com/company/nova-taste",
      "Verification": false,
      "5 Min Sent": false,
      "10 Min Sent": false,
      "Mail Status": "SENT",
      "Thread ID": "19999b57f9af8c72"
    }
  ];

  const importData = async () => {
    setImporting(true);
    setResults([]);
    setSummary(null);

    const importResults: Array<{name: string; company: string; status: string; error?: string}> = [];
    let successCount = 0;
    let errorCount = 0;

    for (const founder of sampleFounders) {
      try {
        // Supabase removed - API calls disabled
        throw new Error('Supabase has been removed. API calls are disabled.');
      } catch (error) {
        importResults.push({
          name: founder['Founder Name'],
          company: founder['Company Name'],
          status: 'error',
          error: error instanceof Error ? error.message : 'Network error'
        });
        errorCount++;
      }

      setResults([...importResults]);
    }

    setSummary({ success: successCount, errors: errorCount });
    setImporting(false);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              Import Founders Data
            </h1>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Supabase has been removed. This page is no longer functional.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">What will be imported:</h3>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>{sampleFounders.length} sample founders</li>
                <li>All data will be inserted into the &quot;scraped Data&quot; table</li>
                <li>Existing data will not be affected</li>
              </ul>
            </div>
          </div>

          <button
            onClick={importData}
            disabled={importing}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
          >
            {importing ? 'Importing...' : `Import ${sampleFounders.length} Founders`}
          </button>

          {/* Progress */}
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Import Progress:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      result.status === 'success'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div>
                      <span className="font-medium">
                        {result.name}
                      </span>
                      <span className="text-gray-600 text-sm ml-2">
                        from {result.company}
                      </span>
                    </div>
                    {result.status === 'success' ? (
                      <span className="text-green-700 text-sm">✓ Imported</span>
                    ) : (
                      <span className="text-red-700 text-sm">✗ {result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Import Summary:</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.success + summary.errors}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{summary.success}</div>
                  <div className="text-sm text-gray-600">Success</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
              </div>
              
              {summary.success > 0 && (
                <div className="mt-4 text-center">
                  <a
                    href="/database"
                    className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    View Imported Data →
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">Note:</h3>
            <p className="text-sm text-yellow-800">
              Supabase has been removed from this project. This functionality is no longer available.
            </p>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}


