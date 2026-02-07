import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit2, Trash2, Download, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchFundRequests,
  deleteFundRequest,
  type FundRequest,
} from '../services/fundRequestService';
import { generateFundRequestDocument, storeDocumentMetadata } from '../services/documentGenerationService';
import { useNotifications } from '../contexts/NotificationContext';
import { useRBAC } from '../contexts/RBACContext';
import { CURRENCY_SYMBOL } from '../constants/currency';
import { ConfirmDialog } from './ConfirmDialog';

const FundRequest: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();
  const { canDelete } = useRBAC();
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [filteredFundRequests, setFilteredFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Aid' | 'Article'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Download loading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadFundRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [fundRequests, searchQuery, typeFilter, statusFilter, startDate, endDate]);

  const loadFundRequests = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (typeFilter !== 'all') {
        filters.fund_request_type = typeFilter;
      }
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (startDate) {
        filters.start_date = startDate;
      }
      if (endDate) {
        filters.end_date = endDate;
      }

      const data = await fetchFundRequests(Object.keys(filters).length > 0 ? filters : undefined);
      setFundRequests(data);
    } catch (error) {
      console.error('Failed to load fund requests:', error);
      showError('Failed to load fund requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...fundRequests];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (fr) =>
          fr.fund_request_number.toLowerCase().includes(query)
      );
    }

    setFilteredFundRequests(filtered);
  };

  const handleAdd = () => {
    navigate('/fund-request/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/fund-request/edit/${id}`);
  };

  const handleDelete = (id: string, fundRequestNumber: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Fund Request',
      message: `Are you sure you want to delete fund request ${fundRequestNumber}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteFundRequest(id);
          showSuccess('Fund request deleted successfully.');
          loadFundRequests();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error('Failed to delete fund request:', error);
          showError('Failed to delete fund request. Please try again.');
        }
      },
    });
  };

  const handleDownload = async (id: string, type: 'Aid' | 'Article', fundRequestNumber: string) => {
    try {
      setDownloadingId(id);
      const blob = await generateFundRequestDocument(id, type);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fund_Request_${fundRequestNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Store document metadata
      await storeDocumentMetadata(id, 'fund_request', link.download);
      
      showSuccess('Document downloaded successfully.');
    } catch (error) {
      console.error('Failed to download document:', error);
      showError('Failed to download document. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Fund Request
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage fund requests for Aid and Article types
          </p>
        </div>
        
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Fund Request
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'Aid' | 'Article')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="Aid">Aid</option>
            <option value="Article">Article</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
          
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start Date"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End Date"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredFundRequests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No fund requests found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fund Request Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredFundRequests.map((fundRequest) => (
                  <tr key={fundRequest.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {fundRequest.fund_request_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {fundRequest.fund_request_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(fundRequest.status)}`}>
                        {fundRequest.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {CURRENCY_SYMBOL} {fundRequest.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {fundRequest.created_at ? new Date(fundRequest.created_at).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(fundRequest.id!, fundRequest.fund_request_type, fundRequest.fund_request_number)}
                          disabled={downloadingId === fundRequest.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                          title="Download Document"
                        >
                          {downloadingId === fundRequest.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(fundRequest.id!)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(fundRequest.id!, fundRequest.fund_request_number)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        type={confirmDialog.type || 'danger'}
      />
    </div>
  );
};

export default FundRequest;

