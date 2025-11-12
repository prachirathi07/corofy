'use client';

import { useState, useEffect } from 'react';
import PriorityModal from './PriorityModal';

interface EmailStats {
  totalEmails: number;
  emailsSent: number;
  emailsNotSent: number;
  emails5MinSent: number;
  emails10MinSent: number;
  emailsReplied: number;
  emailsNotReplied: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  loading: boolean;
  error: string | null;
}

export default function EmailStatsDashboard() {
  const [stats, setStats] = useState<EmailStats>({
    totalEmails: 0,
    emailsSent: 0,
    emailsNotSent: 0,
    emails5MinSent: 0,
    emails10MinSent: 0,
    emailsReplied: 0,
    emailsNotReplied: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    loading: true,
    error: null
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<'High Priority' | 'Medium Priority' | 'Low Priority' | null>(null);

  useEffect(() => {
    fetchEmailStats();
  }, []);

  const fetchEmailStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));
      
      console.log('🔄 Fetching analytics data from /api/analytics');
      console.log('🌐 Current window location:', window.location.href);
      console.log('🔗 Full URL will be:', window.location.origin + '/api/analytics');
      
      const response = await fetch('/api/analytics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
      });
      
      console.log('📡 Analytics API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Analytics response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📊 Analytics data received:', data);
      setStats(prev => ({ ...prev, ...data, loading: false }));
    } catch (error) {
      console.error('❌ Error fetching email stats:', error);
      setStats(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch statistics'
      }));
    }
  };

  const StatCard = ({ title, value, color, icon }: { 
    title: string; 
    value: number; 
    color: string; 
    icon: string; 
  }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );

  if (stats.loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading email statistics...</span>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Statistics</h3>
          <p className="text-gray-600 mb-4">{stats.error}</p>
          <button
            onClick={fetchEmailStats}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Statistics Dashboard</h2>
            <p className="text-gray-600 mt-1">Overview of email campaign performance</p>
          </div>
          <button
            onClick={fetchEmailStats}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <span className="mr-2">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="Total Emails"
          value={stats.totalEmails}
          color="#3B82F6"
          icon="📧"
        />
        <StatCard
          title="Emails Sent"
          value={stats.emailsSent}
          color="#10B981"
          icon="✅"
        />
        <StatCard
          title="Emails Not Sent"
          value={stats.emailsNotSent}
          color="#F59E0B"
          icon="⏳"
        />
        <StatCard
          title="5 Days Followup"
          value={stats.emails5MinSent}
          color="#06B6D4"
          icon="⏰"
        />
        <StatCard
          title="10 Days Followup"
          value={stats.emails10MinSent}
          color="#84CC16"
          icon="🕐"
        />
        <StatCard
          title="Emails Replied"
          value={stats.emailsReplied}
          color="#8B5CF6"
          icon="💬"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reply Rate</h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
              <div 
                className="bg-purple-600 h-4 rounded-full transition-all duration-300"
                style={{ 
                  width: stats.totalEmails > 0 ? `${(stats.emailsReplied / stats.totalEmails) * 100}%` : '0%' 
                }}
              ></div>
            </div>
            <span className="text-2xl font-bold text-purple-600">
              {stats.totalEmails > 0 ? ((stats.emailsReplied / stats.totalEmails) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats.emailsReplied} out of {stats.totalEmails} emails received replies
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Rate</h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
              <div 
                className="bg-green-600 h-4 rounded-full transition-all duration-300"
                style={{ 
                  width: stats.totalEmails > 0 ? `${(stats.emailsSent / stats.totalEmails) * 100}%` : '0%' 
                }}
              ></div>
            </div>
            <span className="text-2xl font-bold text-green-600">
              {stats.totalEmails > 0 ? ((stats.emailsSent / stats.totalEmails) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats.emailsSent} out of {stats.totalEmails} emails were sent
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">5 Days Followup Rate</h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
              <div 
                className="bg-cyan-500 h-4 rounded-full transition-all duration-300"
                style={{ 
                  width: stats.totalEmails > 0 ? `${(stats.emails5MinSent / stats.totalEmails) * 100}%` : '0%' 
                }}
              ></div>
            </div>
            <span className="text-2xl font-bold text-cyan-500">
              {stats.totalEmails > 0 ? ((stats.emails5MinSent / stats.totalEmails) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats.emails5MinSent} out of {stats.totalEmails} emails got 5 days followup
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">10 Days Followup Rate</h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
              <div 
                className="bg-lime-500 h-4 rounded-full transition-all duration-300"
                style={{ 
                  width: stats.totalEmails > 0 ? `${(stats.emails10MinSent / stats.totalEmails) * 100}%` : '0%' 
                }}
              ></div>
            </div>
            <span className="text-2xl font-bold text-lime-500">
              {stats.totalEmails > 0 ? ((stats.emails10MinSent / stats.totalEmails) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats.emails10MinSent} out of {stats.totalEmails} emails got 10 days followup
          </p>
        </div>
      </div>

      {/* Mail Priority */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mail Priority ℹ️</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-4 transition-colors"
            onClick={() => {
              setSelectedPriority('High Priority');
              setIsModalOpen(true);
            }}
          >
            <div className="text-3xl font-bold text-green-600">{stats.highPriority}</div>
            <div className="text-sm text-gray-600">High Priority</div>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-4 transition-colors"
            onClick={() => {
              setSelectedPriority('Medium Priority');
              setIsModalOpen(true);
            }}
          >
            <div className="text-3xl font-bold text-yellow-600">{stats.mediumPriority}</div>
            <div className="text-sm text-gray-600">Medium Priority</div>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-4 transition-colors"
            onClick={() => {
              setSelectedPriority('Low Priority');
              setIsModalOpen(true);
            }}
          >
            <div className="text-3xl font-bold text-red-600">{stats.lowPriority}</div>
            <div className="text-sm text-gray-600">Low Priority</div>
          </div>
        </div>
      </div>

      {/* Priority Modal */}
      <PriorityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPriority(null);
        }}
        priority={selectedPriority}
      />

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Total Contacts:</span>
            <span className="ml-2 text-gray-900">{stats.totalEmails.toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Successfully Sent:</span>
            <span className="ml-2 text-green-600">{stats.emailsSent.toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">5 Days Followup:</span>
            <span className="ml-2 text-cyan-500">{stats.emails5MinSent.toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">10 Days Followup:</span>
            <span className="ml-2 text-lime-500">{stats.emails10MinSent.toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Received Replies:</span>
            <span className="ml-2 text-purple-600">{stats.emailsReplied.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
