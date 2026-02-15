import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  fetchFundRequestById,
  createFundRequest,
  updateFundRequest,
  type FundRequest,
  type FundRequestRecipient,
} from '../services/fundRequestService';
import { fetchAllArticles, type ArticleRecord } from '../services/articlesService';
import { getConsolidatedOrders } from '../services/orderConsolidationService';
import {
  fetchDistrictBeneficiariesForDropdown,
  fetchPublicBeneficiariesForDropdown,
  fetchInstitutionBeneficiariesForDropdown,
  fetchOthersBeneficiariesForDropdown,
  fetchUsedBeneficiariesForFundRequest,
  type BeneficiaryDropdownOption,
} from '../services/beneficiaryService';
import { fetchDistricts } from '../services/districtsService';
import type { District } from '../data/mockData';
import { useNotifications } from '../contexts/NotificationContext';
import { CURRENCY_SYMBOL } from '../constants/currency';
import MultiSelectArticles from './MultiSelectArticles';
import type { ArticleSelection } from '../data/mockData';

interface RecipientFormData extends Omit<FundRequestRecipient, 'id' | 'fund_request_id' | 'created_at'> {
  beneficiaryType?: 'District' | 'Public' | 'Institutions' | 'Others';
  beneficiaryOptions?: BeneficiaryDropdownOption[];
  loadingBeneficiaries?: boolean;
  selectedDistrictId?: string;
}

const FundRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showError, showSuccess } = useNotifications();
  const [fundRequestType, setFundRequestType] = useState<'Aid' | 'Article'>('Aid');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState<ArticleRecord[]>([]);

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
  const [gstNumber, setGstNumber] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierAddress, setSupplierAddress] = useState<string>('');
  const [supplierCity, setSupplierCity] = useState<string>('');
  const [supplierState, setSupplierState] = useState<string>('');
  const [supplierPincode, setSupplierPincode] = useState<string>('');
  const [articleDetails, setArticleDetails] = useState<Map<string, {
    beneficiary?: string;
    gst_no?: string;
    price_including_gst?: number;
    supplier_article_name?: string;
    cheque_in_favour?: string;
    cheque_sl_no?: string;
  }>>(new Map());

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Aid type dropdown
  const [aidArticles, setAidArticles] = useState<ArticleRecord[]>([]);
  const [loadingAidArticles, setLoadingAidArticles] = useState(false);

  // Districts (for district filter in Aid)
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    loadArticles();
    loadUsedBeneficiaries();
    if (fundRequestType === 'Aid') {
      loadAidArticles();
      loadDistricts();
    }
    if (id) {
      loadFundRequest();
    }
  }, [id]);

  useEffect(() => {
    if (fundRequestType === 'Aid') {
      loadAidArticles();
    }
    // Reload articles when fund request type changes to filter correctly
    loadArticles();
  }, [fundRequestType]);

  // Auto-fill supplier state as "Tamil Nadu" when Fund Request type is Article
  useEffect(() => {
    if (fundRequestType === 'Article' && !supplierState) {
      setSupplierState('Tamil Nadu');
    }
  }, [fundRequestType, supplierState]);

  // Reload beneficiaries when aid_type changes
  useEffect(() => {
    if (fundRequestType === 'Aid' && formData.aid_type) {
      // Clear cache and reload beneficiaries for all recipients
      setBeneficiaryCache({});
      recipients.forEach((_, index) => {
        const recipient = recipients[index];
        if (recipient?.beneficiaryType) {
          loadBeneficiaries(recipient.beneficiaryType, index);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.aid_type]);

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

  // Load Aid articles for dropdown
  const loadAidArticles = async () => {
    try {
      setLoadingAidArticles(true);
      const allArticles = await fetchAllArticles(true);
      const aidArticlesList = allArticles.filter(article => article.item_type === 'Aid');
      setAidArticles(aidArticlesList);
    } catch (error) {
      console.error('Failed to load Aid articles:', error);
      // Don't show error to user, just continue
    } finally {
      setLoadingAidArticles(false);
    }
  };

  // Load districts
  const loadDistricts = async () => {
    try {
      setLoadingDistricts(true);
      const fetchedDistricts = await fetchDistricts();
      setDistricts(fetchedDistricts);
    } catch (error) {
      console.error('Failed to load districts:', error);
      // Don't show error to user, just continue
    } finally {
      setLoadingDistricts(false);
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
      const data = await fetchAllArticles(true);
      // Filter articles by item_type based on fund request type
      if (fundRequestType === 'Article') {
        // For Article fund requests, get split article names from order management
        try {
          const consolidatedOrders = await getConsolidatedOrders();
          const splitArticleNames = new Set<string>();
          
          // Collect all split article names from consolidated orders
          consolidatedOrders.articles.forEach(article => {
            if (article.itemType === 'Article') {
              splitArticleNames.add(article.articleName);
            }
          });
          
          // Get original articles where item_type = 'Article'
          const originalArticles = data.filter(a => a.item_type === 'Article');
          
          // Create a map of original articles by name for quick lookup
          const originalArticlesMap = new Map<string, ArticleRecord>();
          originalArticles.forEach(article => {
            originalArticlesMap.set(article.article_name, article);
          });
          
          // Combine original articles and split articles
          const combinedArticles: ArticleRecord[] = [...originalArticles];
          
          // Add split articles that don't exist in original articles
          splitArticleNames.forEach(splitName => {
            if (!originalArticlesMap.has(splitName)) {
              // Create a virtual article record for the split name
              combinedArticles.push({
                id: splitName, // Use split name as ID
                article_name: splitName,
                article_name_tk: undefined,
                cost_per_unit: 0, // Default to 0 for Fund Request Article
                item_type: 'Article',
                category: undefined,
                is_active: true,
              });
            }
          });
          
          setArticles(combinedArticles);
        } catch (consolidationError) {
          console.error('Failed to load consolidated orders, using original articles only:', consolidationError);
          // Fallback to original articles if consolidation fails
          setArticles(data.filter(a => a.item_type === 'Article'));
        }
      } else {
        // For Aid fund requests, show all articles (existing behavior)
        setArticles(data);
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
      showError('Failed to load articles.');
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
            costPerUnit: a.price_including_gst || a.unit_price, // Use price_including_gst as costPerUnit
            totalValue: a.value,
            supplier_article_name: a.supplier_article_name,
            cheque_in_favour: a.cheque_in_favour,
            description: a.description,
          }));
          setSelectedArticles(articleSelections);
          
          const detailsMap = new Map();
          data.articles.forEach(a => {
            detailsMap.set(a.article_id, {
              beneficiary: a.beneficiary,
              gst_no: a.gst_no,
              price_including_gst: a.price_including_gst,
              supplier_article_name: a.supplier_article_name,
              cheque_in_favour: a.cheque_in_favour,
              cheque_sl_no: a.cheque_sl_no,
            });
          });
          setArticleDetails(detailsMap);
        }
        // Load GST number and supplier fields for Article type
        if (data.fund_request_type === 'Article') {
          if (data.gst_number) setGstNumber(data.gst_number);
          if (data.supplier_name) setSupplierName(data.supplier_name);
          if (data.supplier_address) setSupplierAddress(data.supplier_address);
          if (data.supplier_city) setSupplierCity(data.supplier_city);
          if (data.supplier_state) setSupplierState(data.supplier_state);
          if (data.supplier_pincode) setSupplierPincode(data.supplier_pincode);
        }
      }
    } catch (error) {
      console.error('Failed to load fund request:', error);
      showError('Failed to load fund request.');
    } finally {
      setLoading(false);
    }
  };

  const loadBeneficiaries = async (type: 'District' | 'Public' | 'Institutions' | 'Others', recipientIndex: number, districtId?: string) => {
    // Get current aid_type for filtering
    const currentAidType = formData.aid_type;
    // Get selected district ID - use provided parameter or from current recipient state
    const currentRecipient = recipients[recipientIndex];
    const selectedDistrictId = districtId !== undefined ? districtId : currentRecipient?.selectedDistrictId;
    
    // Check cache first (but only if no aid_type filter and no district filter is applied)
    // When district is selected, we need individual entries with aid types, not grouped cache
    // Always skip cache when districtId is provided (for District type) or when aidType is provided
    const shouldUseCache = beneficiaryCache[type] && !currentAidType && !selectedDistrictId;
    
    if (shouldUseCache) {
      // Only use cache if no aid_type filter and no district filter is applied
      // Filter out already selected beneficiaries (current session + saved)
      // Don't exclude current recipient's selection
      setRecipients(prev => {
        const currentRecipient = prev[recipientIndex];
        const currentSelection = currentRecipient?.beneficiary;
        let currentIdentifier: string | null = null;
        if (currentSelection) {
          // For district beneficiaries, use the display_text directly (since that's what's stored in usedBeneficiaries)
          // For other types, extract app number from display text
          if (type === 'District') {
            currentIdentifier = currentSelection; // Use display_text directly for district
          } else {
            const match = currentSelection.match(/^([^-]+)/);
            if (match) {
              currentIdentifier = match[1].trim();
            }
          }
        }
        
        const allExcluded = new Set([...selectedBeneficiaries, ...usedBeneficiaries]);
        // Don't exclude the current recipient's selection (if any)
        if (currentIdentifier) {
          allExcluded.delete(currentIdentifier);
        }
        
        // For district entries, filter by display_text (since usedBeneficiaries contains full display_text for districts)
        // For other types, filter by application_number
        const filteredData = beneficiaryCache[type]!.filter(option => {
          if (type === 'District') {
            // For district, check if the display_text is in the excluded set
            return !allExcluded.has(option.display_text);
          } else {
            // For other types, check if the application_number is in the excluded set
            return !allExcluded.has(option.application_number);
          }
        });
        
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
          data = await fetchDistrictBeneficiariesForDropdown(currentAidType, selectedDistrictId);
          break;
        case 'Public':
          data = await fetchPublicBeneficiariesForDropdown(currentAidType);
          break;
        case 'Institutions':
          data = await fetchInstitutionBeneficiariesForDropdown(currentAidType);
          break;
        case 'Others':
          data = await fetchOthersBeneficiariesForDropdown(currentAidType);
          break;
      }

      // Update cache (only if no aid_type filter and no district filter, otherwise cache is per filter)
      // Don't cache when district is selected because we want individual entries, not grouped
      if (!currentAidType && !selectedDistrictId) {
        setBeneficiaryCache(prev => ({ ...prev, [type]: data }));
      }

      // Filter out already selected beneficiaries (current session + saved)
      // Use functional update to get latest state
      setRecipients(prev => {
        // Get current selected beneficiaries (excluding current recipient's selection)
        const currentRecipient = prev[recipientIndex];
        const currentSelection = currentRecipient?.beneficiary;
        let currentIdentifier: string | null = null;
        if (currentSelection) {
          // For district beneficiaries, use the display_text directly (since that's what's stored in usedBeneficiaries)
          // For other types, extract app number from display text
          if (type === 'District') {
            currentIdentifier = currentSelection; // Use display_text directly for district
          } else {
            const match = currentSelection.match(/^([^-]+)/);
            if (match) {
              currentIdentifier = match[1].trim();
            }
          }
        }
        
        // Get latest selected beneficiaries state
        const allExcluded = new Set([...selectedBeneficiaries, ...usedBeneficiaries]);
        // Don't exclude the current recipient's selection (if any)
        if (currentIdentifier) {
          allExcluded.delete(currentIdentifier);
        }
        
        // For district entries, filter by display_text (since usedBeneficiaries contains full display_text for districts)
        // For other types, filter by application_number
        const filteredData = data.filter(option => {
          if (type === 'District') {
            // For district, check if the display_text is in the excluded set
            return !allExcluded.has(option.display_text);
          } else {
            // For other types, check if the application_number is in the excluded set
            return !allExcluded.has(option.application_number);
          }
        });

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
    const updatedArticles = selectedArticles.map(article => {
      // For Article fund requests, use costPerUnit as price_including_gst
      const value = article.quantity * article.costPerUnit;
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
        // Beneficiary is optional - can be saved without it (useful when editing existing records)
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
      // Validate GST number and supplier fields for Article type
      if (!gstNumber || gstNumber.trim() === '') {
        newErrors.gst_number = 'GST number is required';
      }
      if (!supplierName || supplierName.trim() === '') {
        newErrors.supplier_name = 'Supplier name is required';
      }
      if (!supplierAddress || supplierAddress.trim() === '') {
        newErrors.supplier_address = 'Supplier address is required';
      }
      if (!supplierCity || supplierCity.trim() === '') {
        newErrors.supplier_city = 'Supplier city is required';
      }
      if (!supplierState || supplierState.trim() === '') {
        newErrors.supplier_state = 'Supplier state is required';
      }
      if (!supplierPincode || supplierPincode.trim() === '') {
        newErrors.supplier_pincode = 'Supplier pincode is required';
      }
      
      if (selectedArticles.length === 0) {
        newErrors.articles = 'At least one article is required';
      }
      
      selectedArticles.forEach((article, index) => {
        // For Article fund requests, validate costPerUnit (which is price_including_gst)
        if (!article.costPerUnit || article.costPerUnit <= 0) {
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
        gst_number: fundRequestType === 'Article' ? gstNumber : undefined,
        supplier_name: fundRequestType === 'Article' ? supplierName : undefined,
        supplier_address: fundRequestType === 'Article' ? supplierAddress : undefined,
        supplier_city: fundRequestType === 'Article' ? supplierCity : undefined,
        supplier_state: fundRequestType === 'Article' ? supplierState : undefined,
        supplier_pincode: fundRequestType === 'Article' ? supplierPincode : undefined,
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
          // Use values from ArticleSelection (cheque_in_favour, supplier_article_name)
          // and sync with articleDetails for price_including_gst
          const details = articleDetails.get(article.articleId) || { price_including_gst: 0 };
          
          return {
            article_id: article.articleId,
            sl_no: index + 1, // Auto-generate SL.NO
            beneficiary: 'Dist & Public', // Auto-set beneficiary
            article_name: article.articleName,
            gst_no: gstNumber, // Use GST number from top field
            quantity: article.quantity,
            unit_price: article.costPerUnit,
            price_including_gst: article.costPerUnit, // Use costPerUnit as price_including_gst
            value: article.totalValue,
            cumulative: 0, // Remove cumulative calculation
            supplier_article_name: article.supplier_article_name || details.supplier_article_name,
            cheque_in_favour: article.cheque_in_favour || details.cheque_in_favour,
            cheque_sl_no: details.cheque_sl_no, // Still from articleDetails (not in ArticleRow yet)
            description: article.description,
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
          // For district beneficiaries, use the display_text (to match usedBeneficiaries)
          // For other types, extract app number from display text
          if (oldRecipient.beneficiaryType === 'District') {
            // Use display_text for district entries to match usedBeneficiaries
            updatedSet.delete(oldRecipient.beneficiary);
          } else {
            const oldAppNumberMatch = oldRecipient.beneficiary.match(/^([^-]+)/);
            if (oldAppNumberMatch) {
              updatedSet.delete(oldAppNumberMatch[1].trim());
            }
          }
        }
        
        // Add new selection
        if (value) {
          const recipient = updated[index];
          
          // Auto-populate fund_requested from beneficiary option
          if (recipient.beneficiaryOptions) {
            const selectedOption = recipient.beneficiaryOptions.find(
              opt => opt.display_text === value
            );
            if (selectedOption) {
              // For district beneficiaries, use the display_text (to match usedBeneficiaries)
              // For other types, extract app number from display text
              if (recipient.beneficiaryType === 'District') {
                // Use display_text for district entries to match usedBeneficiaries
                updatedSet.add(value);
              } else {
                const appNumberMatch = value.match(/^([^-]+)/);
                if (appNumberMatch) {
                  updatedSet.add(appNumberMatch[1].trim());
                }
              }
              
              // Update fund_requested with the total_amount from beneficiary
              if (selectedOption.total_amount) {
                updated[index] = {
                  ...updated[index],
                  fund_requested: selectedOption.total_amount,
                };
              }
              
              // Auto-fill aadhar_number for public beneficiaries if available and field is empty
              if (recipient.beneficiaryType === 'Public' && selectedOption.aadhar_number && !updated[index].aadhar_number) {
                updated[index] = {
                  ...updated[index],
                  aadhar_number: selectedOption.aadhar_number,
                };
              }
              
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
      // For district beneficiaries, use the display_text (to match usedBeneficiaries)
      // For other types, extract app number from display text
      if (oldRecipient.beneficiaryType === 'District') {
        // Use display_text for district entries to match usedBeneficiaries
        setSelectedBeneficiaries(prev => {
          const updatedSet = new Set(prev);
          updatedSet.delete(oldRecipient.beneficiary!);
          return updatedSet;
        });
      } else {
        const appNumberMatch = oldRecipient.beneficiary.match(/^([^-]+)/);
        if (appNumberMatch) {
          setSelectedBeneficiaries(prev => {
            const updatedSet = new Set(prev);
            updatedSet.delete(appNumberMatch[1].trim());
            return updatedSet;
          });
        }
      }
    }
    
    updated[index] = {
      ...updated[index],
      beneficiaryType: type,
      beneficiary: '', // Clear beneficiary when type changes
      beneficiaryOptions: undefined,
      selectedDistrictId: type === 'District' ? updated[index].selectedDistrictId : undefined, // Keep district if still District type
    };
    setRecipients(updated);

    if (type) {
      loadBeneficiaries(type, index);
    }
  };


  const handleArticlesChange = (newArticles: ArticleSelection[]) => {
    setSelectedArticles(newArticles);
    // Initialize details for new articles and sync cheque_in_favour and supplier_article_name
    const updatedDetails = new Map(articleDetails);
    newArticles.forEach(article => {
      const existing = updatedDetails.get(article.articleId) || {
        price_including_gst: 0,
        cheque_in_favour: undefined,
        supplier_article_name: undefined,
      };
      updatedDetails.set(article.articleId, {
        ...existing,
        price_including_gst: article.costPerUnit || existing.price_including_gst || 0,
        cheque_in_favour: article.cheque_in_favour || existing.cheque_in_favour,
        supplier_article_name: article.supplier_article_name || existing.supplier_article_name,
      });
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
            {/* Aid Type Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aid Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.aid_type || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, aid_type: e.target.value || undefined }));
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loadingAidArticles}
              >
                <option value="">Select Aid Type</option>
                {aidArticles.map((article) => (
                  <option key={article.id} value={article.article_name}>
                    {article.article_name}
                  </option>
                ))}
              </select>
              {loadingAidArticles && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Loading aid types...
                </p>
              )}
              {!loadingAidArticles && aidArticles.length === 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  No Aid articles found. Please add Aid articles in Article Management first.
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
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddRecipient();
                  }}
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
                      {/* Beneficiary Type with District Dropdown inline */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Beneficiary Type <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={recipient.beneficiaryType || ''}
                            onChange={(e) => handleBeneficiaryTypeChange(index, e.target.value as any || undefined)}
                            className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                              errors[`beneficiary_type_${index}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <option value="">Select Type</option>
                            <option value="District">District</option>
                            <option value="Public">Public</option>
                            <option value="Institutions">Institutions</option>
                            <option value="Others">Others</option>
                          </select>
                          {/* District Dropdown - Only shown when beneficiary type is District */}
                          {recipient.beneficiaryType === 'District' && (
                            <select
                              value={recipient.selectedDistrictId || ''}
                              onChange={(e) => {
                                const districtIdValue = e.target.value || undefined;
                                const updated = [...recipients];
                                updated[index] = {
                                  ...updated[index],
                                  selectedDistrictId: districtIdValue,
                                  beneficiary: '', // Clear beneficiary when district changes
                                  beneficiaryOptions: undefined, // Clear options to force reload
                                  loadingBeneficiaries: true, // Show loading state
                                };
                                setRecipients(updated);
                                // Reload beneficiaries with new district filter, passing districtId directly
                                // Use setTimeout to ensure state is updated before calling loadBeneficiaries
                                setTimeout(() => {
                                  loadBeneficiaries('District', index, districtIdValue);
                                }, 0);
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              disabled={loadingDistricts}
                              title="Filter by District"
                            >
                              <option value="">All Districts</option>
                              {districts.map((district) => (
                                <option key={district.id} value={district.id}>
                                  {district.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {errors[`beneficiary_type_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`beneficiary_type_${index}`]}</p>
                        )}
                      </div>

                      {/* Beneficiary Selection Dropdown - Always visible */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Beneficiary
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
                              recipient.beneficiaryOptions.map((option, optIndex) => (
                                <option key={`${option.application_number}-${optIndex}`} value={option.display_text}>
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

                      {/* Fund Requested and Aadhaar No in same row */}
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

                      {/* Aadhaar No - moved to right of Fund Requested */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Aadhaar No <span className="text-red-500">*</span>
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
                          placeholder="Enter 12-digit Aadhaar number"
                        />
                        {errors[`aadhar_number_${index}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`aadhar_number_${index}`]}</p>
                        )}
                      </div>

                      {/* Cheque/RTGS in Favour - moved to end, full width */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Cheque/RTGS in Favour
                        </label>
                        <input
                          type="text"
                          value={recipient.cheque_in_favour || ''}
                          onChange={(e) => handleRecipientChange(index, 'cheque_in_favour', e.target.value)}
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
            {/* Supplier Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Supplier Information</h3>
              
              {/* Supplier Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter supplier name"
                />
                {errors.supplier_name && (
                  <p className="mt-1 text-sm text-red-500">{errors.supplier_name}</p>
                )}
              </div>

              {/* GST NUMBER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GST Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter GST number"
                />
                {errors.gst_number && (
                  <p className="mt-1 text-sm text-red-500">{errors.gst_number}</p>
                )}
              </div>

              {/* Supplier Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter supplier address"
                />
                {errors.supplier_address && (
                  <p className="mt-1 text-sm text-red-500">{errors.supplier_address}</p>
                )}
              </div>

              {/* City, State, Pincode in a row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierCity}
                    onChange={(e) => setSupplierCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter city"
                  />
                  {errors.supplier_city && (
                    <p className="mt-1 text-sm text-red-500">{errors.supplier_city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierState}
                    onChange={(e) => setSupplierState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter state"
                  />
                  {errors.supplier_state && (
                    <p className="mt-1 text-sm text-red-500">{errors.supplier_state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierPincode}
                    onChange={(e) => setSupplierPincode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter pincode"
                  />
                  {errors.supplier_pincode && (
                    <p className="mt-1 text-sm text-red-500">{errors.supplier_pincode}</p>
                  )}
                </div>
              </div>
            </div>

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
                  itemType: a.item_type || 'Article',
                  category: a.category,
                }))}
                selectedArticles={selectedArticles}
                onArticlesChange={handleArticlesChange}
                required
                showArticleFRFields={true}
                defaultCostToZero={true}
              />
              
              {selectedArticles.length > 0 && (
                <div className="mt-4 space-y-3">
                  {/* Grand Total */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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

        {/* Notes - Only show for Aid type */}
        {fundRequestType === 'Aid' && (
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
        )}

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
