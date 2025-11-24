'use client';

import { useState, useEffect, useCallback } from 'react';
import { Product, productData } from '../lib/productData';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';

export default function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const refreshData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      // Use local product data
      let filteredProducts = [...productData];
      
      if (selectedIndustry) {
        filteredProducts = filteredProducts.filter(p => p.industry === selectedIndustry);
      }
      
      setProducts(filteredProducts);
      setLastRefreshTime(new Date());
      setCurrentPage(1); // Reset to page 1 when data refreshes
    } catch (error) {
      setError('Error loading products');
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIndustry]);

  // Fetch industries on component mount
  useEffect(() => {
    try {
      // Get unique industries from local product data
      const uniqueIndustries = Array.from(new Set(productData.map((product: Product) => product.industry))) as string[];
      setIndustries(uniqueIndustries);
    } catch (error) {
      console.error('Error loading industries:', error);
      setIndustries([]);
    }
  }, []);

  // Fetch products when industry changes or component mounts
  useEffect(() => {
    refreshData();
  }, [selectedIndustry, refreshData]);

  // Refresh data when component becomes visible (for navigation from form)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedIndustry, refreshData]);


  // Pagination logic
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    // Scroll to top of table when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-green-600 text-white p-6 rounded-t-lg">
        <h2 className="text-xl font-bold">Products Database</h2>
        <p className="text-green-100 mt-1">View all available products</p>
      </div>

      <div className="p-6">
        {/* Industry Filter and Refresh */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label htmlFor="industry-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Industry
            </label>
            <select
              id="industry-filter"
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black"
            >
              <option value="" className="text-black">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry} className="text-black">
                  {industry}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-2 text-gray-600">Loading products...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chemical Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Countries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  currentProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.industry}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.brandName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={product.chemicalName}>
                          {product.chemicalName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={product.application}>
                          {product.application}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {product.targetCountries.slice(0, 3).map((country, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {country}
                              </span>
                            ))}
                            {product.targetCountries.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                +{product.targetCountries.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        N/A
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && !error && products.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Items per page selector */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <label htmlFor="items-per-page" className="text-sm font-medium text-gray-700">
                  Items per page:
                </label>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1); // Reset to page 1 when changing items per page
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm text-black"
                >
                  <option value={10} className="text-black">10</option>
                  <option value={20} className="text-black">20</option>
                  <option value={50} className="text-black">50</option>
                  <option value={100} className="text-black">100</option>
                </select>
              </div>
              {lastRefreshTime && (
                <div className="text-xs text-gray-500">
                  Last updated: {lastRefreshTime.toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Pagination and Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, products.length)} of {products.length} product{products.length !== 1 ? 's' : ''}
                {selectedIndustry && ` in ${selectedIndustry} industry`}
              </div>
              
              {/* MUI Pagination */}
              {totalPages > 1 && (
                <Stack spacing={2}>
                  <Pagination 
                    count={totalPages} 
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                    size="large"
                  />
                </Stack>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {!isLoading && !error && products.length > 0 && lastRefreshTime && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  Data loaded successfully! {products.length} product{products.length !== 1 ? 's' : ''} found.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
