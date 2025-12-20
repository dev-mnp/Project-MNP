import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRBAC } from '../contexts/RBACContext';
import { LayoutDashboard, FileText, Package, BarChart3 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, isEditor, isViewer, canWrite, canDelete } = useRBAC();

  const stats = [
    {
      title: 'Total Records',
      value: '0',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      title: 'Inventory Items',
      value: '0',
      icon: Package,
      color: 'bg-green-500',
    },
    {
      title: 'Reports',
      value: '0',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {user?.name || user?.email || 'User'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Role: <span className="font-semibold">{user?.role || 'viewer'}</span>
            {isAdmin && ' • Full Access'}
            {isEditor && ' • Edit Access (No Delete)'}
            {isViewer && ' • Read Only'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canWrite() && (
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                  Add New Entry
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create a new data entry record
                </p>
              </button>
            )}
            
            <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                View Reports
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Access dashboard reports and analytics
              </p>
            </button>

            {isAdmin && (
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                  Manage Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure application settings
                </p>
              </button>
            )}
          </div>
        </div>

        {/* Placeholder for future content */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LayoutDashboard className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Dashboard Ready
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This dashboard is ready for reports and data visualization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
