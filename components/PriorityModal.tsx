'use client';

import { useState, useEffect, useCallback } from 'react';

interface Founder {
  id: string;
  founderName: string;
  companyName: string;
  email: string;
  industry: string;
  reply: string;
}

interface PriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  priority: 'High Priority' | 'Medium Priority' | 'Low Priority' | null;
}

export default function PriorityModal({ isOpen, onClose, priority }: PriorityModalProps) {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFoundersByPriority = useCallback(async () => {
    if (!priority) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/founders-by-priority?priority=${encodeURIComponent(priority)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFounders(data);
    } catch (err) {
      console.error('Error fetching founders by priority:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch founders');
    } finally {
      setLoading(false);
    }
  }, [priority]);

  useEffect(() => {
    if (isOpen && priority) {
      fetchFoundersByPriority();
    } else {
      setFounders([]);
      setError(null);
    }
  }, [isOpen, priority, fetchFoundersByPriority]);

  if (!isOpen) return null;

  const getPriorityColor = () => {
    switch (priority) {
      case 'High Priority':
        return 'text-green-600';
      case 'Medium Priority':
        return 'text-yellow-600';
      case 'Low Priority':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className={`text-2xl font-semibold ${getPriorityColor()}`}>
            {priority} - Founders List
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-700">Loading founders...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg mb-2">⚠️ Error</div>
              <p className="text-gray-700">{error}</p>
              <button
                onClick={fetchFoundersByPriority}
                className="mt-4 bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && founders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-700 text-lg">No founders found for this priority level.</p>
            </div>
          )}

          {!loading && !error && founders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Founder Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Company Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Industry</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Reply</th>
                  </tr>
                </thead>
                <tbody>
                  {founders.map((founder, index) => (
                    <tr
                      key={founder.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="py-3 px-4 text-gray-900">{founder.founderName || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">{founder.companyName || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">{founder.industry || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">{founder.email || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">
                        {founder.reply && founder.reply.trim() !== '' ? (
                          <span className="text-gray-700">{founder.reply}</span>
                        ) : (
                          <span className="text-gray-400 italic">No reply</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold text-gray-900">{founders.length}</span> founders
          </div>
          <button
            onClick={onClose}
            className="bg-gray-900 text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

