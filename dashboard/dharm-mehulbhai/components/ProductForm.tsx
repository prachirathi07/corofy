'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getIndustries,
  getBrandsByIndustry,
  getChemicalsByBrand,
  getCountriesBySelection,
  getProductBySelection,
  getBrandsByCountry,
  getChemicalsByBrandAndCountry,
  type Product
} from '../lib/productData';
import { scrapeLeads } from '../lib/api/leads';
import { ApiClientError } from '../lib/apiClient';

// Extended list of world countries for the search dropdown
const WORLD_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti',
  'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'North Korea', 'South Korea', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Macedonia', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco',
  'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'Norway', 'Oman', 'Pakistan',
  'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'Spain', 'Sri Lanka', 'Sudan',
  'Suriname', 'Swaziland', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Uruguay', 'USA', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

interface FormData {
  industry: string;
  brandName: string;
  chemicalName: string;
  countries: string[];
}

// SIC Code mapping for Apollo API
const INDUSTRY_SIC_CODES: { [key: string]: string } = {
  'Agrochemical': '2879',
  'Oil & Gas': '1311',
  'Lubricant': '2992'
};

interface CustomIndustry {
  name: string;
  sicCode: string;
}

interface CustomFormData {
  industries: CustomIndustry[];
  brands: { [industry: string]: string[] };
  chemicals: { [key: string]: string[] };
  selectedCountries: string[];
  lastUpdated: string;
}

export default function ProductForm() {
  const [formData, setFormData] = useState<FormData>({
    industry: '',
    brandName: '',
    chemicalName: '',
    countries: []
  });

  // Custom data from API
  const [customIndustries, setCustomIndustries] = useState<CustomIndustry[]>([]);
  const [customBrands, setCustomBrands] = useState<{ [industry: string]: string[] }>({});
  const [customChemicals, setCustomChemicals] = useState<{ [key: string]: string[] }>({});
  const [customSelectedCountries, setCustomSelectedCountries] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableChemicals, setAvailableChemicals] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Progress notification state
  const [showProgressNotification, setShowProgressNotification] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressType, setProgressType] = useState<'loading' | 'success' | 'error'>('loading');

  // Router for navigation
  const router = useRouter();

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    type: 'industry' | 'brand' | 'chemical' | null;
    originalValue: string;
    editedValue: string;
    editedSicCode?: string;
    isNew: boolean; // Track if we're adding new or editing existing
    validationErrors: {
      name?: string;
      sicCode?: string;
    };
  }>({
    isOpen: false,
    type: null,
    originalValue: '',
    editedValue: '',
    editedSicCode: '',
    isNew: false,
    validationErrors: {}
  });

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitPayload, setSubmitPayload] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Error Modal State
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'industry' | 'brand' | 'chemical' | null;
    itemName: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    type: null,
    itemName: '',
    onConfirm: null
  });

  // Refs for form sections (no auto-scrolling needed)
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);
  const productDetailsRef = useRef<HTMLDivElement>(null);

  // Helper to show error modal
  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  // Load custom data from API on mount
  useEffect(() => {
    const loadCustomData = async () => {
      try {
        setIsLoadingData(true);
        const response = await fetch('/api/dynamic-data');
        if (response.ok) {
          const customData: CustomFormData = await response.json();
          console.log('ProductForm: Loaded custom data from API:', customData);

          setCustomIndustries(customData.industries || []);
          setCustomBrands(customData.brands || {});
          setCustomChemicals(customData.chemicals || {});
          setCustomSelectedCountries(customData.selectedCountries || []);
        } else {
          console.error('Failed to load custom data');
          showError('Data Load Error', 'Failed to load form data. Please refresh the page.');
        }
      } catch (error) {
        console.error('Error loading custom form data:', error);
        showError('Network Error', 'Could not connect to the server. Please check your internet connection.');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCustomData();
  }, []);

  // Save custom data to API
  const saveCustomData = async (data: CustomFormData) => {
    try {
      const response = await fetch('/api/dynamic-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save data');
      }

      return true;
    } catch (error) {
      console.error('Error saving custom data:', error);
      showError('Save Error', 'Failed to save your changes. Please try again.');
      return false;
    }
  };

  // Get all industries (static + custom)
  const getAllIndustries = (): string[] => {
    const staticIndustries = getIndustries();
    const customIndustryNames = customIndustries.map(ind => ind.name);
    const allIndustries = [...new Set([...staticIndustries, ...customIndustryNames])];
    return allIndustries;
  };

  // Get industry details (including SIC code) for a given industry name
  const getIndustryDetails = (industryName: string): { name: string; sicCode: string } => {
    // Check custom industries first
    const customIndustry = customIndustries.find(ind => ind.name === industryName);
    if (customIndustry) {
      return customIndustry;
    }

    // Fall back to static SIC codes
    return {
      name: industryName,
      sicCode: INDUSTRY_SIC_CODES[industryName] || ''
    };
  };

  // Get all brands for an industry (static + custom)
  const getAllBrands = (industry: string): string[] => {
    const staticBrands = getBrandsByIndustry(industry);
    const customBrandsForIndustry = customBrands[industry] || [];
    return [...new Set([...staticBrands, ...customBrandsForIndustry])];
  };

  // Get all chemicals for a brand (static + custom)
  const getAllChemicals = (industry: string, brand: string): string[] => {
    const staticChemicals = getChemicalsByBrand(industry, brand);
    const key = `${industry}::${brand}`;
    const customChemicalsForBrand = customChemicals[key] || [];
    return [...new Set([...staticChemicals, ...customChemicalsForBrand])];
  };

  const industries = getAllIndustries();

  // Auto-select first industry on mount or when industries become available
  useEffect(() => {
    if (industries.length > 0 && !formData.industry) {
      const firstIndustry = industries[0];
      handleInputChange('industry', firstIndustry);
    }
  }, [industries.length, customIndustries.length]);

  // Update brands when industry changes
  useEffect(() => {
    if (formData.industry) {
      const brands = getAllBrands(formData.industry);
      setAvailableBrands(brands);
      setAvailableChemicals([]);
      setSelectedProduct(null);

      // Check if this is a custom industry (from API) with no brands/chemicals
      const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);
      const hasNoBrands = brands.length === 0;

      if (isCustomIndustry && hasNoBrands) {
        // For custom industries with no brands, show all world countries directly
        setAvailableCountries(WORLD_COUNTRIES);
        // Pre-select countries from Dynamic Form if available, otherwise reset
        const countriesToSet = customSelectedCountries.length > 0 ? customSelectedCountries : [];
        setFormData(prev => ({ ...prev, brandName: '', chemicalName: '', countries: countriesToSet }));
      } else {
        // For industries with brands, reset everything including countries
        // Always auto-select first brand if available
        const firstBrand = brands.length > 0 ? brands[0] : '';
        setFormData(prev => ({
          ...prev,
          brandName: firstBrand,
          chemicalName: '',
          countries: []
        }));
        setAvailableCountries([]);
      }
    } else {
      setAvailableBrands([]);
      setAvailableChemicals([]);
      setAvailableCountries([]);
      setFormData(prev => ({ ...prev, brandName: '', chemicalName: '', countries: [] }));
    }
  }, [formData.industry, customBrands, customIndustries, customSelectedCountries]);

  // Update chemicals when brand changes
  useEffect(() => {
    if (formData.industry && formData.brandName) {
      const chemicals = getAllChemicals(formData.industry, formData.brandName);
      setAvailableChemicals(chemicals);

      // Always auto-select first chemical if available
      const firstChemical = chemicals.length > 0 ? chemicals[0] : '';
      setFormData(prev => ({
        ...prev,
        chemicalName: firstChemical,
        countries: []
      }));

      setAvailableCountries([]);
      setSelectedProduct(null);
    } else {
      setAvailableChemicals([]);
      setAvailableCountries([]);
    }
  }, [formData.industry, formData.brandName, customChemicals]);

  // Update countries and product when chemical changes OR when industry is selected (for custom industries)
  useEffect(() => {
    if (formData.industry && formData.brandName && formData.chemicalName) {
      // Check if this is a custom industry
      const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);

      if (isCustomIndustry) {
        // For custom industries, show all world countries
        setAvailableCountries(WORLD_COUNTRIES);
        // Pre-select countries from saved data if available
        const countriesToSet = customSelectedCountries.length > 0 ? customSelectedCountries : [];
        setFormData(prev => ({ ...prev, countries: countriesToSet }));
        setSelectedProduct(null);
      } else {
        // Standard flow for static products: industry + brand + chemical selected
        const countries = getCountriesBySelection(formData.industry, formData.brandName, formData.chemicalName);
        setAvailableCountries(countries);
        const product = getProductBySelection(formData.industry, formData.brandName, formData.chemicalName);
        setSelectedProduct(product || null);
        // Select all countries by default for static products
        setFormData(prev => ({ ...prev, countries: countries }));
      }
    } else if (formData.industry) {
      // Check if this is a custom industry that should skip to countries
      const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);
      const brands = getAllBrands(formData.industry);
      const hasNoBrands = brands.length === 0;

      if (isCustomIndustry && hasNoBrands && availableCountries.length === 0) {
        // Custom industry with no brands - countries should already be set in the industry effect
        // This is handled in the industry useEffect above
      } else if (!formData.brandName && !formData.chemicalName) {
        // Reset countries if we're back to just industry selection
        if (!isCustomIndustry || !hasNoBrands) {
          setAvailableCountries([]);
        }
        setSelectedProduct(null);
      }
    } else {
      setAvailableCountries([]);
      setSelectedProduct(null);
    }
  }, [formData.industry, formData.brandName, formData.chemicalName, customIndustries, availableCountries.length, customSelectedCountries]);

  // Auto-select brand and chemical when a country is selected
  useEffect(() => {
    // Only auto-select for static products (not custom industries with no brands)
    const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);
    const brands = getAllBrands(formData.industry);
    const hasNoBrands = brands.length === 0;

    // Skip auto-selection for custom industries with no brands
    if (isCustomIndustry && hasNoBrands) {
      return;
    }

    // Only proceed if we have an industry and at least one country selected
    if (formData.industry && formData.countries.length > 0) {
      // Get the last selected country (most recently added)
      const lastSelectedCountry = formData.countries[formData.countries.length - 1];

      // Find brands that have this country in their target countries
      const matchingBrands = getBrandsByCountry(formData.industry, lastSelectedCountry);

      if (matchingBrands.length > 0) {
        // Auto-select the first matching brand if not already selected or if current brand doesn't match
        const shouldUpdateBrand = !formData.brandName || !matchingBrands.includes(formData.brandName);

        if (shouldUpdateBrand) {
          const selectedBrand = matchingBrands[0];

          // Find chemicals for this brand that target the country
          const matchingChemicals = getChemicalsByBrandAndCountry(formData.industry, selectedBrand, lastSelectedCountry);

          if (matchingChemicals.length > 0) {
            // Auto-select both brand and chemical
            setFormData(prev => ({
              ...prev,
              brandName: selectedBrand,
              chemicalName: matchingChemicals[0]
            }));
          } else {
            // Just select the brand if no matching chemicals
            setFormData(prev => ({
              ...prev,
              brandName: selectedBrand
            }));
          }
        } else if (formData.brandName) {
          // Brand is already selected and matches, check if we need to update chemical
          const matchingChemicals = getChemicalsByBrandAndCountry(formData.industry, formData.brandName, lastSelectedCountry);

          if (matchingChemicals.length > 0) {
            const shouldUpdateChemical = !formData.chemicalName || !matchingChemicals.includes(formData.chemicalName);

            if (shouldUpdateChemical) {
              setFormData(prev => ({
                ...prev,
                chemicalName: matchingChemicals[0]
              }));
            }
          }
        }
      }
    }
  }, [formData.countries, formData.industry, customIndustries]);

  const handleInputChange = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryToggle = (country: string) => {
    setFormData(prev => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter(c => c !== country)
        : [...prev.countries, country]
    }));
  };

  // Handle opening edit modal
  const handleEdit = (type: 'industry' | 'brand' | 'chemical', value: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent triggering the selection button

    const industryDetails = type === 'industry' ? getIndustryDetails(value) : null;

    setEditModal({
      isOpen: true,
      type,
      originalValue: value,
      editedValue: value,
      editedSicCode: industryDetails?.sicCode || '',
      isNew: false,
      validationErrors: {}
    });
  };

  // Handle adding new item
  const handleAddNew = (type: 'industry' | 'brand' | 'chemical', e?: React.MouseEvent) => {
    e?.stopPropagation();

    // For brand and chemical, we need to check if industry/brand is selected
    if (type === 'brand' && !formData.industry) {
      showError('Selection Required', 'Please select an industry first before adding a new brand.');
      return;
    }

    if (type === 'chemical' && (!formData.industry || !formData.brandName)) {
      showError('Selection Required', 'Please select an industry and brand first before adding a new chemical.');
      return;
    }

    setEditModal({
      isOpen: true,
      type,
      originalValue: '',
      editedValue: '',
      editedSicCode: '',
      isNew: true,
      validationErrors: {}
    });
  };

  // Handle saving edited values
  const handleSaveEdit = async () => {
    // Reset validation errors
    const errors: { name?: string; sicCode?: string } = {};

    // Validate name
    if (!editModal.type || !editModal.editedValue.trim()) {
      errors.name = 'Please enter a valid value.';
    }

    // Validate SIC code for industry
    if (editModal.type === 'industry' && !editModal.editedSicCode?.trim()) {
      errors.sicCode = 'Please enter a SIC code for the industry.';
    }

    // If there are errors, update state and return
    if (Object.keys(errors).length > 0) {
      setEditModal(prev => ({ ...prev, validationErrors: errors }));
      return;
    }

    // Clear validation errors
    setEditModal(prev => ({ ...prev, validationErrors: {} }));

    try {
      // Prepare new data structure
      const customData: CustomFormData = {
        industries: [...customIndustries],
        brands: { ...customBrands },
        chemicals: { ...customChemicals },
        selectedCountries: [...customSelectedCountries],
        lastUpdated: new Date().toISOString()
      };

      if (editModal.type === 'industry') {
        const oldIndustryName = editModal.originalValue;
        const newIndustryName = editModal.editedValue.trim();

        if (editModal.isNew) {
          // Add new industry
          customData.industries.push({
            name: newIndustryName,
            sicCode: editModal.editedSicCode || ''
          });
          // Auto-select the new industry
          setFormData(prev => ({ ...prev, industry: newIndustryName }));
        } else {
          // Update existing industry
          const industryIndex = customData.industries.findIndex(ind => ind.name === oldIndustryName);
          if (industryIndex !== -1) {
            // Update existing custom industry
            customData.industries[industryIndex] = {
              name: newIndustryName,
              sicCode: editModal.editedSicCode || ''
            };

            // Update brands key if it exists
            if (customData.brands[oldIndustryName]) {
              customData.brands[newIndustryName] = customData.brands[oldIndustryName];
              delete customData.brands[oldIndustryName];
            }

            // Update chemicals keys
            Object.keys(customData.chemicals).forEach(key => {
              if (key.startsWith(`${oldIndustryName}::`)) {
                const [, brand] = key.split('::');
                const newKey = `${newIndustryName}::${brand}`;
                customData.chemicals[newKey] = customData.chemicals[key];
                delete customData.chemicals[key];
              }
            });
          } else {
            // Add new custom industry if it doesn't exist
            customData.industries.push({
              name: newIndustryName,
              sicCode: editModal.editedSicCode || ''
            });
          }

          // Update formData if this industry is currently selected
          if (formData.industry === oldIndustryName) {
            setFormData(prev => ({ ...prev, industry: newIndustryName }));
          }
        }
      } else if (editModal.type === 'brand') {
        const industry = formData.industry;
        const oldBrandName = editModal.originalValue;
        const newBrandName = editModal.editedValue.trim();

        if (!industry) {
          showError('Validation Error', 'Please select an industry first.');
          setEditModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        // Update brands
        if (!customData.brands[industry]) {
          customData.brands[industry] = [];
        }

        if (editModal.isNew) {
          // Add new brand
          customData.brands[industry].push(newBrandName);
          // Auto-select the new brand
          setFormData(prev => ({ ...prev, brandName: newBrandName }));
        } else {
          // Update existing brand
          const brandIndex = customData.brands[industry].indexOf(oldBrandName);
          if (brandIndex !== -1) {
            customData.brands[industry][brandIndex] = newBrandName;
          } else {
            customData.brands[industry].push(newBrandName);
          }

          // Update chemicals keys
          const oldKey = `${industry}::${oldBrandName}`;
          const newKey = `${industry}::${newBrandName}`;
          if (customData.chemicals[oldKey]) {
            customData.chemicals[newKey] = customData.chemicals[oldKey];
            delete customData.chemicals[oldKey];
          }

          // Update formData if this brand is currently selected
          if (formData.brandName === oldBrandName) {
            setFormData(prev => ({ ...prev, brandName: newBrandName }));
          }
        }
      } else if (editModal.type === 'chemical') {
        const industry = formData.industry;
        const brand = formData.brandName;
        const oldChemicalName = editModal.originalValue;
        const newChemicalName = editModal.editedValue.trim();

        if (!industry || !brand) {
          showError('Validation Error', 'Please select an industry and brand first.');
          setEditModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        const key = `${industry}::${brand}`;
        if (!customData.chemicals[key]) {
          customData.chemicals[key] = [];
        }

        if (editModal.isNew) {
          // Add new chemical
          customData.chemicals[key].push(newChemicalName);
          // Auto-select the new chemical
          setFormData(prev => ({ ...prev, chemicalName: newChemicalName }));
        } else {
          // Update existing chemical
          const chemicalIndex = customData.chemicals[key].indexOf(oldChemicalName);
          if (chemicalIndex !== -1) {
            customData.chemicals[key][chemicalIndex] = newChemicalName;
          } else {
            customData.chemicals[key].push(newChemicalName);
          }

          // Update formData if this chemical is currently selected
          if (formData.chemicalName === oldChemicalName) {
            setFormData(prev => ({ ...prev, chemicalName: newChemicalName }));
          }
        }
      }

      // Save to API
      const success = await saveCustomData(customData);

      if (success) {
        // Update local state
        setCustomIndustries(customData.industries);
        setCustomBrands(customData.brands);
        setCustomChemicals(customData.chemicals);

        setEditModal({ isOpen: false, type: null, originalValue: '', editedValue: '', editedSicCode: '', isNew: false, validationErrors: {} });
        setSubmitMessage(editModal.isNew ? 'New item added successfully!' : 'Changes saved successfully!');

        setTimeout(() => {
          setSubmitMessage('');
        }, 3000);
      } else {
        showError('Save Error', 'Failed to save changes. Please try again.');
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      showError('System Error', 'An unexpected error occurred while saving. Please try again.');
    }
  };

  // Handle closing edit modal
  const handleCloseEdit = () => {
    setEditModal({ isOpen: false, type: null, originalValue: '', editedValue: '', editedSicCode: '', isNew: false, validationErrors: {} });
  };

  // Handle deleting custom industry
  const handleDeleteIndustry = async (industryName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the selection button

    // Show delete confirmation modal
    setDeleteModal({
      isOpen: true,
      type: 'industry',
      itemName: industryName,
      onConfirm: () => confirmDeleteIndustry(industryName)
    });
  };

  const confirmDeleteIndustry = async (industryName: string) => {

    try {
      const customData: CustomFormData = {
        industries: customIndustries.filter(ind => ind.name !== industryName),
        brands: { ...customBrands },
        chemicals: { ...customChemicals },
        selectedCountries: [...customSelectedCountries],
        lastUpdated: new Date().toISOString()
      };

      // Remove associated brands
      if (customData.brands[industryName]) {
        delete customData.brands[industryName];
      }

      // Remove associated chemicals
      Object.keys(customData.chemicals).forEach(key => {
        if (key.startsWith(`${industryName}::`)) {
          delete customData.chemicals[key];
        }
      });

      // Save to API
      const success = await saveCustomData(customData);

      if (success) {
        // Update local state
        setCustomIndustries(customData.industries);
        setCustomBrands(customData.brands);
        setCustomChemicals(customData.chemicals);

        // Clear formData if deleted industry was selected
        if (formData.industry === industryName) {
          setFormData({
            industry: '',
            brandName: '',
            chemicalName: '',
            countries: []
          });
        }

        setSubmitMessage('Industry deleted successfully!');
        setTimeout(() => {
          setSubmitMessage('');
        }, 3000);
      } else {
        showError('Delete Error', 'Failed to delete industry. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting industry:', error);
      showError('Delete Error', 'Failed to delete industry. Please try again.');
    }
    setDeleteModal({ isOpen: false, type: null, itemName: '', onConfirm: null });
  };

  // Handle deleting custom brand
  const handleDeleteBrand = async (brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Show delete confirmation modal
    setDeleteModal({
      isOpen: true,
      type: 'brand',
      itemName: brandName,
      onConfirm: () => confirmDeleteBrand(brandName)
    });
  };

  const confirmDeleteBrand = async (brandName: string) => {

    try {
      if (!formData.industry) return;

      const industry = formData.industry;
      const customData: CustomFormData = {
        industries: [...customIndustries],
        brands: { ...customBrands },
        chemicals: { ...customChemicals },
        selectedCountries: [...customSelectedCountries],
        lastUpdated: new Date().toISOString()
      };

      // Remove brand from customBrands
      if (customData.brands[industry]) {
        customData.brands[industry] = customData.brands[industry].filter(b => b !== brandName);
        if (customData.brands[industry].length === 0) {
          delete customData.brands[industry];
        }
      }

      // Remove associated chemicals
      const key = `${industry}::${brandName}`;
      if (customData.chemicals[key]) {
        delete customData.chemicals[key];
      }

      // Save to API
      const success = await saveCustomData(customData);

      if (success) {
        // Update local state
        setCustomBrands(customData.brands);
        setCustomChemicals(customData.chemicals);

        // Clear formData if deleted brand was selected
        if (formData.brandName === brandName) {
          setFormData(prev => ({
            ...prev,
            brandName: '',
            chemicalName: '',
            countries: []
          }));
        }

        setSubmitMessage('Brand deleted successfully!');
        setTimeout(() => {
          setSubmitMessage('');
        }, 3000);
      } else {
        showError('Delete Error', 'Failed to delete brand. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
      showError('Delete Error', 'Failed to delete brand. Please try again.');
    }
    setDeleteModal({ isOpen: false, type: null, itemName: '', onConfirm: null });
  };

  // Handle deleting custom chemical
  const handleDeleteChemical = async (chemicalName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Show delete confirmation modal
    setDeleteModal({
      isOpen: true,
      type: 'chemical',
      itemName: chemicalName,
      onConfirm: () => confirmDeleteChemical(chemicalName)
    });
  };

  const confirmDeleteChemical = async (chemicalName: string) => {

    try {
      if (!formData.industry || !formData.brandName) return;

      const industry = formData.industry;
      const brand = formData.brandName;
      const key = `${industry}::${brand}`;

      const customData: CustomFormData = {
        industries: [...customIndustries],
        brands: { ...customBrands },
        chemicals: { ...customChemicals },
        selectedCountries: [...customSelectedCountries],
        lastUpdated: new Date().toISOString()
      };

      // Remove chemical from customChemicals
      if (customData.chemicals[key]) {
        customData.chemicals[key] = customData.chemicals[key].filter(c => c !== chemicalName);
        if (customData.chemicals[key].length === 0) {
          delete customData.chemicals[key];
        }
      }

      // Save to API
      const success = await saveCustomData(customData);

      if (success) {
        // Update local state
        setCustomChemicals(customData.chemicals);

        // Clear formData if deleted chemical was selected
        if (formData.chemicalName === chemicalName) {
          setFormData(prev => ({
            ...prev,
            chemicalName: '',
            countries: []
          }));
        }

        setSubmitMessage('Chemical deleted successfully!');
        setTimeout(() => {
          setSubmitMessage('');
        }, 3000);
      } else {
        showError('Delete Error', 'Failed to delete chemical. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting chemical:', error);
      showError('Delete Error', 'Failed to delete chemical. Please try again.');
    }
    setDeleteModal({ isOpen: false, type: null, itemName: '', onConfirm: null });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if industry and countries are selected (minimum requirements)
    if (!formData.industry || formData.countries.length === 0) {
      showError('Validation Error', 'Please select an industry and at least one country.');
      return;
    }

    // For static products, require all fields
    const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);
    const brands = getAllBrands(formData.industry);
    const hasNoBrands = brands.length === 0;

    if (!isCustomIndustry || !hasNoBrands) {
      // Static products require brand and chemical
      if (!formData.brandName || !formData.chemicalName) {
        showError('Validation Error', 'Please fill in all required fields and select at least one country.');
        return;
      }
    }

    // Get SIC code for the selected industry using the new helper function
    const industryDetails = getIndustryDetails(formData.industry);
    const sicCode = industryDetails.sicCode;

    const payload = {
      ...formData,
      sic_codes: sicCode ? [sicCode] : [],
      product: selectedProduct,
      timestamp: new Date().toISOString(),
      isCustomIndustry: isCustomIndustry && hasNoBrands
    };

    // Show confirmation modal with data
    setSubmitPayload(payload);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!submitPayload) return;

    setIsSubmitting(true);
    setShowConfirmModal(false); // Close confirmation modal
    console.log('Submitting form data:', submitPayload);

    // Show progress notification
    setProgressMessage('Data is scraping in database...');
    setProgressType('loading');
    setShowProgressNotification(true);

    try {
      // Map form data to backend API format
      const apiRequest = {
        countries: submitPayload.countries || [],
        sic_codes: submitPayload.sic_codes || [],
        industry: submitPayload.industry || undefined,
        total_leads_wanted: 10, // Default value for testing
        source: 'apollo' as const,
        // Optional fields
        employee_size_min: undefined,
        employee_size_max: undefined,
        c_suites: undefined,
      };

      console.log('Calling backend API with:', apiRequest);

      // Call backend API
      const response = await scrapeLeads(apiRequest);

      if (response.success) {
        // Update to success message
        setProgressMessage(
          `Successfully started scraping! Found ${response.total_leads_found} leads.`
        );
        setProgressType('success');

        // Navigate to database after 2 seconds
        setTimeout(() => {
          router.push('/database');
        }, 2000);
      } else {
        setProgressMessage('Failed to start scraping. Please try again.');
        setProgressType('error');
        console.error('API response indicates failure:', response);

        // Hide notification after 3 seconds
        setTimeout(() => {
          setShowProgressNotification(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error calling backend API:', error);
      
      let errorMessage = 'Error submitting data. Please check your connection.';
      
      if (error instanceof ApiClientError) {
        // Handle API-specific errors
        if (error.status === 0) {
          errorMessage = 'Cannot connect to backend API. Please ensure the backend server is running.';
        } else if (error.status === 403) {
          errorMessage = 'Apollo API authentication failed. Please check API keys.';
        } else if (error.status === 500) {
          errorMessage = error.data.detail || 'Backend server error. Please try again later.';
        } else {
          errorMessage = error.data.detail || error.message || 'API request failed.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setProgressMessage(errorMessage);
      setProgressType('error');

      // Hide notification after 5 seconds for errors
      setTimeout(() => {
        setShowProgressNotification(false);
      }, 5000);
    } finally {
      setIsSubmitting(false);
      setSubmitPayload(null);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmModal(false);
    setSubmitPayload(null);
  };

  if (isLoadingData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading form data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md relative">
      {/* Progress Notification - Centered Top */}
      {showProgressNotification && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[60] animate-slideDown">
          <div className={`
            px-6 py-4 rounded-lg shadow-2xl border-2 flex items-center space-x-3 min-w-[320px]
            ${progressType === 'loading' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}
            ${progressType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : ''}
            ${progressType === 'error' ? 'bg-red-50 border-red-500 text-red-700' : ''}
          `}>
            {progressType === 'loading' && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
            )}
            {progressType === 'success' && (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {progressType === 'error' && (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-semibold text-base">{progressMessage}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 rounded-t-lg">
        <h2 className="text-xl font-bold">Product Selection Form</h2>
        <p className="text-blue-100 mt-1">Select your industry, brand, and chemical to view available countries</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Step 1: Industry Selection */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Step 1: Select Industry</h3>
            <button
              onClick={(e) => handleAddNew('industry', e)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              title="Add new industry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add New</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {industries.map(industry => {
              // Use the new helper function to get industry details including SIC code
              const industryDetails = getIndustryDetails(industry);
              const sicCode = industryDetails.sicCode;
              const isCustomIndustry = customIndustries.some(ind => ind.name === industry);

              return (
                <div
                  key={industry}
                  className={`group relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${formData.industry === industry
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 bg-white'
                    }`}
                >
                  <button
                    onClick={() => handleInputChange('industry', industry)}
                    className="w-full text-left"
                  >
                    <div className="font-medium text-black">{industry}</div>
                    {sicCode && (
                      <div className="mt-1 text-sm text-gray-600">
                        SIC Code: <span className="font-semibold text-gray-800">{sicCode}</span>
                      </div>
                    )}
                  </button>
                  {isCustomIndustry && (
                    <button
                      onClick={(e) => handleDeleteIndustry(industry, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                      title="Delete industry"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Brand Selection */}
        <div ref={step2Ref}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Step 2: Select Brand Name</h3>
            {formData.industry && (
              <button
                onClick={(e) => handleAddNew('brand', e)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                title="Add new brand"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add New</span>
              </button>
            )}
          </div>
          {formData.industry && availableBrands.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableBrands.map(brand => {
                const isCustomBrand = customBrands[formData.industry]?.includes(brand) || false;

                return (
                  <div
                    key={brand}
                    className={`group relative p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${formData.brandName === brand
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 bg-white'
                      }`}
                  >
                    <button
                      onClick={() => handleInputChange('brandName', brand)}
                      className="w-full text-left text-sm font-medium text-black"
                    >
                      {brand}
                    </button>
                    {isCustomBrand && (
                      <button
                        onClick={(e) => handleDeleteBrand(brand, e)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        title="Delete brand"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : formData.industry ? (
            <div className="text-sm text-blue-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
              {customIndustries.some(ind => ind.name === formData.industry) && getAllBrands(formData.industry).length === 0
                ? 'This is a custom industry with no brands defined. You can skip to country selection.'
                : 'Please select an industry first to see available brands.'
              }
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-200">
              Please select an industry first to see available brands.
            </div>
          )}
        </div>

        {/* Step 3: Chemical Selection */}
        <div ref={step3Ref}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Step 3: Select Chemical Name</h3>
            {formData.industry && formData.brandName && (
              <button
                onClick={(e) => handleAddNew('chemical', e)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                title="Add new chemical"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add New</span>
              </button>
            )}
          </div>
          {formData.industry && formData.brandName && availableChemicals.length > 0 ? (
            <div className="space-y-2">
              {availableChemicals.map(chemical => {
                const key = `${formData.industry}::${formData.brandName}`;
                const isCustomChemical = customChemicals[key]?.includes(chemical) || false;

                return (
                  <div
                    key={chemical}
                    className={`group relative w-full p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${formData.chemicalName === chemical
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                      }`}
                  >
                    <button
                      onClick={() => handleInputChange('chemicalName', chemical)}
                      className="w-full text-left"
                    >
                      <div className="font-medium text-black">{chemical}</div>
                      {selectedProduct && formData.chemicalName === chemical && selectedProduct.application && (
                        <div className="text-sm text-gray-600 mt-1">
                          {selectedProduct.application}
                        </div>
                      )}
                    </button>
                    {isCustomChemical && (
                      <button
                        onClick={(e) => handleDeleteChemical(chemical, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        title="Delete chemical"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : formData.industry && !formData.brandName ? (
            <div className="text-sm text-blue-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
              {customIndustries.some(ind => ind.name === formData.industry) && getAllBrands(formData.industry).length === 0
                ? 'This is a custom industry with no chemicals defined. You can skip to country selection.'
                : 'Please select a brand first to see available chemicals.'
              }
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-200">
              Please select an industry and brand first to see available chemicals.
            </div>
          )}
        </div>

        {/* Step 4: Country Selection */}
        <div ref={step4Ref}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 4: Select Countries</h3>
          {(() => {
            // Check if this is a custom industry with no brands
            const isCustomIndustry = customIndustries.some(ind => ind.name === formData.industry);
            const brands = getAllBrands(formData.industry);
            const hasNoBrands = brands.length === 0;

            // For custom industries with no brands, show countries immediately
            // For static products, show countries only when all steps are complete
            const shouldShowCountries = formData.industry && (
              (isCustomIndustry && hasNoBrands) ||
              (availableCountries.length > 0)
            );

            if (shouldShowCountries) {
              return (
                <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                  <h4 className="font-medium text-black mb-3">Countries to Send ({formData.countries.length} selected)</h4>

                  {/* Country Selection Dropdown */}
                  <div className="space-y-4">
                    {/* Countries organized by regions with enhanced checkboxes */}
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                      {/* Search input - positioned at top right */}
                      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-100">
                        <h3 className="text-lg font-semibold text-black">Select Countries</h3>
                        <div className="flex items-center space-x-3">
                          {/* Add Countries button - only for custom industries */}
                          {isCustomIndustry && formData.countries.length > 0 && (
                            <button
                              onClick={async () => {
                                try {
                                  const customData: CustomFormData = {
                                    industries: [...customIndustries],
                                    brands: { ...customBrands },
                                    chemicals: { ...customChemicals },
                                    selectedCountries: [...formData.countries],
                                    lastUpdated: new Date().toISOString()
                                  };

                                  const success = await saveCustomData(customData);

                                  if (success) {
                                    setCustomSelectedCountries(formData.countries);
                                    setSubmitMessage('Countries saved successfully!');
                                    setTimeout(() => {
                                      setSubmitMessage('');
                                    }, 3000);
                                  }
                                } catch (error) {
                                  console.error('Error saving countries:', error);
                                  showError('Save Error', 'Failed to save countries. Please try again.');
                                }
                              }}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                              title="Save selected countries"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                              </svg>
                              <span>Add Countries</span>
                            </button>
                          )}
                          <div className="w-64 relative">
                            <input
                              type="text"
                              placeholder="Search countries..."
                              value={countrySearchTerm}
                              onChange={(e) => {
                                setCountrySearchTerm(e.target.value);
                                setShowCountryDropdown(e.target.value.length > 0);
                              }}
                              onFocus={() => setShowCountryDropdown(countrySearchTerm.length > 0)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />

                            {/* Search Dropdown */}
                            {showCountryDropdown && countrySearchTerm && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {WORLD_COUNTRIES
                                  .filter(country => country.toLowerCase().includes(countrySearchTerm.toLowerCase()))
                                  .map(country => (
                                    <button
                                      key={country}
                                      onClick={() => {
                                        // Add country to selected list and also ensure it appears in the checkbox grid
                                        if (!formData.countries.includes(country)) {
                                          handleCountryToggle(country);
                                        }
                                        setCountrySearchTerm('');
                                        setShowCountryDropdown(false);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-blue-50 text-black text-sm border-b border-gray-100 last:border-b-0"
                                    >
                                      {country}
                                    </button>
                                  ))}
                              </div>
                            )}

                            {/* Click outside to close */}
                            {showCountryDropdown && (
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowCountryDropdown(false)}
                              ></div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Countries */}
                      <div className="p-6 bg-blue-50">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                          {(() => {
                            let allDisplayCountries;

                            if (isCustomIndustry && hasNoBrands) {
                              // For custom industries with no brands, show all world countries
                              allDisplayCountries = WORLD_COUNTRIES;
                            } else {
                              // For static products, combine product target countries with any selected countries
                              const productCountries = selectedProduct?.targetCountries || [];
                              const additionalCountries = formData.countries.filter(country => !productCountries.includes(country));
                              allDisplayCountries = [...new Set([...productCountries, ...additionalCountries])];
                            }

                            // Sort countries: selected ones first, then unselected ones
                            const sortedCountries = [...allDisplayCountries].sort((a, b) => {
                              const aSelected = formData.countries.includes(a);
                              const bSelected = formData.countries.includes(b);

                              if (aSelected && !bSelected) return -1;
                              if (!aSelected && bSelected) return 1;
                              return a.localeCompare(b); // Alphabetical order within each group
                            });

                            return sortedCountries.map(country => (
                              <label key={country} className="flex items-center space-x-2 cursor-pointer hover:bg-blue-100 p-2 rounded border border-transparent hover:border-blue-200 transition-all duration-200">
                                <input
                                  type="checkbox"
                                  checked={formData.countries.includes(country)}
                                  onChange={() => handleCountryToggle(country)}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-black font-medium">{country}</span>
                              </label>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            } else if (formData.industry) {
              return (
                <div className="text-sm text-blue-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  {(() => {
                    if (isCustomIndustry && hasNoBrands) {
                      return 'Loading countries for custom industry...';
                    } else if (!formData.brandName) {
                      return 'Please select a brand first.';
                    } else if (!formData.chemicalName) {
                      return 'Please select a chemical first to see available countries.';
                    } else {
                      return 'Loading countries...';
                    }
                  })()}
                </div>
              );
            } else {
              return (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  Please complete the previous steps to see available countries.
                </div>
              );
            }
          })()}
        </div>

        {/* Selected Product Details - Show for static products OR custom industry summary */}
        {
          formData.countries.length > 0 && (selectedProduct || (formData.industry && customIndustries.some(ind => ind.name === formData.industry))) && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {selectedProduct ? 'Selected Product Details' : 'Custom Industry Selection'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    {selectedProduct ? 'Product Information' : 'Industry Information'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium text-black">Industry:</span> <span className="text-gray-700 font-bold">{formData.industry}</span></div>
                    {selectedProduct && (
                      <>
                        <div><span className="font-medium text-black">Brand:</span> <span className="text-gray-700 font-bold">{selectedProduct.brandName}</span></div>
                        <div><span className="font-medium text-black">Chemical:</span> <span className="text-gray-700 font-bold">{selectedProduct.chemicalName}</span></div>
                      </>
                    )}
                    {formData.brandName && !selectedProduct && (
                      <div><span className="font-medium text-black">Brand:</span> <span className="text-gray-700 font-bold">{formData.brandName}</span></div>
                    )}
                    {formData.chemicalName && !selectedProduct && (
                      <div><span className="font-medium text-black">Chemical:</span> <span className="text-gray-700 font-bold">{formData.chemicalName}</span></div>
                    )}
                    {!selectedProduct && !formData.brandName && !formData.chemicalName && (
                      <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                        Custom industry - Brand and Chemical are optional
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Selected Countries ({formData.countries.length})</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                    {formData.countries.map((country) => (
                      <div key={country} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-700">{country}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Submit Section */}
        {
          formData.countries.length > 0 && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>{formData.countries.length} countries selected.</span>
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Scrap Data
                </button>
              </div>
            </div>
          )
        }

        {/* Submit Message */}
        {
          submitMessage && (
            <div className={`p-4 rounded-lg ${submitMessage.includes('successfully')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
              {submitMessage}
            </div>
          )
        }
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editModal.isNew ? 'Add New' : 'Edit'} {editModal.type === 'industry' ? 'Industry' : editModal.type === 'brand' ? 'Brand' : 'Chemical'}
              </h3>
              <button
                onClick={handleCloseEdit}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editModal.type === 'industry' ? 'Industry Name' : editModal.type === 'brand' ? 'Brand Name' : 'Chemical Name'}
                </label>
                <input
                  type="text"
                  value={editModal.editedValue}
                  onChange={(e) => setEditModal(prev => ({ ...prev, editedValue: e.target.value, validationErrors: { ...prev.validationErrors, name: undefined } }))}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${editModal.validationErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder={`Enter ${editModal.type} name`}
                  autoFocus
                />
                {editModal.validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{editModal.validationErrors.name}</p>
                )}
              </div>

              {editModal.type === 'industry' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SIC Code
                  </label>
                  <input
                    type="text"
                    value={editModal.editedSicCode || ''}
                    onChange={(e) => setEditModal(prev => ({ ...prev, editedSicCode: e.target.value, validationErrors: { ...prev.validationErrors, sicCode: undefined } }))}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black ${editModal.validationErrors.sicCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter SIC code"
                  />
                  {editModal.validationErrors.sicCode && (
                    <p className="mt-1 text-sm text-red-600">{editModal.validationErrors.sicCode}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={handleCloseEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && submitPayload && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Confirm Scrap Data Submission</h3>
              <button
                onClick={handleCancelSubmit}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 mb-4">Please review the data before submitting:</p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-semibold text-gray-700">Industry:</span>
                  <span className="ml-2 text-gray-900">{submitPayload.industry}</span>
                </div>

                {submitPayload.brandName && (
                  <div>
                    <span className="font-semibold text-gray-700">Brand:</span>
                    <span className="ml-2 text-gray-900">{submitPayload.brandName}</span>
                  </div>
                )}

                {submitPayload.chemicalName && (
                  <div>
                    <span className="font-semibold text-gray-700">Chemical:</span>
                    <span className="ml-2 text-gray-900">{submitPayload.chemicalName}</span>
                  </div>
                )}

                {submitPayload.sic_codes && submitPayload.sic_codes.length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">SIC Code:</span>
                    <span className="ml-2 text-gray-900">{submitPayload.sic_codes.join(', ')}</span>
                  </div>
                )}

                <div>
                  <span className="font-semibold text-gray-700">Selected Countries ({submitPayload.countries.length}):</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {submitPayload.countries.map((country: string) => (
                      <span
                        key={country}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={handleCancelSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Confirm & Scrap Data'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal.isOpen && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6 border-l-4 border-red-500 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-full p-2 mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{errorModal.title}</h3>
              </div>
              <button
                onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600">{errorModal.message}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 bg-gray-100 rounded-full p-2 mr-3">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
                <p className="text-gray-600 mt-2">
                  {deleteModal.type === 'industry' && (
                    <>Are you sure you want to delete <span className="font-semibold">"{deleteModal.itemName}"</span>? This will also delete all associated brands and chemicals.</>
                  )}
                  {deleteModal.type === 'brand' && (
                    <>Are you sure you want to delete <span className="font-semibold">"{deleteModal.itemName}"</span>? This will also delete all associated chemicals.</>
                  )}
                  {deleteModal.type === 'chemical' && (
                    <>Are you sure you want to delete <span className="font-semibold">"{deleteModal.itemName}"</span>?</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: null, itemName: '', onConfirm: null })}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteModal.onConfirm) {
                    deleteModal.onConfirm();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}