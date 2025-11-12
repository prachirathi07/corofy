'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getIndustries,
  getBrandsByIndustry,
  getChemicalsByBrand,
  getCountriesBySelection,
  getProductBySelection,
  type Product
} from '../lib/productData';

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

export default function ProductForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    industry: '',
    brandName: '',
    chemicalName: '',
    countries: []
  });

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableChemicals, setAvailableChemicals] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Webhook URL from environment variable
  const WEBHOOK_URL = process.env.NEXT_PUBLIC_WEBHOOK_URL_PRODUCT_FORM || 'https://n8n.srv963601.hstgr.cloud/webhook/a78c1edf-450b-44b8-9af5-8206b4736b81'
  const industries = getIndustries();

  // Update brands when industry changes
  useEffect(() => {
    if (formData.industry) {
      const brands = getBrandsByIndustry(formData.industry);
      setAvailableBrands(brands);
      setFormData(prev => ({ ...prev, brandName: '', chemicalName: '', countries: [] }));
      setAvailableChemicals([]);
      setAvailableCountries([]);
      setSelectedProduct(null);
    } else {
      setAvailableBrands([]);
      setAvailableChemicals([]);
      setAvailableCountries([]);
    }
  }, [formData.industry]);

  // Update chemicals when brand changes
  useEffect(() => {
    if (formData.industry && formData.brandName) {
      const chemicals = getChemicalsByBrand(formData.industry, formData.brandName);
      setAvailableChemicals(chemicals);
      setFormData(prev => ({ ...prev, chemicalName: '', countries: [] }));
      setAvailableCountries([]);
      setSelectedProduct(null);
    } else {
      setAvailableChemicals([]);
      setAvailableCountries([]);
    }
  }, [formData.industry, formData.brandName]);

  // Update countries and product when chemical changes
  useEffect(() => {
    if (formData.industry && formData.brandName && formData.chemicalName) {
      const countries = getCountriesBySelection(formData.industry, formData.brandName, formData.chemicalName);
      setAvailableCountries(countries);
      const product = getProductBySelection(formData.industry, formData.brandName, formData.chemicalName);
      setSelectedProduct(product || null);
      // Select all countries by default
      setFormData(prev => ({ ...prev, countries: countries }));
    } else {
      setAvailableCountries([]);
      setSelectedProduct(null);
    }
  }, [formData.industry, formData.brandName, formData.chemicalName]);

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

  // const handleAddCountryFromSearch = (country: string) => {
  //   if (!formData.countries.includes(country)) {
  //     setFormData(prev => ({
  //       ...prev,
  //       countries: [...prev.countries, country]
  //     }));
  //   }
  //   setCountrySearchTerm('');
  //   setShowCountryDropdown(false);
  // };

  // const filteredWorldCountries = WORLD_COUNTRIES.filter(country =>
  //   country.toLowerCase().includes(countrySearchTerm.toLowerCase()) &&
  //   !formData.countries.includes(country)
  // );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.industry || !formData.brandName || !formData.chemicalName || formData.countries.length === 0) {
      setSubmitMessage('Please fill in all required fields and select at least one country.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      // Get SIC code for the selected industry
      const sicCode = INDUSTRY_SIC_CODES[formData.industry] || '';
      
      const payload = {
        ...formData,
        sic_codes: [sicCode], // Add SIC codes array for Apollo API
        product: selectedProduct,
        timestamp: new Date().toISOString()
      };

      console.log('Sending payload with SIC code:', payload);

      // Send to webhook
      const webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (webhookResponse.ok) {
        setSubmitMessage('Data sent successfully to webhook! Redirecting to database view...');
        
        // Reset form
        setFormData({
          industry: '',
          brandName: '',
          chemicalName: '',
          countries: []
        });
        
        // Navigate to database page after a short delay
        setTimeout(() => {
          router.push('/database');
        }, 2000);
      } else {
        setSubmitMessage('Failed to send data to webhook. Please try again.');
      }
    } catch {
      setSubmitMessage('Error sending data to webhook. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 rounded-t-lg">
        <h2 className="text-xl font-bold">Product Selection Form</h2>
        <p className="text-blue-100 mt-1">Select your industry, brand, and chemical to view available countries</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Step 1: Industry Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Select Industry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {industries.map(industry => (
              <button
                key={industry}
                onClick={() => handleInputChange('industry', industry)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md ${
                  formData.industry === industry
                    ? 'border-blue-500 bg-blue-50 text-black'
                    : 'border-gray-200 hover:border-blue-300 bg-white text-black'
                }`}
              >
                <div className="font-medium">{industry}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Brand Selection */}
        {availableBrands.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 2: Select Brand Name</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableBrands.map(brand => (
                <button
                  key={brand}
                  onClick={() => handleInputChange('brandName', brand)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium hover:shadow-md ${
                    formData.brandName === brand
                      ? 'border-green-500 bg-green-50 text-black'
                      : 'border-gray-200 hover:border-green-300 bg-white text-black'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Chemical Selection */}
        {availableChemicals.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 3: Select Chemical Name</h3>
            <div className="space-y-2">
              {availableChemicals.map(chemical => (
                <button
                  key={chemical}
                  onClick={() => handleInputChange('chemicalName', chemical)}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md ${
                    formData.chemicalName === chemical
                      ? 'border-purple-500 bg-purple-50 text-black'
                      : 'border-gray-200 hover:border-purple-300 bg-white text-black'
                  }`}
                >
                  <div className="font-medium">{chemical}</div>
                  {selectedProduct && formData.chemicalName === chemical && selectedProduct.application && (
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedProduct.application}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Country Selection */}
        {availableCountries.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 4: Select Countries</h3>
              <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
              <h4 className="font-medium text-black mb-3">Countries to Send ({formData.countries.length} selected)</h4>
              
              {/* Country Selection Dropdown */}
              <div className="space-y-4">
                {/* Countries organized by regions with enhanced checkboxes */}
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                  {/* Search input - positioned at top right */}
                  <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-100">
                    <h3 className="text-lg font-semibold text-black">Select Countries</h3>
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
                  {/* Countries */}
                  <div className="p-6 bg-blue-50">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                      {(() => {
                        // Combine product target countries with any selected countries that aren't in the original list
                        const productCountries = selectedProduct?.targetCountries || [];
                        const additionalCountries = formData.countries.filter(country => !productCountries.includes(country));
                        const allDisplayCountries = [...new Set([...productCountries, ...additionalCountries])];
                        
                        return allDisplayCountries.map(country => (
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
          </div>
        )}

        {/* Selected Product Details */}
        {selectedProduct && formData.countries.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Selected Product Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Product Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-black">Industry:</span> <span className="text-gray-700 font-bold">{selectedProduct.industry}</span></div>
                  <div><span className="font-medium text-black">Brand:</span> <span className="text-gray-700 font-bold">{selectedProduct.brandName}</span></div>
                  <div><span className="font-medium text-black">Chemical:</span> <span className="text-gray-700 font-bold">{selectedProduct.chemicalName}</span></div>
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
        )}

        {/* Submit Section */}
        {formData.countries.length > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Only the {formData.countries.length} selected countries above will be sent to the webhook.</span>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSubmitting ? 'Sending...' : 'Send All Countries to Webhook'}
              </button>
            </div>
          </div>
        )}

        {/* Submit Message */}
        {submitMessage && (
          <div className={`p-4 rounded-lg ${
            submitMessage.includes('successfully') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {submitMessage}
          </div>
        )}
      </div>
    </div>
  );
}