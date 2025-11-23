'use client';

import { useState } from 'react';
import { leadsApi } from '@/lib/api';

export default function LeadScraping() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    source: 'apify', // 'apollo' or 'apify'
    countries: '',
    sic_codes: '',
    c_suites: '',
    employee_size_min: '',
    employee_size_max: '',
    industry: '',
    total_leads_wanted: '10',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params: any = {
        source: formData.source,
        total_leads_wanted: parseInt(formData.total_leads_wanted) || 10,
      };

      if (formData.countries) {
        params.countries = formData.countries.split(',').map(c => c.trim()).filter(c => c);
      }
      
      // Apollo-specific fields
      if (formData.source === 'apollo') {
        if (formData.sic_codes) {
          params.sic_codes = formData.sic_codes.split(',').map(c => c.trim()).filter(c => c);
        }
      }
      
      // Apify-specific fields
      if (formData.source === 'apify') {
        if (formData.c_suites) {
          params.c_suites = formData.c_suites.split(',').map(c => c.trim()).filter(c => c);
        }
        if (formData.employee_size_min) {
          params.employee_size_min = parseInt(formData.employee_size_min);
        }
        if (formData.employee_size_max) {
          params.employee_size_max = parseInt(formData.employee_size_max);
        }
        if (formData.industry) {
          params.industry = formData.industry;
        }
      }

      const data = await leadsApi.scrape(params);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to scrape leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Scrape Leads</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Data Source</label>
          <select
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '100%' }}
          >
            <option value="apollo">Apollo</option>
            <option value="apify">Apify</option>
          </select>
        </div>

        <div className="form-group">
          <label>Countries (comma-separated, e.g., India, United States){formData.source === 'apollo' && ' - Required for Apollo'}</label>
          <input
            type="text"
            value={formData.countries}
            onChange={(e) => setFormData({ ...formData, countries: e.target.value })}
            placeholder="India, United States"
            required={formData.source === 'apollo'}
          />
        </div>

        {formData.source === 'apollo' && (
          <>
            <div className="form-group">
              <label>SIC Codes (comma-separated, e.g., 2834, 2869, 2879) - Required for Apollo</label>
              <input
                type="text"
                value={formData.sic_codes}
                onChange={(e) => setFormData({ ...formData, sic_codes: e.target.value })}
                placeholder="2834, 2869, 2879"
                required={formData.source === 'apollo'}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                SIC codes are required for Apollo scraping. Example: 2834 (Pharmaceuticals), 2869 (Industrial Organic Chemicals)
              </small>
            </div>
          </>
        )}

        {formData.source === 'apify' && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>C-Suites (comma-separated, e.g., CEO,COO)</label>
                <input
                  type="text"
                  value={formData.c_suites}
                  onChange={(e) => setFormData({ ...formData, c_suites: e.target.value })}
                  placeholder="CEO, COO, Director"
                />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Technology"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Employee Size Min</label>
                <input
                  type="number"
                  value={formData.employee_size_min}
                  onChange={(e) => setFormData({ ...formData, employee_size_min: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="form-group">
                <label>Employee Size Max</label>
                <input
                  type="number"
                  value={formData.employee_size_max}
                  onChange={(e) => setFormData({ ...formData, employee_size_max: e.target.value })}
                  placeholder="500"
                />
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label>Total Leads Wanted (Max: 10)</label>
          <input
            type="number"
            value={formData.total_leads_wanted}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value);
              if (value === '' || (numValue >= 1 && numValue <= 10)) {
                setFormData({ ...formData, total_leads_wanted: value });
              }
            }}
            min="1"
            max="10"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Scraping...' : 'Scrape Leads'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      
      {result && (
        <div className="success" style={{ marginTop: '20px' }}>
          <h3>Scraping Complete!</h3>
          <p><strong>Search ID:</strong> {result.search_id}</p>
          <p><strong>Total Leads Found:</strong> {result.total_leads_found}</p>
          <p><strong>Target Leads:</strong> {result.target_leads}</p>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#e7f3ff', 
            borderRadius: '4px',
            border: '1px solid #b3d9ff'
          }}>
            <strong>🔄 Automatic Processing Started:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '0' }}>
              <li>Website scraping in progress for each company</li>
              <li>Email generation in progress using OpenAI</li>
              <li>Emails will be stored automatically</li>
            </ul>
            <p style={{ marginTop: '10px', marginBottom: '0', fontSize: '13px', color: '#666' }}>
              Check "View & Send Email" tab in a few minutes to see generated emails
            </p>
          </div>
          
          {result.leads && result.leads.length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <strong>Sample Leads:</strong>
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                {result.leads.slice(0, 5).map((lead: any, idx: number) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>
                    {lead.founder_name || 'N/A'} - {lead.founder_email || 'N/A'} ({lead.company_name || 'N/A'})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

