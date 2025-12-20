import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Trash2, Pencil } from 'lucide-react';
import {
  institutionTypes,
  getRecordsByBeneficiaryType,
  addRecord,
  updateRecord,
  deleteRecord,
} from '../data/mockData';
import type {
  MasterEntryRecord,
  Article,
  District,
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

type BeneficiaryType = 'district' | 'public' | 'institutions';

const MasterEntry: React.FC = () => {
  const { canDelete } = useRBAC();
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

  // Form state
  const [formData, setFormData] = useState<Partial<MasterEntryRecord>>({
    beneficiaryType: 'district',
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        } else {
          // Use mock data for other types
          const mockRecords = getRecordsByBeneficiaryType(beneficiaryTypeFilter);
          setRecords(mockRecords);
        }
      } catch (error) {
        console.error('Failed to load records:', error);
        // Fallback to mock data or empty array
        if (beneficiaryTypeFilter === 'district') {
          setRecords([]);
        } else {
          setRecords(getRecordsByBeneficiaryType(beneficiaryTypeFilter));
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

  // Reset form
  const resetForm = () => {
    setFormData({ beneficiaryType: beneficiaryTypeFilter });
    setErrors({});
    setEditingRecordId(null);
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

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

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
          alert('Record not found or missing application number.');
        }
      } catch (error: any) {
        console.error('Failed to delete district entry:', error);
        alert(error.message || 'Failed to delete record. Please try again.');
      }
    } else {
      // For other types, use mock data deletion
      deleteRecord(recordId);
      setRecords(getRecordsByBeneficiaryType(beneficiaryTypeFilter));
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
      if (!formData.aadharNumber || formData.aadharNumber.length !== 16) {
        newErrors.aadharNumber = 'Aadhar number must be 16 digits';
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

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const totalAccrued = calculateTotalAccrued();
    const now = new Date().toISOString();

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
          alert('Failed to generate application number. Please try again.');
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
        alert(error.message || 'Failed to save district entry. Please try again.');
        return;
      }
    }

    // For public type, ensure totalValue is set
    if (formData.beneficiaryType === 'public') {
      const costPerUnit = formData.costPerUnit || 0;
      const quantity = formData.quantity || 0;
      formData.totalValue = costPerUnit * quantity;
    }

    if (editingRecordId) {
      // Update existing record
      updateRecord(editingRecordId, {
        ...formData,
        totalAccrued,
      } as MasterEntryRecord);
    } else {
      // Create new record
      const applicationNumber = generateApplicationNumber(
        formData.beneficiaryType as BeneficiaryType
      );
      const newRecord: MasterEntryRecord = {
        id: Date.now().toString(),
        applicationNumber,
        beneficiaryType: formData.beneficiaryType as BeneficiaryType,
        ...formData,
        totalAccrued,
        createdAt: now,
      } as MasterEntryRecord;
      addRecord(newRecord);
    }

    // Refresh records
    setRecords(getRecordsByBeneficiaryType(beneficiaryTypeFilter));
    resetForm();
    setIsFormMode(false);
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
                ₹{selectedDistrict.allottedBudget.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remaining Fund
              </label>
              <p className={`text-gray-900 dark:text-white font-semibold ${
                remainingFund < 0 ? 'text-red-600 dark:text-red-400' : ''
              }`}>
                {loadingExistingEntries ? (
                  <span className="text-sm">Calculating...</span>
                ) : (
                  `₹${remainingFund.toLocaleString('en-IN')}`
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

        <div className="flex items-end gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Accrued
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-base">
              ₹{calculateTotalAccrued().toLocaleString('en-IN')}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Application Number
          </label>
          <input
            type="text"
            value={
              editingRecordId
                ? formData.applicationNumber || ''
                : generateApplicationNumber('public')
            }
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aadhar Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={16}
            value={formData.aadharNumber || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setFormData({ ...formData, aadharNumber: value });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter 16-digit Aadhar number"
          />
          {errors.aadharNumber && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.aadharNumber}</p>
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
                {article.name} (₹{article.costPerUnit.toLocaleString('en-IN')})
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
            ₹{totalValue.toLocaleString('en-IN')}
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
              ₹{totalValue.toLocaleString('en-IN')}
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

        <div className="flex items-end gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Accrued
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-base">
              ₹{calculateTotalAccrued().toLocaleString('en-IN')}
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
            {records.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
                      ₹{(record.totalAccrued || 0).toLocaleString('en-IN')}
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
                          <span className={remaining < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                            ₹{remaining.toLocaleString('en-IN')}
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
                      ₹{(record.totalValue || 0).toLocaleString('en-IN')}
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
                      ₹{(record.totalAccrued || 0).toLocaleString('en-IN')}
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
              </tr>
            ))}
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
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
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
    </div>
  );
};

export default MasterEntry;
