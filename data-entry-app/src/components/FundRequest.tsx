import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit2, Trash2, Download, Search, Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchFundRequests,
  fetchFundRequestById,
  deleteFundRequest,
  type FundRequest as FundRequestType,
  type FundRequestWithDetails,
} from '../services/fundRequestService';
import { generateFundRequestDocument, generatePurchaseOrderPDF, storeDocumentMetadata, ENABLE_XLSX_GENERATION } from '../services/documentGenerationService';
import { useNotifications } from '../contexts/NotificationContext';
import { useRBAC } from '../contexts/RBACContext';
import { useAuth } from '../contexts/AuthContext';
import { CURRENCY_SYMBOL } from '../constants/currency';
import { ConfirmDialog } from './ConfirmDialog';

const FundRequest: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();
  const { canDelete, canCreate, canUpdate, canExport } = useRBAC();
  const { isAuthenticated, isRestoringSession } = useAuth();
  const [fundRequests, setFundRequests] = useState<FundRequestType[]>([]);
  const [filteredFundRequests, setFilteredFundRequests] = useState<FundRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Expanded rows state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedRowDetails, setExpandedRowDetails] = useState<Map<string, FundRequestWithDetails>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Aid' | 'Article'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  // Download loading state - track both ID and type (fr or po)
  const [downloading, setDownloading] = useState<{ id: string; type: 'fr' | 'po' } | null>(null);

  // Only load data when authenticated and not restoring
  useEffect(() => {
    if (isAuthenticated && !isRestoringSession) {
      console.debug('FundRequest: Loading fund requests...');
      loadFundRequests();
    }
  }, [isAuthenticated, isRestoringSession]);

  useEffect(() => {
    applyFilters();
  }, [fundRequests, searchQuery, typeFilter, statusFilter, sortColumn, sortDirection]);

  // Reload data when date filters change
  useEffect(() => {
    if (isAuthenticated && !isRestoringSession) {
      loadFundRequests();
    }
  }, [startDate, endDate]);

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

    // Date filter (client-side for immediate feedback, but data is also filtered server-side)
    if (startDate) {
      filtered = filtered.filter((fr) => {
        if (!fr.created_at) return false;
        const frDate = new Date(fr.created_at).toISOString().split('T')[0];
        return frDate >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter((fr) => {
        if (!fr.created_at) return false;
        const frDate = new Date(fr.created_at).toISOString().split('T')[0];
        return frDate <= endDate;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (fr) =>
          fr.fund_request_number.toLowerCase().includes(query)
      );
    }

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case 'fundRequestNumber':
            aValue = a.fund_request_number || '';
            bValue = b.fund_request_number || '';
            break;
          case 'type':
            aValue = a.fund_request_type || '';
            bValue = b.fund_request_type || '';
            break;
          case 'totalAmount':
            aValue = a.total_amount || 0;
            bValue = b.total_amount || 0;
            break;
          case 'date':
            aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
            bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          default:
            return 0;
        }

        // Compare values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
      });
    }

    setFilteredFundRequests(filtered);
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header - always show indicators
  const getSortIcon = (column: string) => {
    if (sortColumn === column) {
      // Show active sort direction
      return sortDirection === 'asc' ? '↑' : '↓';
    }
    // Show both arrows (lighter color) to indicate sortable
    return '⇅';
  };

  // Toggle row expansion
  const toggleRowExpansion = async (fundRequestId: string) => {
    if (expandedRowId === fundRequestId) {
      // Collapse
      setExpandedRowId(null);
    } else {
      // Expand - close any other expanded row first
      setExpandedRowId(fundRequestId);
      
      if (!expandedRowDetails.has(fundRequestId)) {
        setLoadingDetails(prev => new Set(prev).add(fundRequestId));
        try {
          const details = await fetchFundRequestById(fundRequestId);
          if (details) {
            setExpandedRowDetails(prev => new Map(prev).set(fundRequestId, details));
          }
        } catch (error) {
          console.error('Failed to fetch fund request details:', error);
          showError('Failed to load fund request details.');
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(fundRequestId);
            return newSet;
          });
        }
      }
    }
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
        setIsDeleting(true);
        try {
          await deleteFundRequest(id);
          showSuccess('Fund request deleted successfully.');
          loadFundRequests();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error('Failed to delete fund request:', error);
          showError('Failed to delete fund request. Please try again.');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDownload = async (id: string, type: 'Aid' | 'Article', fundRequestNumber: string) => {
    try {
      setDownloading({ id, type: 'fr' });
      // Hardcoded to landscape - can be changed manually in code if needed
      const blob = await generateFundRequestDocument(id, type, 'landscape');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Use appropriate extension based on flag
      const extension = ENABLE_XLSX_GENERATION ? 'xlsx' : 'pdf';
      console.log("Enable SXLSX:",extension);
      link.download = `Fund_Request_${fundRequestNumber}_${new Date().toISOString().split('T')[0]}.${extension}`;
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
      setDownloading(null);
    }
  };

  const handleDownloadPurchaseOrder = async (id: string, fundRequestNumber: string) => {
    try {
      setDownloading({ id, type: 'po' });
      // const blob = await generatePurchaseOrderDocument(id); //enable it for xlsx download
      const blob = await generatePurchaseOrderPDF(id); // enable it for pdf download
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // link.download = `Purchase_Order_${fundRequestNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;  //enable it for xlsx download
      link.download = `Purchase_Order_${fundRequestNumber}_${new Date().toISOString().split('T')[0]}.pdf`;  //enable it for pdf download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Store document metadata
      await storeDocumentMetadata(id, 'purchase_order', link.download);
      
      showSuccess('Purchase Order downloaded successfully.');
    } catch (error) {
      console.error('Failed to download purchase order:', error);
      showError('Failed to download purchase order. Please try again.');
    } finally {
      setDownloading(null);
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Full-screen loading overlay for deletion */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Deleting fund request...</p>
          </div>
        </div>
      )}
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
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadFundRequests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canCreate() && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Fund Request
            </button>
          )}
        </div>
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
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('fundRequestNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Fund Request Number
                      <span className={`text-xs ${sortColumn === 'fundRequestNumber' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {getSortIcon('fundRequestNumber')}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      <span className={`text-xs ${sortColumn === 'type' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {getSortIcon('type')}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('totalAmount')}
                  >
                    <div className="flex items-center gap-1">
                      Total Amount
                      <span className={`text-xs ${sortColumn === 'totalAmount' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {getSortIcon('totalAmount')}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      <span className={`text-xs ${sortColumn === 'date' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {getSortIcon('date')}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredFundRequests.map((fundRequest) => {
                  const isExpanded = expandedRowId === fundRequest.id;
                  const details = expandedRowDetails.get(fundRequest.id!);
                  const isLoadingDetails = loadingDetails.has(fundRequest.id!);
                  
                  return (
                    <React.Fragment key={fundRequest.id}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleRowExpansion(fundRequest.id!)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="p-1">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </span>
                            {fundRequest.fund_request_number}
                          </div>
                        </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {fundRequest.fund_request_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {CURRENCY_SYMBOL} {fundRequest.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {fundRequest.created_at ? new Date(fundRequest.created_at).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {canExport() && (
                          <>
                            <button
                              onClick={() => handleDownload(fundRequest.id!, fundRequest.fund_request_type, fundRequest.fund_request_number)}
                              disabled={downloading?.id === fundRequest.id && downloading?.type === 'fr'}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                              title="Download FR Document"
                            >
                              {downloading?.id === fundRequest.id && downloading?.type === 'fr' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            {fundRequest.fund_request_type === 'Article' && (
                              <button
                                onClick={() => handleDownloadPurchaseOrder(fundRequest.id!, fundRequest.fund_request_number)}
                                disabled={downloading?.id === fundRequest.id && downloading?.type === 'po'}
                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded transition-colors"
                                title="Download Purchase Order"
                              >
                                {downloading?.id === fundRequest.id && downloading?.type === 'po' ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                        {canUpdate() && (
                          <button
                            onClick={() => handleEdit(fundRequest.id!)}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete() && (
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
                  
                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                        {isLoadingDetails ? (
                          <div className="flex justify-center items-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                          </div>
                        ) : details ? (
                          <div className="space-y-4">
                            {details.fund_request_type === 'Article' ? (
                              <>
                                {/* Supplier Information */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Supplier Information</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.supplier_name || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">GST Number:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.gst_number || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">Address:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.supplier_address || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">City:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.supplier_city || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">State:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.supplier_state || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">Pincode:</span>
                                      <span className="ml-2 text-gray-900 dark:text-white">{details.supplier_pincode || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Articles List */}
                                {details.articles && details.articles.length > 0 && (
                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Articles</h4>
                                      <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Total Articles: {details.articles.length}
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Article Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Supplier Article Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Description</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Quantity</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Unit Price</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                          {details.articles.map((article, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                              <td className="px-3 py-2 text-gray-900 dark:text-white">{article.article_name}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{article.supplier_article_name || '-'}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{article.description || '-'}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{article.quantity}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                {CURRENCY_SYMBOL} {article.price_including_gst?.toLocaleString() || '0'}
                                              </td>
                                              <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                                                {CURRENCY_SYMBOL} {article.value?.toLocaleString() || '0'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Aid Type */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Aid Information</h4>
                                  <div className="text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Aid Type:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{details.aid_type || '-'}</span>
                                  </div>
                                </div>
                                
                                {/* Recipients Breakdown */}
                                {details.recipients && details.recipients.length > 0 && (
                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recipients</h4>
                                      <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Total Recipients: {details.recipients.length}
                                      </span>
                                    </div>
                                    
                                    {/* Beneficiary Type Breakdown */}
                                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">District</div>
                                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {details.recipients.filter(r => r.beneficiary_type === 'District').length}
                                        </div>
                                      </div>
                                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Public</div>
                                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {details.recipients.filter(r => r.beneficiary_type === 'Public').length}
                                        </div>
                                      </div>
                                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Institutions</div>
                                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {details.recipients.filter(r => r.beneficiary_type === 'Institutions').length}
                                        </div>
                                      </div>
                                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Others</div>
                                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {details.recipients.filter(r => r.beneficiary_type === 'Others').length}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Recipients Detail Table */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Beneficiary Type</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Recipient Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Fund Requested</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Aadhaar No</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">District</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                          {details.recipients.map((recipient, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                              <td className="px-3 py-2 text-gray-900 dark:text-white">{recipient.beneficiary_type || '-'}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                {recipient.recipient_name || recipient.name_of_beneficiary || recipient.name_of_institution || '-'}
                                              </td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                {CURRENCY_SYMBOL} {recipient.fund_requested?.toLocaleString() || '0'}
                                              </td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{recipient.aadhar_number || '-'}</td>
                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                {recipient.beneficiary_type === 'District' && recipient.beneficiary
                                                  ? (() => {
                                                      // Extract district name from beneficiary field
                                                      // Format: "D XXX - DistrictName - ₹ amount"
                                                      const parts = recipient.beneficiary.split(' - ');
                                                      return parts.length >= 2 ? parts[1] : '-';
                                                    })()
                                                  : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                            Failed to load details
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
                })}
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

