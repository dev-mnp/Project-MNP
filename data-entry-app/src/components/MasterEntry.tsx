import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Trash2, Pencil, Download, Loader2, Info } from 'lucide-react';
import {
  institutionTypes,
} from '../data/mockData';
import { exportToCSV } from '../utils/csvExport';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import { ConfirmDialog } from './ConfirmDialog';
import type {
  MasterEntryRecord,
  Article,
  District,
  ArticleSelection,
} from '../data/mockData';
import { generateApplicationNumber, generateApplicationNumberFromDB } from '../utils/applicationNumberGenerator';
import MultiSelectArticles from './MultiSelectArticles';
import { useRBAC } from '../contexts/RBACContext';
import { fetchArticles } from '../services/articlesService';
import { fetchDistricts } from '../services/districtsService';
import {
  createDistrictBeneficiaryEntries,
  fetchDistrictBeneficiaryEntriesGrouped,
  deleteDistrictBeneficiaryEntriesByApplicationNumber,
  fetchDistrictBeneficiaryEntries,
  fetchDistrictBeneficiaryEntryByDistrictId,
} from '../services/districtBeneficiaryService';
import {
  createInstitutionBeneficiaryEntries,
  fetchInstitutionBeneficiaryEntriesGrouped,
  deleteInstitutionBeneficiaryEntriesByApplicationNumber,
} from '../services/institutionBeneficiaryService';
import { CURRENCY_SYMBOL } from '../constants/currency';

type BeneficiaryType = 'district' | 'public' | 'institutions';

const MasterEntry: React.FC = () => {
  const { user } = useAuth();
  const { canDelete } = useRBAC();
  const { showError, showSuccess, showWarning } = useNotifications();
  const [beneficiaryTypeFilter, setBeneficiaryTypeFilter] = useState<BeneficiaryType>('district');
  const [isFormMode, setIsFormMode] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [records, setRecords] = useState<MasterEntryRecord[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [existingDistrictEntriesTotal, setExistingDistrictEntriesTotal] = useState(0);
  const [loadingExistingEntries, setLoadingExistingEntries] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exportTypes, setExportTypes] = useState({
    district: true,
    public: false,
    institutions: false,
  });
  const [exporting, setExporting] = useState(false);
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
    onConfirm: () => { },
  });

  // Form state
  const [formData, setFormData] = useState<Partial<MasterEntryRecord>>({
    beneficiaryType: 'district',
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Aadhar verification state
  const [isVerifyingAadhar, setIsVerifyingAadhar] = useState(false);
  const [isAadharVerified, setIsAadharVerified] = useState(false);
  const [matchedHistoryRecords, setMatchedHistoryRecords] = useState<any[]>([]);

  // Fetch articles from database on component mount
  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoadingArticles(true);
        const fetchedArticles = await fetchArticles();
        setArticles(fetchedArticles);
      } catch (error) {
        console.error('Failed to load articles:', error);
        // Fallback to empty array on error
        setArticles([]);
      } finally {
        setLoadingArticles(false);
      }
    };

    loadArticles();
  }, []);

  // Fetch districts from database on component mount
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        setLoadingDistricts(true);
        const fetchedDistricts = await fetchDistricts();
        setDistricts(fetchedDistricts);
      } catch (error) {
        console.error('Failed to load districts:', error);
        // Fallback to empty array on error
        setDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    };

    loadDistricts();
  }, []);

  // Load records when filter changes
  useEffect(() => {
    const loadRecords = async () => {
      try {
        setLoadingRecords(true);

        if (beneficiaryTypeFilter === 'district') {
          // Fetch from database for district type
          const dbRecords = await fetchDistrictBeneficiaryEntriesGrouped();
          setRecords(dbRecords);
        } else if (beneficiaryTypeFilter === 'public') {
          // Fetch from database for public type
          const { data, error } = await supabase
            .from('public_beneficiary_entries')
            .select(`
              id,
              application_number,
              name,
              aadhar_number,
              is_handicapped,
              address,
              mobile,
              article_id,
              quantity,
              total_amount,
              notes,
              status,
              created_at
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;

          // Transform to MasterEntryRecord format
          const publicRecords: MasterEntryRecord[] = (data || []).map((entry: any) => ({
            id: entry.id,
            applicationNumber: entry.application_number || '',
            beneficiaryType: 'public' as const,
            createdAt: entry.created_at,
            aadharNumber: entry.aadhar_number,
            name: entry.name,
            handicapped: entry.is_handicapped,
            address: entry.address,
            mobile: entry.mobile,
            articleId: entry.article_id,
            quantity: entry.quantity,
            costPerUnit: entry.quantity > 0 ? (entry.total_amount / entry.quantity) : 0,
            totalValue: entry.total_amount,
            comments: entry.notes || '',
          }));

          setRecords(publicRecords);
        } else if (beneficiaryTypeFilter === 'institutions') {
          // Institutions: No DB table yet - show empty array
          setRecords([]);
          showWarning('Institutions functionality requires a database table. Please contact the administrator.');
        }
      } catch (error) {
        console.error('Failed to load records:', error);
        setRecords([]);
        if (beneficiaryTypeFilter === 'public') {
          showError('Failed to load public beneficiary entries. Please try again.');
        }
      } finally {
        setLoadingRecords(false);
      }
    };

    loadRecords();
  }, [beneficiaryTypeFilter]);


  // Helper function to get article by ID
  const getArticleById = (id: string): Article | undefined => {
    return articles.find(a => a.id === id);
  };

  // Helper function to get district by ID
  const getDistrictById = (id: string): District | undefined => {
    return districts.find(d => d.id === id);
  };

  // Helper function to detect duplicate articles
  const getDuplicateArticles = (selectedArticles: ArticleSelection[]): Array<{ name: string, count: number }> => {
    const articleCounts = new Map<string, number>();

    selectedArticles.forEach(article => {
      const count = articleCounts.get(article.articleId) || 0;
      articleCounts.set(article.articleId, count + 1);
    });

    const duplicates: Array<{ name: string, count: number }> = [];
    articleCounts.forEach((count, articleId) => {
      if (count > 1) {
        const article = selectedArticles.find(a => a.articleId === articleId);
        if (article) {
          duplicates.push({ name: article.articleName, count });
        }
      }
    });

    return duplicates;
  };

  // Reset form
  const resetForm = () => {
    setFormData({ beneficiaryType: beneficiaryTypeFilter });
    setErrors({});
    setEditingRecordId(null);
    setIsAadharVerified(false);
    setMatchedHistoryRecords([]);
  };

  // Handle Add button click
  const handleAdd = () => {
    resetForm();
    setIsFormMode(true);
  };

  // Handle Cancel
  const handleCancel = () => {
    resetForm();
    setIsFormMode(false);
  };

  // Handle row click to edit
  const handleRowClick = (record: MasterEntryRecord) => {
    setFormData(record);
    setEditingRecordId(record.id);
    setIsFormMode(true);
  };

  // Toggle row expansion
  const toggleRowExpansion = (recordId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRows(newExpanded);
  };

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        await handleDeleteConfirmed(recordId);
      },
    });
  };

  const handleDeleteConfirmed = async (recordId: string) => {
    // For district type, delete from database
    if (beneficiaryTypeFilter === 'district') {
      try {
        const record = records.find((r) => r.id === recordId);
        if (record && record.applicationNumber) {
          await deleteDistrictBeneficiaryEntriesByApplicationNumber(record.applicationNumber);

          // Refresh records from database
          try {
            const dbRecords = await fetchDistrictBeneficiaryEntriesGrouped();
            setRecords(dbRecords);
          } catch (refreshError) {
            console.error('Failed to refresh records after delete:', refreshError);
            // Remove from local state as fallback
            setRecords(records.filter((r) => r.id !== recordId));
          }
        } else {
          showError('Record not found or missing application number.');
        }
      } catch (error: any) {
        console.error('Failed to delete district entry:', error);
        showError(error.message || 'Failed to delete record. Please try again.');
      }
    } else if (beneficiaryTypeFilter === 'public') {
      // Delete from database for public type
      try {
        const { error } = await supabase
          .from('public_beneficiary_entries')
          .delete()
          .eq('id', recordId);

        if (error) throw error;

        // Refresh records from database
        const { data, error: fetchError } = await supabase
          .from('public_beneficiary_entries')
          .select(`
            id,
            application_number,
            name,
            aadhar_number,
            is_handicapped,
            address,
            mobile,
            article_id,
            quantity,
            total_amount,
            notes,
            status,
            created_at
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const publicRecords: MasterEntryRecord[] = (data || []).map((entry: any) => ({
          id: entry.id,
          applicationNumber: entry.application_number || '',
          beneficiaryType: 'public' as const,
          createdAt: entry.created_at,
          aadharNumber: entry.aadhar_number,
          name: entry.name,
          handicapped: entry.is_handicapped,
          address: entry.address,
          mobile: entry.mobile,
          articleId: entry.article_id,
          quantity: entry.quantity,
          costPerUnit: entry.quantity > 0 ? (entry.total_amount / entry.quantity) : 0,
          totalValue: entry.total_amount,
          comments: entry.notes || '',
        }));

        setRecords(publicRecords);
        showSuccess('Entry deleted successfully');
      } catch (error: any) {
        console.error('Failed to delete public entry:', error);
        showError(error.message || 'Failed to delete record. Please try again.');
      }
    } else if (beneficiaryTypeFilter === 'institutions') {
      // Delete from database for institutions type
      try {
        const record = records.find((r) => r.id === recordId);
        if (record && record.applicationNumber) {
          await deleteInstitutionBeneficiaryEntriesByApplicationNumber(record.applicationNumber);

          // Refresh records from database
          try {
            const dbRecords = await fetchInstitutionBeneficiaryEntriesGrouped();
            setRecords(dbRecords);
          } catch (refreshError) {
            console.error('Failed to refresh records after delete:', refreshError);
            // Remove from local state as fallback
            setRecords(records.filter((r) => r.id !== recordId));
          }
        } else {
          showError('Record not found or missing application number.');
        }
        showSuccess('Entry deleted successfully');
      } catch (error: any) {
        console.error('Failed to delete institution entry:', error);
        showError(error.message || 'Failed to delete record. Please try again.');
      }
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.beneficiaryType === 'district') {
      if (!formData.districtId) {
        newErrors.districtId = 'District is required';
      }
      if (!formData.selectedArticles || formData.selectedArticles.length === 0) {
        newErrors.selectedArticles = 'At least one article is required';
      }
    } else if (formData.beneficiaryType === 'public') {
      if (!formData.aadharNumber || formData.aadharNumber.length !== 12) {
        newErrors.aadharNumber = 'Aadhar number must be 12 digits';
      }
      if (!formData.name) {
        newErrors.name = 'Name is required';
      }
      if (!formData.mobile || formData.mobile.length < 10) {
        newErrors.mobile = 'Valid mobile number is required';
      }
      if (!formData.articleId) {
        newErrors.articleId = 'Article is required';
      }
      if (!formData.quantity || formData.quantity <= 0) {
        newErrors.quantity = 'Valid quantity is required';
      }
    } else if (formData.beneficiaryType === 'institutions') {
      if (!formData.institutionName) {
        newErrors.institutionName = 'Name is required';
      }
      if (!formData.institutionType) {
        newErrors.institutionType = 'Institution type is required';
      }
      if (!formData.selectedArticles || formData.selectedArticles.length === 0) {
        newErrors.selectedArticles = 'At least one article is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate total accrued
  const calculateTotalAccrued = (): number => {
    if (formData.beneficiaryType === 'public') {
      return formData.totalValue || 0;
    } else if (
      formData.beneficiaryType === 'district' ||
      formData.beneficiaryType === 'institutions'
    ) {
      return (
        formData.selectedArticles?.reduce((sum, article) => sum + article.totalValue, 0) || 0
      );
    }
    return 0;
  };

  // Normalize Aadhar number (remove spaces and special characters)
  const normalizeAadharNumber = (aadhar: string): string => {
    return aadhar.replace(/\D/g, '');
  };

  // Handle Aadhar verification
  const handleVerifyAadhar = async () => {
    const aadharNumber = formData.aadharNumber;

    if (!aadharNumber || aadharNumber.length !== 12) {
      showError('Please enter a valid 12-digit Aadhar number');
      return;
    }

    try {
      setIsVerifyingAadhar(true);
      const normalizedAadhar = normalizeAadharNumber(aadharNumber);

      // Query public_beneficiary_history table
      // Fetch all records and filter by normalized Aadhar (handles spaces in DB)
      const { data, error } = await supabase
        .from('public_beneficiary_history')
        .select('*')
        .order('year', { ascending: false });

      if (error) {
        console.error('Error verifying Aadhar:', error);
        showError('Failed to verify Aadhar number. Please try again.');
        return;
      }

      // Filter records by normalized Aadhar number (handles spaces in database)
      const matchedRecords = (data || []).filter(record => {
        const recordAadhar = normalizeAadharNumber(record.aadhar_number || '');
        return recordAadhar === normalizedAadhar;
      });

      if (matchedRecords.length > 0) {
        // Aadhar exists in history - store matched records for display in form
        setIsAadharVerified(true);
        setMatchedHistoryRecords(matchedRecords);
      } else {
        // Aadhar doesn't exist - verification successful
        setIsAadharVerified(true);
        setMatchedHistoryRecords([]);
      }
    } catch (error: any) {
      console.error('Error verifying Aadhar:', error);
      showError(error.message || 'Failed to verify Aadhar number. Please try again.');
    } finally {
      setIsVerifyingAadhar(false);
    }
  };

  // Handle save for public entry (extracted for reuse)
  const handleSavePublicEntry = async () => {
    const costPerUnit = formData.costPerUnit || 0;
    const quantity = formData.quantity || 0;
    const totalValue = costPerUnit * quantity;

    try {
      // Generate application number
      const applicationNumber = await generateApplicationNumberFromDB('public');

      if (editingRecordId) {
        // Update existing record
        const { error } = await supabase
          .from('public_beneficiary_entries')
          .update({
            application_number: formData.applicationNumber,
            name: formData.name,
            aadhar_number: formData.aadharNumber,
            is_handicapped: formData.handicapped || false,
            address: formData.address,
            mobile: formData.mobile,
            article_id: formData.articleId,
            quantity: quantity,
            total_amount: totalValue,
            notes: formData.comments || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRecordId);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('public_beneficiary_entries')
          .insert({
            application_number: applicationNumber,
            name: formData.name,
            aadhar_number: formData.aadharNumber,
            is_handicapped: formData.handicapped || false,
            address: formData.address,
            mobile: formData.mobile,
            article_id: formData.articleId,
            quantity: quantity,
            total_amount: totalValue,
            notes: formData.comments || null,
            status: 'pending',
            created_by: user?.id || null,
          });

        if (error) throw error;
      }

      // Refresh records from database
      const { data, error: fetchError } = await supabase
        .from('public_beneficiary_entries')
        .select(`
          id,
          application_number,
          name,
          aadhar_number,
          is_handicapped,
          address,
          mobile,
          article_id,
          quantity,
          total_amount,
          notes,
          status,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const publicRecords: MasterEntryRecord[] = (data || []).map((entry: any) => ({
        id: entry.id,
        applicationNumber: entry.application_number || '',
        beneficiaryType: 'public' as const,
        createdAt: entry.created_at,
        aadharNumber: entry.aadhar_number,
        name: entry.name,
        handicapped: entry.is_handicapped,
        address: entry.address,
        mobile: entry.mobile,
        articleId: entry.article_id,
        quantity: entry.quantity,
        costPerUnit: entry.quantity > 0 ? (entry.total_amount / entry.quantity) : 0,
        totalValue: entry.total_amount,
        comments: entry.notes || '',
      }));

      setRecords(publicRecords);
      resetForm();
      setIsFormMode(false);
      showSuccess(editingRecordId ? 'Entry updated successfully' : 'Entry created successfully');
    } catch (error: any) {
      console.error('Failed to save public entry:', error);
      showError(error.message || 'Failed to save entry. Please try again.');
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // const totalAccrued = calculateTotalAccrued();
    // const now = new Date().toISOString();

    // For district type, save to database
    if (formData.beneficiaryType === 'district' && formData.districtId && formData.selectedArticles && formData.selectedArticles.length > 0) {
      try {
        let applicationNumber = formData.applicationNumber;

        // If editing, use existing application number
        // If new, check if district already has an entry
        if (!editingRecordId && !applicationNumber) {
          // Check if district already has an entry
          const existingEntry = await fetchDistrictBeneficiaryEntryByDistrictId(formData.districtId);
          if (existingEntry) {
            // District already has an entry, use its application number
            applicationNumber = existingEntry.applicationNumber;
            // Delete old entries to replace with new ones
            if (applicationNumber) {
              await deleteDistrictBeneficiaryEntriesByApplicationNumber(applicationNumber);
            }
          } else {
            // New district entry, generate new application number
            applicationNumber = await generateApplicationNumberFromDB('district');
          }
        } else if (editingRecordId && applicationNumber) {
          // Editing existing entry - delete old entries first
          await deleteDistrictBeneficiaryEntriesByApplicationNumber(applicationNumber);
        }

        if (!applicationNumber) {
          showError('Failed to generate application number. Please try again.');
          return;
        }

        // Create one entry per article
        const entries = formData.selectedArticles.map((article) => ({
          district_id: formData.districtId!,
          application_number: applicationNumber,
          article_id: article.articleId,
          quantity: article.quantity,
          article_cost_per_unit: article.costPerUnit,
          total_amount: article.totalValue,
          notes: article.comments || null,
          status: 'pending' as const,
        }));

        await createDistrictBeneficiaryEntries(entries);

        // Refresh records from database
        try {
          const dbRecords = await fetchDistrictBeneficiaryEntriesGrouped();
          setRecords(dbRecords);
        } catch (refreshError) {
          console.error('Failed to refresh records after save:', refreshError);
          // Continue anyway - the save was successful
        }

        resetForm();
        setIsFormMode(false);
        return;
      } catch (error: any) {
        console.error('Failed to save district entry:', error);
        showError(error.message || 'Failed to save district entry. Please try again.');
        return;
      }
    }

    // For public type, save to database
    if (formData.beneficiaryType === 'public') {
      // Check if Aadhar has been verified
      if (!isAadharVerified) {
        showError('Please verify the Aadhar number before saving.');
        return;
      }

      // Check if there are matched history records
      if (matchedHistoryRecords.length > 0) {
        // Extract unique years from matched records
        const years = [...new Set(matchedHistoryRecords.map(record => record.year).filter(Boolean))].sort((a, b) => b - a);
        const yearsText = years.length > 0 ? years.join(', ') : 'previous year(s)';

        // Show confirmation dialog
        setConfirmDialog({
          isOpen: true,
          title: 'Confirm Adding Public Data',
          message: `This Aadhar number has already received benefits in year(s): ${yearsText}. Are you sure you want to add public data for the same Aadhar number?`,
          type: 'warning',
          onConfirm: async () => {
            setConfirmDialog({ ...confirmDialog, isOpen: false });
            await handleSavePublicEntry();
          },
        });
        return;
      }

      // No matched records, proceed with save directly
      await handleSavePublicEntry();
      return;
    }

    // For institutions type, save to database
    if (formData.beneficiaryType === 'institutions') {
      if (!formData.selectedArticles || formData.selectedArticles.length === 0) {
        showError('Please select at least one article.');
        return;
      }

      if (!formData.institutionName) {
        showError('Institution name is required.');
        return;
      }

      if (!formData.institutionType) {
        showError('Institution type is required.');
        return;
      }

      try {
        let applicationNumber = formData.applicationNumber;

        if (!editingRecordId && !applicationNumber) {
          // New institution entry, generate new application number
          applicationNumber = await generateApplicationNumberFromDB('institutions');
        } else if (editingRecordId && applicationNumber) {
          // Editing existing entry - delete old entries first
          await deleteInstitutionBeneficiaryEntriesByApplicationNumber(applicationNumber);
        }

        if (!applicationNumber) {
          showError('Failed to generate application number. Please try again.');
          return;
        }

        // Create one entry per article
        const entries = formData.selectedArticles.map((article) => ({
          institution_name: formData.institutionName!,
          institution_type: formData.institutionType!,
          application_number: applicationNumber,
          address: formData.address || null,
          mobile: formData.mobile || null,
          article_id: article.articleId,
          quantity: article.quantity,
          article_cost_per_unit: article.costPerUnit,
          total_amount: article.totalValue,
          notes: article.comments || null,
          status: 'pending' as const,
          created_by: user?.id || undefined,
        }));

        await createInstitutionBeneficiaryEntries(entries);

        // Refresh records from database
        try {
          const dbRecords = await fetchInstitutionBeneficiaryEntriesGrouped();
          setRecords(dbRecords);
        } catch (refreshError) {
          console.error('Failed to refresh records after save:', refreshError);
          // Continue anyway - the save was successful
        }

        resetForm();
        setIsFormMode(false);
        showSuccess(editingRecordId ? 'Entry updated successfully' : 'Entry created successfully');
        return;
      } catch (error: any) {
        console.error('Failed to save institution entry:', error);
        showError(error.message || 'Failed to save institution entry. Please try again.');
        return;
      }
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExport = async () => {
    if (!exportTypes.district && !exportTypes.public && !exportTypes.institutions) {
      showWarning('Please select at least one beneficiary type to export.');
      return;
    }

    setExporting(true);
    try {
      const exportedTypes: string[] = [];

      // Export District
      if (exportTypes.district) {
        const districtRecords = await fetchDistrictBeneficiaryEntriesGrouped();
        const exportData = districtRecords.flatMap((record) => {
          if (!record.selectedArticles || record.selectedArticles.length === 0) {
            return [{
              application_number: record.applicationNumber,
              district_name: record.districtName || '',
              article_name: '',
              quantity: 0,
              total_amount: 0,
              status: '',
              created_at: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
            }];
          }
          return record.selectedArticles.map((article) => ({
            application_number: record.applicationNumber,
            district_name: record.districtName || '',
            article_name: article.articleName,
            quantity: article.quantity,
            total_amount: article.totalValue,
            status: '',
            created_at: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
          }));
        });

        if (exportData.length > 0) {
          exportToCSV(exportData, 'master-entry-district', [
            'application_number',
            'district_name',
            'article_name',
            'quantity',
            'total_amount',
            'status',
            'created_at',
          ], showWarning);
          exportedTypes.push('district');
        }
      }

      // Export Public
      if (exportTypes.public) {
        const { data: publicData, error: publicError } = await supabase
          .from('public_beneficiary_entries')
          .select(`
            id,
            application_number,
            name,
            aadhar_number,
            is_handicapped,
            address,
            mobile,
            article_id,
            quantity,
            total_amount,
            notes,
            status,
            created_at
          `)
          .order('created_at', { ascending: false });

        if (publicError) {
          showError('Failed to load public records for export.');
          setExporting(false);
          return;
        }

        const publicRecords: MasterEntryRecord[] = (publicData || []).map((entry: any) => ({
          id: entry.id,
          applicationNumber: entry.application_number || '',
          beneficiaryType: 'public' as const,
          createdAt: entry.created_at,
          aadharNumber: entry.aadhar_number,
          name: entry.name,
          handicapped: entry.is_handicapped,
          address: entry.address,
          mobile: entry.mobile,
          articleId: entry.article_id,
          quantity: entry.quantity,
          costPerUnit: entry.quantity > 0 ? (entry.total_amount / entry.quantity) : 0,
          totalValue: entry.total_amount,
          comments: entry.notes || '',
        }));

        const exportData = publicRecords.map((record) => ({
          application_number: record.applicationNumber,
          name: record.name || '',
          aadhar_number: record.aadharNumber || '',
          article_name: record.articleId ? articles.find(a => a.id === record.articleId)?.name || '' : '',
          quantity: record.quantity || 0,
          total_amount: record.totalValue || 0,
          status: '',
          created_at: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
        }));

        if (exportData.length > 0) {
          exportToCSV(exportData, 'master-entry-public', [
            'application_number',
            'name',
            'aadhar_number',
            'article_name',
            'quantity',
            'total_amount',
            'status',
            'created_at',
          ], showError);
          exportedTypes.push('public');
        }
      }

      // Export Institutions
      if (exportTypes.institutions) {
        const institutionsRecords = await fetchInstitutionBeneficiaryEntriesGrouped();
        const exportData = institutionsRecords.flatMap((record) => {
          if (!record.selectedArticles || record.selectedArticles.length === 0) {
            return [{
              application_number: record.applicationNumber,
              institution_name: record.institutionName || '',
              institution_type: record.institutionType || '',
              article_name: '',
              quantity: 0,
              total_amount: 0,
              status: '',
              created_at: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
            }];
          }
          return record.selectedArticles.map((article) => ({
            application_number: record.applicationNumber,
            institution_name: record.institutionName || '',
            institution_type: record.institutionType || '',
            article_name: article.articleName,
            quantity: article.quantity,
            total_amount: article.totalValue,
            status: '',
            created_at: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
          }));
        });

        if (exportData.length > 0) {
          exportToCSV(exportData, 'master-entry-institutions', [
            'application_number',
            'institution_name',
            'institution_type',
            'article_name',
            'quantity',
            'total_amount',
            'status',
            'created_at',
          ], showWarning);
          exportedTypes.push('institutions');
        }
      }

      // Log export action
      if (user) {
        await logAction(user.id, 'EXPORT', 'master_entry', null, {
          exported_types: exportedTypes,
        });
      }

      setShowExportModal(false);
      setExportTypes({ district: true, public: false, institutions: false });
      showSuccess(`Exported ${exportedTypes.length} beneficiary type(s) successfully`);
    } catch (error) {
      console.error('Error exporting master entries:', error);
      showError('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Fetch existing entries for selected district to calculate remaining fund
  useEffect(() => {
    const loadExistingEntries = async () => {
      if (formData.districtId && formData.beneficiaryType === 'district' && isFormMode) {
        try {
          setLoadingExistingEntries(true);
          const entries = await fetchDistrictBeneficiaryEntries(formData.districtId);
          // Calculate total from existing entries (excluding current editing record if editing)
          let total = entries.reduce((sum, entry) => {
            const amount = typeof entry.total_amount === 'string'
              ? parseFloat(entry.total_amount)
              : (entry.total_amount || 0);
            return sum + amount;
          }, 0);

          // If editing, subtract the current record's total from existing entries
          if (editingRecordId) {
            const currentRecord = records.find(r => r.id === editingRecordId);
            if (currentRecord && currentRecord.totalAccrued) {
              total -= currentRecord.totalAccrued;
            }
          }

          setExistingDistrictEntriesTotal(total);
        } catch (error) {
          console.error('Failed to load existing entries for remaining fund calculation:', error);
          setExistingDistrictEntriesTotal(0);
        } finally {
          setLoadingExistingEntries(false);
        }
      } else {
        setExistingDistrictEntriesTotal(0);
      }
    };

    loadExistingEntries();
  }, [formData.districtId, formData.beneficiaryType, isFormMode, editingRecordId, records]);

  // District form
  const renderDistrictForm = () => {
    const selectedDistrict = formData.districtId
      ? getDistrictById(formData.districtId)
      : null;

    // Calculate current form total from selected articles
    const currentFormTotal = formData.selectedArticles?.reduce(
      (sum, article) => sum + article.totalValue,
      0
    ) || 0;

    // Calculate remaining fund: Allotted - (Existing DB entries + Current form selection)
    const remainingFund = selectedDistrict
      ? selectedDistrict.allottedBudget - existingDistrictEntriesTotal - currentFormTotal
      : 0;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            District Name <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.districtId || ''}
            onChange={async (e) => {
              const districtId = e.target.value;
              const district = getDistrictById(districtId);

              // Check if this district already has an entry
              if (districtId && !editingRecordId) {
                try {
                  const existingEntry = await fetchDistrictBeneficiaryEntryByDistrictId(districtId);
                  if (existingEntry) {
                    // District already has an entry, load it for editing
                    setFormData({
                      ...existingEntry,
                      beneficiaryType: 'district',
                    });
                    setEditingRecordId(existingEntry.id);
                  } else {
                    // New district, reset form
                    setFormData({
                      ...formData,
                      districtId: districtId,
                      districtName: district?.name,
                      selectedArticles: [],
                    });
                    setEditingRecordId(null);
                  }
                } catch (error) {
                  console.error('Error checking existing district entry:', error);
                  // On error, just set the district
                  setFormData({
                    ...formData,
                    districtId: districtId,
                    districtName: district?.name,
                  });
                }
              } else {
                // If editing, check if new district has an entry
                if (districtId) {
                  try {
                    const existingEntry = await fetchDistrictBeneficiaryEntryByDistrictId(districtId);
                    if (existingEntry) {
                      // New district has an entry, load it
                      setFormData({
                        ...existingEntry,
                        beneficiaryType: 'district',
                      });
                      setEditingRecordId(existingEntry.id);
                    } else {
                      // New district has no entry, clear selected articles
                      setFormData({
                        ...formData,
                        districtId: districtId,
                        districtName: district?.name,
                        selectedArticles: [],
                      });
                      setEditingRecordId(null);
                    }
                  } catch (error) {
                    console.error('Error checking existing district entry:', error);
                    // On error, clear selected articles and reset editing
                    setFormData({
                      ...formData,
                      districtId: districtId,
                      districtName: district?.name,
                      selectedArticles: [],
                    });
                    setEditingRecordId(null);
                  }
                } else {
                  // District cleared, reset form
                  setFormData({
                    ...formData,
                    districtId: '',
                    districtName: '',
                    selectedArticles: [],
                  });
                  setEditingRecordId(null);
                }
              }
            }}
            disabled={loadingDistricts}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{loadingDistricts ? 'Loading districts...' : 'Select District'}</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
          {errors.districtId && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.districtId}</p>
          )}
        </div>

        {selectedDistrict && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                President
              </label>
              <p className="text-gray-900 dark:text-white">{selectedDistrict.presidentName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mobile Number
              </label>
              <p className="text-gray-900 dark:text-white">{selectedDistrict.mobileNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Allotted Fund
              </label>
              <p className="text-gray-900 dark:text-white">
                {CURRENCY_SYMBOL}{selectedDistrict.allottedBudget.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remaining Fund
              </label>
              <p className={`font-semibold ${remainingFund < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
                }`}>
                {loadingExistingEntries ? (
                  <span className="text-sm">Calculating...</span>
                ) : (
                  `${CURRENCY_SYMBOL}${remainingFund.toLocaleString('en-IN')}`
                )}
              </p>
              {remainingFund < 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Warning: Exceeds allotted budget
                </p>
              )}
            </div>
          </div>
        )}

        <MultiSelectArticles
          articles={articles}
          selectedArticles={formData.selectedArticles || []}
          onArticlesChange={(selected) => {
            setFormData({ ...formData, selectedArticles: selected });
          }}
          label="Select Articles"
          required
          districtId={formData.districtId}
        />
        {errors.selectedArticles && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.selectedArticles}</p>
        )}

        {/* Duplicate Articles Summary */}
        {(() => {
          const duplicateArticles = getDuplicateArticles(formData.selectedArticles || []);
          return duplicateArticles.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Multiple entry article:
                  </p>
                  <ul className="text-xs text-blue-800 dark:text-blue-300 list-disc list-inside">
                    {duplicateArticles.map((dup, idx) => (
                      <li key={idx}>
                        {dup.name} (added {dup.count} times)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex items-end gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Accrued
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-base">
              {CURRENCY_SYMBOL}{calculateTotalAccrued().toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Public form
  const renderPublicForm = () => {
    const selectedArticle = formData.articleId ? getArticleById(formData.articleId) : null;
    const costPerUnit = formData.costPerUnit ?? selectedArticle?.costPerUnit ?? 0;
    const quantity = formData.quantity || 0;
    const totalValue = formData.totalValue ?? costPerUnit * quantity;

    return (
      <div className="space-y-4">
          {editingRecordId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Application Number
              </label>
              <input
                type="text"
                value={
                  formData.applicationNumber || ''
                  // : generateApplicationNumber('public')
                }
                readOnly
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>
          )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aadhar Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={12}
              value={formData.aadharNumber || ''}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData({ ...formData, aadharNumber: value });
                setIsAadharVerified(false); // Reset verification when Aadhar changes
                setMatchedHistoryRecords([]); // Clear matched records when Aadhar changes
              }}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter 12-digit Aadhar number"
            />
            <button
              type="button"
              onClick={handleVerifyAadhar}
              disabled={!formData.aadharNumber || formData.aadharNumber.length !== 12 || isVerifyingAadhar}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
            >
              {isVerifyingAadhar ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify</span>
              )}
            </button>
          </div>
          {errors.aadharNumber && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.aadharNumber}</p>
          )}
          {isAadharVerified && (
            <div className="mt-2">
              {matchedHistoryRecords.length > 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-3">
                    ⚠️ Aadhar number verified - Found {matchedHistoryRecords.length} previous record{matchedHistoryRecords.length > 1 ? 's' : ''}:
                  </p>
                  <div className="space-y-3">
                    {matchedHistoryRecords.map((record, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                        <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          Record {index + 1}:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <div>
                            <span className="font-medium">Name:</span> {record.name || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Year:</span> {record.year || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Article:</span> {record.article_name || 'N/A'}
                          </div>
                          {record.application_number && (
                            <div>
                              <span className="font-medium">App No:</span> {record.application_number}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Handicapped:</span> {record.is_handicapped ? 'Yes' : 'No'}
                          </div>
                          {record.comments && (
                            <div className="md:col-span-2">
                              <span className="font-medium">Comments:</span> {record.comments}
                            </div>
                          )}
                          {record.address && (
                            <div className="md:col-span-2">
                              <span className="font-medium">Address:</span> {record.address}
                            </div>
                          )}
                          {record.mobile && (
                            <div>
                              <span className="font-medium">Mobile:</span> {record.mobile}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Aadhar number verified - No previous records found
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Handicapped
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="handicapped"
                checked={formData.handicapped === true}
                onChange={() => setFormData({ ...formData, handicapped: true })}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="handicapped"
                checked={formData.handicapped === false}
                onChange={() => setFormData({ ...formData, handicapped: false })}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Address
          </label>
          <textarea
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.mobile || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setFormData({ ...formData, mobile: value });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter mobile number"
          />
          {errors.mobile && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.mobile}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Article <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.articleId || ''}
            onChange={(e) => {
              const article = getArticleById(e.target.value);
              setFormData({
                ...formData,
                articleId: e.target.value,
                costPerUnit: article?.costPerUnit || 0,
              });
            }}
            disabled={loadingArticles}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{loadingArticles ? 'Loading articles...' : 'Select Article'}</option>
            {articles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.name} ({CURRENCY_SYMBOL}{article.costPerUnit.toLocaleString('en-IN')})
              </option>
            ))}
          </select>
          {errors.articleId && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.articleId}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cost Per Unit
            </label>
            <input
              type="number"
              value={costPerUnit}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                const newQuantity = formData.quantity || 0;
                setFormData({
                  ...formData,
                  costPerUnit: value,
                  totalValue: value * newQuantity,
                });
              }}
              disabled={false}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10) || 0;
                const currentCostPerUnit = formData.costPerUnit ?? selectedArticle?.costPerUnit ?? 0;
                setFormData({
                  ...formData,
                  quantity: value,
                  totalValue: currentCostPerUnit * value,
                });
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantity}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Total Value
          </label>
          <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium">
            {CURRENCY_SYMBOL}{totalValue.toLocaleString('en-IN')}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Comments
          </label>
          <textarea
            value={formData.comments || ''}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div className="flex items-end gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Accrued
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-base">
              {CURRENCY_SYMBOL}{totalValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Institutions form
  const renderInstitutionsForm = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Application Number
          </label>
          <input
            type="text"
            value={
              editingRecordId
                ? formData.applicationNumber || ''
                : generateApplicationNumber('institutions')
            }
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.institutionName || ''}
            onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors.institutionName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.institutionName}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Institution Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.institutionType || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                institutionType: e.target.value as 'institutions' | 'others',
              })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select Type</option>
            {institutionTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          {errors.institutionType && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.institutionType}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Address
          </label>
          <textarea
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mobile Number
          </label>
          <input
            type="text"
            value={formData.mobile || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setFormData({ ...formData, mobile: value });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter mobile number"
          />
        </div>

        {loadingArticles ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading articles...</div>
        ) : (
          <>
            <MultiSelectArticles
              articles={articles}
              selectedArticles={formData.selectedArticles || []}
              onArticlesChange={(selected) => {
                setFormData({ ...formData, selectedArticles: selected });
              }}
              label="Select Articles"
              required
            />
            {errors.selectedArticles && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.selectedArticles}</p>
            )}
          </>
        )}

        {/* Duplicate Articles Summary */}
        {(() => {
          const duplicateArticles = getDuplicateArticles(formData.selectedArticles || []);
          return duplicateArticles.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Multiple entry article:
                  </p>
                  <ul className="text-xs text-blue-800 dark:text-blue-300 list-disc list-inside">
                    {duplicateArticles.map((dup, idx) => (
                      <li key={idx}>
                        {dup.name} (added {dup.count} times)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex items-end gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Accrued
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-base">
              {CURRENCY_SYMBOL}{calculateTotalAccrued().toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render table
  const renderTable = () => {
    if (loadingRecords) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-2"></div>
          <p>Loading records...</p>
        </div>
      );
    }

    if (records.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No records found for {beneficiaryTypeFilter} type
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {beneficiaryTypeFilter === 'district' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    App Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    District Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Articles
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Total Accrued
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Remaining Fund
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Actions
                  </th>
                </>
              )}
              {beneficiaryTypeFilter === 'public' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    App Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Aadhar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Article
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Total Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Created Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Actions
                  </th>
                </>
              )}
              {beneficiaryTypeFilter === 'institutions' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    App Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Articles
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Total Accrued
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Created Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Actions
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {records.map((record) => {
              const isExpanded = expandedRows.has(record.id);
              const canExpand = (beneficiaryTypeFilter === 'district' || beneficiaryTypeFilter === 'institutions') &&
                record.selectedArticles && record.selectedArticles.length > 0;

              return (
                <React.Fragment key={record.id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${canExpand ? 'cursor-pointer' : ''}`}
                    onClick={() => canExpand && toggleRowExpansion(record.id)}
                  >
                    {beneficiaryTypeFilter === 'district' && (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.applicationNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.districtName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {record.selectedArticles?.length || 0} article(s)
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {CURRENCY_SYMBOL}{(record.totalAccrued || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {(() => {
                            // Calculate remaining fund for this district
                            const district = record.districtId ? getDistrictById(record.districtId) : null;
                            if (!district) return '-';

                            // Get all entries for this district to calculate total used
                            const districtRecords = records.filter(
                              r => r.beneficiaryType === 'district' && r.districtId === record.districtId
                            );
                            const totalUsed = districtRecords.reduce(
                              (sum, r) => sum + (r.totalAccrued || 0),
                              0
                            );
                            const remaining = district.allottedBudget - totalUsed;

                            return (
                              <span className={remaining < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-600 dark:text-green-400'}>
                                {CURRENCY_SYMBOL}{remaining.toLocaleString('en-IN')}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(record);
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canDelete() && (
                              <button
                                onClick={(e) => handleDelete(e, record.id)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    {beneficiaryTypeFilter === 'public' && (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.applicationNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {record.aadharNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {getArticleById(record.articleId || '')?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {CURRENCY_SYMBOL}{(record.totalValue || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(record);
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canDelete() && (
                              <button
                                onClick={(e) => handleDelete(e, record.id)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    {beneficiaryTypeFilter === 'institutions' && (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.applicationNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {record.institutionName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {record.institutionType}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {record.selectedArticles?.length || 0} article(s)
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {CURRENCY_SYMBOL}{(record.totalAccrued || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(record);
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canDelete() && (
                              <button
                                onClick={(e) => handleDelete(e, record.id)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Expanded row for district and institutions */}
                  {isExpanded && canExpand && (
                    <tr>
                      <td
                        colSpan={beneficiaryTypeFilter === 'district' ? 6 : 7}
                        className="px-4 py-4 bg-gray-50 dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                            Articles
                          </h4>
                          {record.selectedArticles && record.selectedArticles.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Article Name</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">Quantity</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">Cost/Unit</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">Total Value</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Comments</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {record.selectedArticles.map((article, idx) => (
                                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                                      <td className="px-3 py-2 text-gray-900 dark:text-white">{article.articleName}</td>
                                      <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{article.quantity}</td>
                                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{CURRENCY_SYMBOL}{article.costPerUnit.toLocaleString('en-IN')}</td>
                                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-medium">{CURRENCY_SYMBOL}{article.totalValue.toLocaleString('en-IN')}</td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{article.comments || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No articles found.</p>
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
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-1">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Beneficiary Type:
            </label>
            <select
              value={beneficiaryTypeFilter}
              onChange={(e) => {
                setBeneficiaryTypeFilter(e.target.value as BeneficiaryType);
                setIsFormMode(false);
                resetForm();
              }}
              disabled={isFormMode}
              className="flex-1 sm:flex-initial min-w-[140px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="district">District</option>
              <option value="public">Public</option>
              <option value="institutions">Institutions & Others</option>
            </select>
          </div>

          <div className="flex items-center gap-3 sm:gap-3 flex-shrink-0">
            {isFormMode ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleExportClick}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isFormMode ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingRecordId ? 'Edit' : 'Add New'} {beneficiaryTypeFilter.charAt(0).toUpperCase() + beneficiaryTypeFilter.slice(1)} Entry
          </h2>

          {formData.beneficiaryType === 'district' && renderDistrictForm()}
          {formData.beneficiaryType === 'public' && renderPublicForm()}
          {formData.beneficiaryType === 'institutions' && renderInstitutionsForm()}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          {renderTable()}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Export Master Entries
              </h2>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportTypes({ district: true, public: false, institutions: false });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select beneficiary types to export. Separate CSV files will be generated for each selected type.
              </p>

              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportTypes.district}
                    onChange={(e) => setExportTypes({ ...exportTypes, district: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 dark:text-white">District</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportTypes.public}
                    onChange={(e) => setExportTypes({ ...exportTypes, public: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 dark:text-white">Public</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportTypes.institutions}
                    onChange={(e) => setExportTypes({ ...exportTypes, institutions: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 dark:text-white">Institutions & Others</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportTypes({ district: true, public: false, institutions: false });
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={exporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting || (!exportTypes.district && !exportTypes.public && !exportTypes.institutions)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default MasterEntry;
