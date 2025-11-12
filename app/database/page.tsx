import DatabaseLayout from '@/components/DatabaseLayout';
import FoundersTable from '@/components/FoundersTable';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DatabasePage() {
  return (
    <ProtectedRoute>
      <DatabaseLayout>
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Founders Database</h1>
              <p className="mt-2 text-gray-600">
                View and manage all founders stored in the database
              </p>
            </div>
            
            <FoundersTable />
          </div>
        </div>
      </DatabaseLayout>
    </ProtectedRoute>
  );
}
