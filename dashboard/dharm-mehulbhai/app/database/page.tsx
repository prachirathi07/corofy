'use client';

import { useEffect } from 'react';
import DatabaseLayout from '@/components/DatabaseLayout';
import FoundersTable from '@/components/FoundersTable';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DatabasePage() {
  // Scroll to top when component mounts (when navigating to this page)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <ProtectedRoute>
      <DatabaseLayout>
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Founders Database</h1>
            </div>

            <FoundersTable />
          </div>
        </div>
      </DatabaseLayout>
    </ProtectedRoute>
  );
}
