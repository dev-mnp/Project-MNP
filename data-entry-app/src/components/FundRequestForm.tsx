import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  fetchFundRequestById,
  createFundRequest,
  updateFundRequest,
  fetchExistingAidTypes,
  type FundRequest,
  type FundRequestRecipient,
  type FundRequestArticle,
} from '../services/fundRequestService';
import { fetchAllArticles, type ArticleRecord } from '../services/articlesService';
import {
  fetchDistrictBeneficiariesForDropdown,
  fetchPublicBeneficiariesForDropdown,
  fetchInstitutionBeneficiariesForDropdown,
  fetchOthersBeneficiariesForDropdown,
  fetchUsedBeneficiariesForFundRequest,
  type BeneficiaryDropdownOption,
} from '../services/beneficiaryService';
import { useNotifications } from '../contexts/NotificationContext';
import { CURRENCY_SYMBOL } from '../constants/currency';
import MultiSelectArticles from './MultiSelectArticles';
import type { ArticleSelection } from '../data/mockData';

interface RecipientFormData extends Omit<FundRequestRecipient, 'id' | 'fund_request_id' | 'created_at'> {
  beneficiaryType?: 'District' | 'Public' | 'Institutions' | 'Others';
  beneficiaryOptions?: BeneficiaryDropdownOption[];
  loadingBeneficiaries?: boolean;
}

const FundRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showError, showSuccess } = useNotifications();
  const [fundRequestType, setFundRequestType] = useState<'Aid' | 'Article'>('Aid');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Partial<FundRequest>>({
    fund_request_type: 'Aid',
    status: 'draft',
    total_amount: 0,
  });

  // Recipients (for Aid)
  const [recipients, setRecipients] = useState<RecipientFormData[]>([]);

  // Track selected beneficiaries in current session (by application_number)
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<Set<string>>(new Set());

  // Track used beneficiaries from saved fund requests
  const [usedBeneficiaries, setUsedBeneficiaries] = useState<Set<string>>(new Set());

  // Beneficiary data cache
  const [beneficiaryCache, setBeneficiaryCache] = useState<{
    District?: BeneficiaryDropdownOption[];
    Public?: BeneficiaryDropdownOption[];
    Institutions?: BeneficiaryDropdownOption[];
    Others?: BeneficiaryDropdownOption[];
  }>({});

  // Articles (for Article)
  const [selectedArticles, setSelectedArticles] = useState<ArticleSelection[]>([]);
  const [articleDetails, setArticleDetails] = useState<Map<string, {
    beneficiary?: string;
    gst_no?: string;
    price_including_gst: number;
  }>>(new Map());

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Aid type autocomplete
  const [existingAidTypes, setExistingAidTypes] = useState<string[]>([]);
  const [aidTypeInput, setAidTypeInput] = useState('');
  const [showAidTypeSuggestions, setShowAidTypeSuggestions] = useState(false);
  const [loadingAidTypes, setLoadingAidTypes] = useState(false);

  useEffect(() => {
    loadArticles();
    loadUsedBeneficiaries();
    if (fundRequestType === 'Aid') {
      loadExistingAidTypes();
    }
    if (id) {
      loadFundRequest();
    }
  }, [id]);

  useEffect(() => {
    if (fundRequestType === 'Aid') {
      loadExistingAidTypes();
    }
  }, [fundRequestType]);

  // Load used beneficiaries from saved fund requests
  const loadUsedBeneficiaries = async () => {
    try {
      const used = await fetchUsedBeneficiariesForFundRequest(id || undefined);
      setUsedBeneficiaries(used);
    } catch (error) {
      console.error('Failed to load used beneficiaries:', error);
      // Don't show error to user, just continue without filtering
    }
  };

  // Load existing aid types
  const loadExistingAidTypes = async () => {
    try {
      setLoadingAidTypes(true);
      const types = await fetchExistingAidTypes();
      setExistingAidTypes(types);
    } catch (error) {
      console.error('Failed to load existing aid types:', error);
      // Don't show error to user, just continue
    } finally {
      setLoadingAidTypes(false);
    }
  };

  useEffect(() => {
    if (fundRequestType === 'Article') {
      calculateArticleTotals();
    } else {
      calculateAidTotal();
    }
  }, [selectedArticles, articleDetails, recipients, fundRequestType]);

  const loadArticles = async () => {
    try {
      setLoadingArticles(true);
      const data = await fetchAllArticles(true);
      setArticles(data);
    } catch (error) {
      console.error('Failed to load articles:', error);
      showError('Failed to load articles.');
    } finally {
      setLoadingArticles(false);
    }
  };

  const loadFundRequest = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await fetchFundRequestById(id);
      if (data) {
        setFormData(data);
        setFundRequestType(data.fund_request_type);
        setAidTypeInput(data.aid_type || '');
        if (data.recipients) {
          const loadedRecipients = data.recipients.map(r => ({
            beneficiaryType: r.beneficiary_type,
            recipient_name: r.recipient_name,
            beneficiary: r.beneficiary,
            name_of_beneficiary: r.name_of_beneficiary,
            name_of_institution: r.name_of_institution,
            details: r.details,
            fund_requested: r.fund_requested,
            aadhar_number: r.aadhar_number,
            cheque_in_favour: r.cheque_in_favour,
            cheque_sl_no: r.cheque_sl_no,
            notes: r.notes,
          }));
          setRecipients(loadedRecipients);
          
          // Track beneficiaries from loaded data
          const loadedBeneficiaries = new Set<string>();
          loadedRecipients.forEach(r => {
            if (r.beneficiary) {
              const appNumberMatch = r.beneficiary.match(/^([^-]+)/);
              if (appNumberMatch) {
                loadedBeneficiaries.add(appNumberMatch[1].trim());
              }
            }
          });
          setSelectedBeneficiaries(loadedBeneficiaries);
        }
        if (data.articles) {
          const articleSelections: ArticleSelection[] = data.articles.map((a) => ({
            articleId: a.article_id,
            articleName: a.article_name,
            quantity: a.quantity,
            costPerUnit: a.unit_price,
            totalValue: a.value,
            comments: '',
          }));
          setSelectedArticles(articleSelections);
          
          const detailsMap = new Map();
          data.articles.forEach(a => {
            detailsMap.set(a.article_id, {
              beneficiary: a.beneficiary,
              gst_no: a.gst_no,
              price_including_gst: a.price_including_gst,
            });
          });
          setArticleDetails(detailsMap);
        }
      }
    } catch (error) {
      console.error('Failed to load fund request:', error);
      showError('Failed to load fund request.');
    } finally {
      setLoading(false);
    }
  };

  const loadBeneficiaries = async (type: 'District' | 'Public' | 'Institutions' | 'Others', recipientIndex: number) => {
    // Check cache first
    if (beneficiaryCache[type]) {
      // Filter out already selected beneficiaries (current session + saved)
      // Don't exclude current recipient's selection
      setRecipients(prev => {
        const currentRecipient = prev[recipientIndex];
        const currentSelection = currentRecipient?.beneficiary;
        let currentAppNumber: string | null = null;
        if (currentSelection) {
          const match = currentSelection.match(/^([^-]+)/);
          if (match) {
            currentAppNumber = match[1].trim();
          }
        }
        
        const allExcluded = new Set([...selectedBeneficiaries, ...usedBeneficiaries]);
        // Don't exclude the current recipient's selection (if any)
        if (currentAppNumber) {
          allExcluded.delete(currentAppNumber);
        }
        
        const filteredData = beneficiaryCache[type]!.filter(option => !allExcluded.has(option.application_number));
        
        const updated = [...prev];
        updated[recipientIndex] = {
          ...updated[recipientIndex],
          beneficiaryOptions: filteredData,
          loadingBeneficiaries: false,
        };
        return updated;
      });
      return;
    }

    // Set loading state
    setRecipients(prev => {
      const updated = [...prev];
      updated[recipientIndex] = {
        ...updated[recipientIndex],
        loadingBeneficiaries: true,
      };
      return updated;
    });

    try {
      let data: BeneficiaryDropdownOption[] = [];
      
      switch (type) {
        case 'District':
          data = await fetchDistrictBeneficiariesForDropdown();
          break;
        case 'Public':
          data = await fetchPublicBeneficiariesForDropdown();
          break;
        case 'Institutions':
          data = await fetchInstitutionBeneficiariesForDropdown();
          break;
        case 'Others':
          data = await fetchOthersBeneficiariesForDropdown();
          break;
      }

      // Update cache
      setBeneficiaryCache(prev => ({ ...prev, [type]: data }));

      // Filter out already selected beneficiaries (current session + saved)
      // Use functional update to get latest state
      setRecipients(prev => {
        // Get current selected beneficiaries (excluding current recipient's selection)
        const currentRecipient = prev[recipientIndex];
        const currentSelection = currentRecipient?.beneficiary;
        let currentAppNumber: string | null = null;
        if (currentSelection) {
          const match = currentSelection.match(/^([^-]+)/);
          if (match) {
            currentAppNumber = match[1].trim();
          }
        }
        
        // Get latest selected beneficiaries state
        const allExcluded = new Set([...selectedBeneficiaries, ...usedBeneficiaries]);
        // Don't exclude the current recipient's selection (if any)
        if (currentAppNumber) {
          allExcluded.delete(currentAppNumber);
        }
        
        const filteredData = data.filter(option => !allExcluded.has(option.application_number));

        const updated = [...prev];
        updated[recipientIndex] = {
          ...updated[recipientIndex],
          beneficiaryOptions: filteredData,
          loadingBeneficiaries: false,
        };
        return updated;
      });
    } catch (error) {
      console.error(`Failed to load ${type} beneficiaries:`, error);
      showError(`Failed to load ${type} beneficiaries.`);
      setRecipients(prev => {
        const updated = [...prev];
        updated[recipientIndex] = {
          ...updated[recipientIndex],
          loadingBeneficiaries: false,
        };
        return updated;
      });
    }
  };

  const calculateAidTotal = () => {
    const total = recipients.reduce((sum, recipient) => sum + (recipient.fund_requested || 0), 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  };

  const calculateArticleTotals = () => {
    let cumulative = 0;
    const updatedArticles = selectedArticles.map(article => {
      const details = articleDetails.get(article.articleId) || { price_including_gst: 0 };
      const value = article.quantity * details.price_including_gst;
      cumulative += value;
      return {
        ...article,
        totalValue: value,
      };
    });
    
    if (JSON.stringify(updatedArticles) !== JSON.stringify(selectedArticles)) {
      setSelectedArticles(updatedArticles);
    }
    
    const grandTotal = updatedArticles.reduce((sum, a) => sum + a.totalValue, 0);
    setFormData(prev => ({ ...prev, total_amount: grandTotal }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (fundRequestType === 'Aid') {
      if (recipients.length === 0) {
        newErrors.recipients = 'At least one recipient is required';
      }
      
      recipients.forEach((recipient, index) => {
        if (!recipient.beneficiaryType) {
          newErrors[`beneficiary_type_${index}`] = 'Beneficiary type is required';
        }
        if (!recipient.beneficiary) {
          newErrors[`beneficiary_${index}`] = 'Beneficiary is required';
        }
        if (!recipient.name_of_beneficiary && !recipient.recipient_name) {
          newErrors[`name_of_beneficiary_${index}`] = 'Name of beneficiary is required';
        }
        if (!recipient.fund_requested || recipient.fund_requested <= 0) {
          newErrors[`fund_requested_${index}`] = 'Fund requested must be greater than 0';
        }
        if (!recipient.name_of_institution) {
          newErrors[`name_of_institution_${index}`] = 'Name of Institution is required';
        }
        if (!recipient.aadhar_number) {
          newErrors[`aadhar_number_${index}`] = 'Aadhar number is required';
        } else if (!/^\d{12}$/.test(recipient.aadhar_number)) {
          newErrors[`aadhar_number_${index}`] = 'Aadhar number must be exactly 12 digits';
        }
        // cheque_in_favour and cheque_sl_no are optional
      });
    } else {
      if (selectedArticles.length === 0) {
        newErrors.articles = 'At least one article is required';
      }
      
      selectedArticles.forEach((article, index) => {
        const details = articleDetails.get(article.articleId);
        if (!details || !details.price_including_gst || details.price_including_gst <= 0) {
          newErrors[`price_${index}`] = 'Price including GST must be greater than 0';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showError('Please fix the errors in the form.');
      return;
    }

    try {
      setSaving(true);

      const fundRequestData: Omit<FundRequest, 'id' | 'created_at' | 'updated_at'> = {
        fund_request_type: fundRequestType,
        fund_request_number: formData.fund_request_number || '',
        status: formData.status || 'draft',
        total_amount: formData.total_amount || 0,
        aid_type: fundRequestType === 'Aid' ? formData.aid_type : undefined,
        notes: formData.notes,
      };

      if (fundRequestType === 'Aid') {
        if (id) {
          await updateFundRequest(id, {
            fundRequest: fundRequestData,
            recipients: recipients.map(r => ({
              beneficiary_type: r.beneficiaryType,
              recipient_name: r.recipient_name || r.name_of_beneficiary || '',
              beneficiary: r.beneficiary,
              name_of_beneficiary: r.name_of_beneficiary,
              name_of_institution: r.name_of_institution,
              details: r.details,
              fund_requested: r.fund_requested || 0,
              aadhar_number: r.aadhar_number,
              address: r.address,
              cheque_in_favour: r.cheque_in_favour,
              cheque_sl_no: r.cheque_sl_no,
              notes: r.notes,
            })),
          });
        } else {
          await createFundRequest({
            fundRequest: fundRequestData,
            recipients: recipients.map(r => ({
              beneficiary_type: r.beneficiaryType,
              recipient_name: r.recipient_name || r.name_of_beneficiary || '',
              beneficiary: r.beneficiary,
              name_of_beneficiary: r.name_of_beneficiary,
              name_of_institution: r.name_of_institution,
              details: r.details,
              fund_requested: r.fund_requested || 0,
              aadhar_number: r.aadhar_number,
              address: r.address,
              cheque_in_favour: r.cheque_in_favour,
              cheque_sl_no: r.cheque_sl_no,
              notes: r.notes,
            })),
          });
        }
      } else {
        const articlesData = selectedArticles.map((article, index) => {
          const details = articleDetails.get(article.articleId) || { price_including_gst: 0 };
          let cumulative = 0;
          for (let i = 0; i <= index; i++) {
            const art = selectedArticles[i];
            const det = articleDetails.get(art.articleId) || { price_including_gst: 0 };
            cumulative += art.quantity * det.price_including_gst;
          }
          
          return {
            article_id: article.articleId,
            sl_no: index + 1,
            beneficiary: details.beneficiary,
            article_name: article.articleName,
            gst_no: details.gst_no,
            quantity: article.quantity,
            unit_price: article.costPerUnit,
            price_including_gst: details.price_including_gst,
            value: article.totalValue,
            cumulative: cumulative,
          };
        });

        if (id) {
          await updateFundRequest(id, {
            fundRequest: fundRequestData,
            articles: articlesData,
          });
        } else {
          await createFundRequest({
            fundRequest: fundRequestData,
            articles: articlesData,
          });
        }
      }

      showSuccess(id ? 'Fund request updated successfully.' : 'Fund request created successfully.');
      navigate('/fund-request');
    } catch (error) {
      console.error('Failed to save fund request:', error);
      showError('Failed to save fund request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = (insertAfterIndex?: number) => {
    const newRecipient: RecipientFormData = {
      beneficiaryType: undefined,
      recipient_name: '',
      beneficiary: '',
      name_of_beneficiary: '',
      name_of_institution: '',
      details: '',
      fund_requested: 0,
      aadhar_number: '',
      cheque_in_favour: '',
      cheque_sl_no: '',
      notes: '',
    };

    if (insertAfterIndex !== undefined) {
      // Insert after specific index
      const updated = [...recipients];
      updated.splice(insertAfterIndex + 1, 0, newRecipient);
      setRecipients(updated);
    } else {
      // Add to end
      setRecipients([...recipients, newRecipient]);
    }
  };

  const handleRemoveRecipient = (index: number) => {
    const recipientToRemove = recipients[index];
    // Remove beneficiary from tracking if it was selected
    if (recipientToRemove.beneficiary) {
      // Extract application_number from beneficiary display text
      const appNumberMatch = recipientToRemove.beneficiary.match(/^([^-]+)/);
      if (appNumberMatch) {
        setSelectedBeneficiaries(prev => {
          const updated = new Set(prev);
          updated.delete(appNumberMatch[1].trim());
          return updated;
        });
      }
    }
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleRecipientChange = (index: number, field: string, value: any) => {
    const updated = [...recipients];
    const oldRecipient = updated[index];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);

    // Track beneficiary selection/deselection and auto-populate fund_requested
    if (field === 'beneficiary') {
      setSelectedBeneficiaries(prev => {
        const updatedSet = new Set(prev);
        
        // Remove old selection if it existed
        if (oldRecipient.beneficiary) {
          const oldAppNumberMatch = oldRecipient.beneficiary.match(/^([^-]+)/);
          if (oldAppNumberMatch) {
            updatedSet.delete(oldAppNumberMatch[1].trim());
          }
        }
        
        // Add new selection
        if (value) {
          const appNumberMatch = value.match(/^([^-]+)/);
          if (appNumberMatch) {
            updatedSet.add(appNumberMatch[1].trim());
          }
          
          // Auto-populate fund_requested from beneficiary option
          const recipient = updated[index];
          if (recipient.beneficiaryOptions) {
            const selectedOption = recipient.beneficiaryOptions.find(
              opt => opt.display_text === value
            );
            if (selectedOption && selectedOption.total_amount) {
              // Update fund_requested with the total_amount from beneficiary
              updated[index] = {
                ...updated[index],
                fund_requested: selectedOption.total_amount,
              };
              setRecipients(updated);
            }
          }
        }
        
        return updatedSet;
      });
    }
  };

  const handleBeneficiaryTypeChange = (index: number, type: 'District' | 'Public' | 'Institutions' | 'Others' | undefined) => {
    const updated = [...recipients];
    const oldRecipient = updated[index];
    
    // Remove old beneficiary from tracking if it existed
    if (oldRecipient.beneficiary) {
      const appNumberMatch = oldRecipient.beneficiary.match(/^([^-]+)/);
      if (appNumberMatch) {
        setSelectedBeneficiaries(prev => {
          const updatedSet = new Set(prev);
          updatedSet.delete(appNumberMatch[1].trim());
          return updatedSet;
        });
      }
    }
    
    updated[index] = {
      ...updated[index],
      beneficiaryType: type,
      beneficiary: '', // Clear beneficiary when type changes
      beneficiaryOptions: undefined,
    };
    setRecipients(updated);

    if (type) {
      loadBeneficiaries(type, index);
    }
  };

  const handleArticleDetailsChange = (articleId: string, field: string, value: any) => {
    const updated = new Map(articleDetails);
    const current = updated.get(articleId) || { price_including_gst: 0 };
    updated.set(articleId, { ...current, [field]: value });
    setArticleDetails(updated);
  };

  const handleArticlesChange = (newArticles: ArticleSelection[]) => {
    setSelectedArticles(newArticles);
    // Initialize details for new articles
    const updatedDetails = new Map(articleDetails);
    newArticles.forEach(article => {
      if (!updatedDetails.has(article.articleId)) {
        const articleRecord = articles.find(a => a.id === article.articleId);
        updatedDetails.set(article.articleId, {
          price_including_gst: articleRecord?.cost_per_unit || 0,
        });
      }
    });
    setArticleDetails(updatedDetails);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/fund-request')}
          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {id ? 'Edit Fund Request' : 'Create Fund Request'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {id ? 'Update fund request details' : 'Create a new fund request for Aid or Article'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* Type Selection */}
        <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Fund Request Type <span className="text-red-500">*</span>
          </label>
          {usedBeneficiaries.size > 0 && fundRequestType === 'Aid' && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> {usedBeneficiaries.size} beneficiary{usedBeneficiaries.size > 1 ? 'ies have' : ' has'} already been used in other fund requests and will not appear in the dropdown.
              </p>
            </div>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fundRequestType"
                value="Aid"
                checked={fundRequestType === 'Aid'}
                onChange={() => {
                  setFundRequestType('Aid');
                  setFormData(prev => ({ ...prev, fund_request_type: 'Aid' }));
                }}
                className="w-4 h-4 text-blue-600"
                disabled={!!id}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fundRequestType"
                value="Article"
                checked={fundRequestType === 'Article'}
                onChange={() => {
                  setFundRequestType('Article');
                  setFormData(prev => ({ ...prev, fund_request_type: 'Article' }));
                }}
                className="w-4 h-4 text-blue-600"
                disabled={!!id}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Article</span>
            </label>
          </div>
        </div>

        {/* Aid Form */}
        {fundRequestType === 'Aid' && (
          <div className="space-y-6">
            {/* Aid Type Input */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aid Type
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={aidTypeInput}
                  onChange={(e) => {
                    setAidTypeInput(e.target.value);
                    setFormData(prev => ({ ...prev, aid_type: e.target.value }));
                    setShowAidTypeSuggestions(true);
                  }}
                  onFocus={() => setShowAidTypeSuggestions(true)}
                  onBlur={() => {
                    // Delay hiding suggestions to allow click on suggestion
                    setTimeout(() => setShowAidTypeSuggestions(false), 200);
                  }}
                  placeholder="Enter aid type (e.g., Medical Aid, Education Aid, Accident Aid)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {loadingAidTypes && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                {showAidTypeSuggestions && aidTypeInput && existingAidTypes.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {existingAidTypes
                      .filter(type => 
                        type.toLowerCase().includes(aidTypeInput.toLowerCase())
                      )
                      .map((type, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setAidTypeInput(type);
                            setFormData(prev => ({ ...prev, aid_type: type }));
                            setShowAidTypeSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {type}
                        </button>
                      ))}
                    {existingAidTypes.filter(type => 
                      type.toLowerCase().includes(aidTypeInput.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No matching aid types found. Press Enter to create new.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {existingAidTypes.length > 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {existingAidTypes.length} existing aid type{existingAidTypes.length > 1 ? 's' : ''} available. Start typing to search.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recipients <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {recipients.length === 0 
                      ? 'Add at least one recipient to continue' 
                      : `${recipients.length} recipient${recipients.length > 1 ? 's' : ''} added`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRecipient}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </button>
              </div>
              {errors.recipients && (
                <p className="mb-3 text-sm text-red-500">{errors.recipients}</p>
              )}
              <div className="space-y-6">
                {recipients.map((recipient, index) => (
                  <div key={index} className={`p-5 border-2 rounded-lg transition-colors ${
                    index % 2 === 0 
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                          Recipient {index + 1}
                        </span>
                        {recipients.length > 1 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            (of {recipients.length})
                          </span>
                        )}
                      </div>
                      {recipients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(index)}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Remove recipient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Beneficiary Type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Beneficiary Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={recipient.beneficiaryType || ''}
                          onChange={(e) => handleBeneficiaryTypeChange(index, e.target.value as any || undefined)}
                          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            errors[`beneficiary_type_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <option value="">Select Type</option>
                          <option value="District">District</option>
                          <option value="Public">Public</option>
                          <option value="Institutions">Institutions</option>
                          <option value="Others">Others</option>
                        </select>
                        {errors[`beneficiary_type_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`beneficiary_type_${index}`]}</p>
                        )}
                      </div>

                      {/* Beneficiary Selection Dropdown - Always visible */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Beneficiary <span className="text-red-500">*</span>
                          </label>
                          {recipient.beneficiary && (
                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Selected
                            </span>
                          )}
                        </div>
                        {recipient.loadingBeneficiaries ? (
                          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">Loading beneficiaries...</span>
                          </div>
                        ) : (
                          <select
                            value={recipient.beneficiary || ''}
                            onChange={(e) => handleRecipientChange(index, 'beneficiary', e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                              errors[`beneficiary_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                            }`}
                            disabled={recipient.loadingBeneficiaries || !recipient.beneficiaryType}
                          >
                            <option value="">
                              {recipient.beneficiaryType ? 'Select Beneficiary' : 'Select Beneficiary Type first'}
                            </option>
                            {recipient.beneficiaryOptions && recipient.beneficiaryOptions.length > 0 ? (
                              recipient.beneficiaryOptions.map((option) => (
                                <option key={option.application_number} value={option.display_text}>
                                  {option.display_text}
                                </option>
                              ))
                            ) : recipient.beneficiaryType ? (
                              <option value="" disabled>
                                {usedBeneficiaries.size > 0 || selectedBeneficiaries.size > 0
                                  ? 'No available beneficiaries (all are already used)'
                                  : 'No beneficiaries found'}
                              </option>
                            ) : null}
                          </select>
                        )}
                        {errors[`beneficiary_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`beneficiary_${index}`]}</p>
                        )}
                      </div>

                      {/* Name of Beneficiary */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Name of Beneficiary <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={recipient.name_of_beneficiary || recipient.recipient_name || ''}
                          onChange={(e) => {
                            handleRecipientChange(index, 'name_of_beneficiary', e.target.value);
                            handleRecipientChange(index, 'recipient_name', e.target.value);
                          }}
                          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            errors[`name_of_beneficiary_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        {errors[`name_of_beneficiary_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`name_of_beneficiary_${index}`]}</p>
                        )}
                      </div>

                      {/* Name of Institution */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Name of Institution <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={recipient.name_of_institution || ''}
                          onChange={(e) => handleRecipientChange(index, 'name_of_institution', e.target.value)}
                          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            errors[`name_of_institution_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        {errors[`name_of_institution_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`name_of_institution_${index}`]}</p>
                        )}
                      </div>

                      {/* Fund Requested */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Fund Requested <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={recipient.fund_requested || ''}
                          onChange={(e) => handleRecipientChange(index, 'fund_requested', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            errors[`fund_requested_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        {errors[`fund_requested_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`fund_requested_${index}`]}</p>
                        )}
                      </div>

                      {/* Cheque in Favour */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Cheque in Favour
                        </label>
                        <input
                          type="text"
                          value={recipient.cheque_in_favour || ''}
                          onChange={(e) => handleRecipientChange(index, 'cheque_in_favour', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* AAdhar No */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          AAdhar No <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={recipient.aadhar_number || ''}
                          onChange={(e) => {
                            // Only allow digits and limit to 12 characters
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                            handleRecipientChange(index, 'aadhar_number', value);
                          }}
                          maxLength={12}
                          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            errors[`aadhar_number_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                          placeholder="Enter 12-digit Aadhar number"
                        />
                        {errors[`aadhar_number_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`aadhar_number_${index}`]}</p>
                        )}
                      </div>

                      {/* Cheque Sl No */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Cheque Sl No
                        </label>
                        <input
                          type="text"
                          value={recipient.cheque_sl_no || ''}
                          onChange={(e) => handleRecipientChange(index, 'cheque_sl_no', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Details */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Details
                        </label>
                        <textarea
                          value={recipient.details || ''}
                          onChange={(e) => handleRecipientChange(index, 'details', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Add Recipient Button After Each Block */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleAddRecipient(index)}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Add another recipient after this one"
                      >
                        <Plus className="w-4 h-4" />
                        Add Recipient
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Article Form */}
        {fundRequestType === 'Article' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Articles <span className="text-red-500">*</span>
              </label>
              {errors.articles && (
                <p className="mb-2 text-sm text-red-500">{errors.articles}</p>
              )}
              <MultiSelectArticles
                articles={articles.map(a => ({
                  id: a.id,
                  name: a.article_name,
                  costPerUnit: a.cost_per_unit,
                  category: a.category,
                }))}
                selectedArticles={selectedArticles}
                onArticlesChange={handleArticlesChange}
                required
              />
              
              {selectedArticles.length > 0 && (
                <div className="mt-4 space-y-3">
                  {selectedArticles.map((article, index) => {
                    const details = articleDetails.get(article.articleId) || { price_including_gst: 0 };
                    let cumulative = 0;
                    for (let i = 0; i <= index; i++) {
                      const art = selectedArticles[i];
                      const det = articleDetails.get(art.articleId) || { price_including_gst: 0 };
                      cumulative += art.quantity * det.price_including_gst;
                    }
                    
                    return (
                      <div key={article.articleId} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              SL.NO
                            </label>
                            <input
                              type="number"
                              value={index + 1}
                              readOnly
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              BENIFICIARY
                            </label>
                            <input
                              type="text"
                              value={details.beneficiary || ''}
                              onChange={(e) => handleArticleDetailsChange(article.articleId, 'beneficiary', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              ARTICLE NAME
                            </label>
                            <input
                              type="text"
                              value={article.articleName}
                              readOnly
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              GST NO.
                            </label>
                            <input
                              type="text"
                              value={details.gst_no || ''}
                              onChange={(e) => handleArticleDetailsChange(article.articleId, 'gst_no', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              QTY
                            </label>
                            <input
                              type="number"
                              value={article.quantity}
                              readOnly
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              PRICE INCLUDING GST <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              value={details.price_including_gst || ''}
                              onChange={(e) => {
                                const price = parseFloat(e.target.value) || 0;
                                handleArticleDetailsChange(article.articleId, 'price_including_gst', price);
                              }}
                              min="0"
                              step="0.01"
                              className={`w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                                errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            />
                            {errors[`price_${index}`] && (
                              <p className="mt-1 text-xs text-red-500">{errors[`price_${index}`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              VALUE
                            </label>
                            <input
                              type="text"
                              value={`${CURRENCY_SYMBOL} ${article.totalValue.toLocaleString()}`}
                              readOnly
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              CUMULATIVE
                            </label>
                            <input
                              type="text"
                              value={`${CURRENCY_SYMBOL} ${cumulative.toLocaleString()}`}
                              readOnly
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">GRAND TOTAL:</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {CURRENCY_SYMBOL} {formData.total_amount?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate('/fund-request')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FundRequestForm;
