import React, { useState, useEffect } from 'react';
import { Warehouse, RefreshCw, Plus, X, Save, Edit2, Trash2, Download } from 'lucide-react';
import { getConsolidatedOrdersWithTracking, type ConsolidatedArticle } from '../services/orderConsolidationService';
import { createOrderEntry, updateOrderEntry, type OrderEntry, type OrderEntryWithArticle } from '../services/orderService';
import { exportToCSV } from '../utils/csvExport';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ConfirmDialog } from './ConfirmDialog';

const InventoryManagement: React.FC = () => {
  const { user } = useAuth();
  const { showError, showSuccess, showWarning } = useNotifications();
  const [consolidatedOrders, setConsolidatedOrders] = useState<ConsolidatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showOrderForm, setShowOrderForm] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Order form state
  const [orderForm, setOrderForm] = useState<Partial<OrderEntry>>({
    quantity_ordered: 1,
    order_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    total_amount: 0,
  });

  useEffect(() => {
    loadConsolidatedOrders();
  }, []);

  const loadConsolidatedOrders = async () => {
    try {
      setLoading(true);
      const data = await getConsolidatedOrdersWithTracking();
      setConsolidatedOrders(data.articles);
    } catch (error) {
      console.error('Failed to load consolidated orders:', error);
      alert('Failed to load consolidated orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = (articleId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(articleId)) {
      newExpanded.delete(articleId);
    } else {
      newExpanded.add(articleId);
    }
    setExpandedRows(newExpanded);
  };

  const collapseAllRows = () => {
    setExpandedRows(new Set());
    setShowOrderForm(null);
    setEditingOrderId(null);
  };

  const handleCreateOrder = async (articleId: string) => {
    try {
      if (!orderForm.quantity_ordered || orderForm.quantity_ordered <= 0) {
        showWarning('Please enter a valid quantity');
        return;
      }

      await createOrderEntry({
        article_id: articleId,
        quantity_ordered: orderForm.quantity_ordered,
        order_date: orderForm.order_date || new Date().toISOString().split('T')[0],
        status: orderForm.status || 'pending',
        supplier_name: orderForm.supplier_name || null,
        supplier_contact: orderForm.supplier_contact || null,
        unit_price: orderForm.unit_price || null,
        total_amount: orderForm.total_amount || 0,
        expected_delivery_date: orderForm.expected_delivery_date || null,
        notes: orderForm.notes || null,
      } as OrderEntry);

      // Reset form
      setOrderForm({
        quantity_ordered: 1,
        order_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        total_amount: 0,
      });
      setShowOrderForm(null);
      
      // Reload data
      await loadConsolidatedOrders();
      showSuccess('Order created successfully');
    } catch (error: any) {
      console.error('Failed to create order:', error);
      showError(error.message || 'Failed to create order. Please try again.');
    }
  };

  const handleUpdateOrder = async (orderId: string) => {
    try {
      await updateOrderEntry(orderId, orderForm as Partial<OrderEntry>);
      setEditingOrderId(null);
      setOrderForm({
        quantity_ordered: 1,
        order_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        total_amount: 0,
      });
      await loadConsolidatedOrders();
    } catch (error: any) {
      console.error('Failed to update order:', error);
      showError(error.message || 'Failed to update order. Please try again.');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      const { deleteOrderEntry } = await import('../services/orderService');
      await deleteOrderEntry(orderId);
      await loadConsolidatedOrders();
    } catch (error: any) {
      console.error('Failed to delete order:', error);
      showError(error.message || 'Failed to delete order. Please try again.');
    }
  };

  const startEditOrder = (order: OrderEntry, articleId: string) => {
    // Expand the row if not already expanded
    if (!expandedRows.has(articleId)) {
      const newExpanded = new Set(expandedRows);
      newExpanded.add(articleId);
      setExpandedRows(newExpanded);
    }
    setEditingOrderId(order.id!);
    setShowOrderForm(articleId);
    setOrderForm({
      quantity_ordered: order.quantity_ordered,
      order_date: order.order_date,
      status: order.status,
      supplier_name: order.supplier_name || '',
      supplier_contact: order.supplier_contact || '',
      unit_price: order.unit_price || 0,
      total_amount: order.total_amount,
      expected_delivery_date: order.expected_delivery_date || '',
      notes: order.notes || '',
    });
  };

  // Filter articles based on search query
  const filteredArticles = consolidatedOrders.filter(article =>
    article.articleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate totals for filtered articles
  const filteredTotalQuantity = filteredArticles.reduce((sum, article) => sum + article.totalQuantity, 0);
  const filteredTotalQuantityOrdered = filteredArticles.reduce((sum, article) => sum + (article.quantityOrdered || 0), 0);
  const filteredTotalQuantityPending = filteredArticles.reduce((sum, article) => sum + (article.quantityPending || 0), 0);

  const handleExport = async () => {
    try {
      const exportData = filteredArticles.map((article) => ({
        article_name: article.articleName,
        total_quantity_needed: article.totalQuantity,
        quantity_ordered: article.quantityOrdered || 0,
        quantity_received: article.quantityReceived || 0,
        quantity_pending: article.quantityPending || 0,
        total_value: article.totalValue,
        breakdown_district: article.breakdown.district,
        breakdown_public: article.breakdown.public,
        breakdown_institutions: article.breakdown.institutions,
      }));

      exportToCSV(exportData, 'inventory-orders', [
        'article_name',
        'total_quantity_needed',
        'quantity_ordered',
        'quantity_received',
        'quantity_pending',
        'total_value',
        'breakdown_district',
        'breakdown_public',
        'breakdown_institutions',
      ], showWarning);

      // Log export action
      if (user) {
        await logAction(user.id, 'EXPORT', 'order', null, {
          exported_count: exportData.length,
          search_query: searchQuery || null,
        });
      }
      showSuccess(`Exported ${exportData.length} inventory items successfully`);
    } catch (error) {
      console.error('Error exporting inventory:', error);
      showError('Failed to export inventory. Please try again.');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Warehouse className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Order Management
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={loadConsolidatedOrders}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Total Articles
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {consolidatedOrders.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Quantity Needed
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredTotalQuantity.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Quantity Ordered
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {filteredTotalQuantityOrdered.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Quantity Pending
          </div>
          <div className={`text-2xl font-bold ${filteredTotalQuantityPending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {filteredTotalQuantityPending.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Consolidated Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-2"></div>
            <p>Loading consolidated orders...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No orders found.</p>
          </div>
        ) : (
          <div>
            {/* Collapse All Button */}
            {expandedRows.size > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={collapseAllRows}
                  className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  Collapse All ({expandedRows.size})
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Article Name
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Needed
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Ordered
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Received
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredArticles.map((article) => {
                  const isExpanded = expandedRows.has(article.articleId);
                  const pending = article.quantityPending || 0;
                  const orders = article.orderSummary?.orders || [];
                  const quantityOrdered = article.quantityOrdered || 0;
                  const quantityNeeded = article.totalQuantity;
                  const isFulfilled = quantityOrdered >= quantityNeeded;
                  const isExcessOrdered = quantityOrdered > quantityNeeded;
                  
                  return (
                    <React.Fragment key={article.articleId}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        onClick={() => toggleRowExpansion(article.articleId)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {article.articleName}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-semibold">
                          {article.totalQuantity.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-blue-600 dark:text-blue-400 font-semibold">
                          {article.quantityOrdered?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-green-600 dark:text-green-400 font-semibold">
                          {article.quantityReceived?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className={`px-4 py-3 text-sm text-center font-semibold ${pending > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {pending.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {isFulfilled && (
                              <span className={`px-2 py-1 text-xs font-medium rounded ${
                                isExcessOrdered 
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              }`}>
                                {isExcessOrdered ? 'Excess Ordered' : 'Fulfilled'}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Expand the row if not already expanded
                                if (!expandedRows.has(article.articleId)) {
                                  const newExpanded = new Set(expandedRows);
                                  newExpanded.add(article.articleId);
                                  setExpandedRows(newExpanded);
                                }
                                setShowOrderForm(article.articleId);
                                setEditingOrderId(null);
                                setOrderForm({
                                  quantity_ordered: pending > 0 ? Math.min(pending, 1) : 1,
                                  order_date: new Date().toISOString().split('T')[0],
                                  status: 'pending',
                                  total_amount: 0,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Order
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-gray-50 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-4">
                              {/* Order History */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  Order History
                                </h4>
                                {orders.length === 0 ? (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">No orders yet.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Date</th>
                                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">Qty</th>
                                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">Status</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Supplier</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">Amount</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {orders.map((order: OrderEntryWithArticle) => (
                                          <tr key={order.id} className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                                              {new Date(order.order_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-900 dark:text-white">
                                              {order.quantity_ordered}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`px-2 py-1 text-xs rounded ${
                                                order.status === 'received' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                order.status === 'ordered' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                              }`}>
                                                {order.status}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                              {order.supplier_name || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                                              ₹{typeof order.total_amount === 'string' ? parseFloat(order.total_amount).toLocaleString('en-IN') : (order.total_amount || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                <button
                                                  onClick={() => startEditOrder(order as OrderEntry, article.articleId)}
                                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteOrder(order.id!)}
                                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                              
                              {/* Beneficiary Type Breakdown */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  Quantity Needed by Beneficiary Type
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {article.breakdown.district > 0 && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                        District
                                      </div>
                                      <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                        {article.breakdown.district.toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  )}
                                  {article.breakdown.public > 0 && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                      <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                                        Public
                                      </div>
                                      <div className="text-lg font-bold text-green-900 dark:text-green-100">
                                        {article.breakdown.public.toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  )}
                                  {article.breakdown.institutions > 0 && (
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                      <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                                        Institutions & Others
                                      </div>
                                      <div className="text-lg font-bold text-purple-900 dark:text-purple-100">
                                        {article.breakdown.institutions.toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  )}
                                  {article.breakdown.district === 0 && 
                                   article.breakdown.public === 0 && 
                                   article.breakdown.institutions === 0 && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      No beneficiary entries found for this article.
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Order Form */}
                              {showOrderForm === article.articleId && (
                                <div className="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    {editingOrderId ? 'Edit Order' : 'Create New Order'}
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Quantity
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={orderForm.quantity_ordered || 1}
                                        onChange={(e) => setOrderForm({ ...orderForm, quantity_ordered: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                        placeholder="Enter quantity"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Order Date
                                      </label>
                                      <input
                                        type="date"
                                        value={orderForm.order_date || ''}
                                        onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Status
                                      </label>
                                      <select
                                        value={orderForm.status || 'pending'}
                                        onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="ordered">Ordered</option>
                                        <option value="received">Received</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Supplier Name
                                      </label>
                                      <input
                                        type="text"
                                        value={orderForm.supplier_name || ''}
                                        onChange={(e) => setOrderForm({ ...orderForm, supplier_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Unit Price
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={orderForm.unit_price || ''}
                                        onChange={(e) => {
                                          const unitPrice = parseFloat(e.target.value) || 0;
                                          const qty = orderForm.quantity_ordered || 1;
                                          setOrderForm({ ...orderForm, unit_price: unitPrice, total_amount: unitPrice * qty });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Total Amount
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={orderForm.total_amount || 0}
                                        onChange={(e) => setOrderForm({ ...orderForm, total_amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-center gap-2">
                                    <button
                                      onClick={() => editingOrderId ? handleUpdateOrder(editingOrderId) : handleCreateOrder(article.articleId)}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                    >
                                      <Save className="w-4 h-4" />
                                      {editingOrderId ? 'Update' : 'Create'} Order
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowOrderForm(null);
                                        setEditingOrderId(null);
                                        setOrderForm({
                                          quantity_ordered: 1,
                                          order_date: new Date().toISOString().split('T')[0],
                                          status: 'pending',
                                          total_amount: 0,
                                        });
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                    >
                                      <X className="w-4 h-4" />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
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
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
};

export default InventoryManagement;

