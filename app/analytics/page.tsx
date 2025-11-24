'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import EmailStatsDashboard from '../../components/EmailStatsDashboard';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function AnalyticsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Email Analytics Dashboard
                </h1>
                <p className="text-sm text-gray-600 mt-1">Email Statistics Dashboard</p>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto p-6">
            <EmailStatsDashboard />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
