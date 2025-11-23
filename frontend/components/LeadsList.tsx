'use client';

import { useState, useEffect } from 'react';
import { leadsApi } from '@/lib/api';

export default function LeadsList() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sendingEmails, setSendingEmails] = useState(false);

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadsApi.getAll(0, 2000, statusFilter || undefined);
      setLeads(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmails = async () => {
    if (!confirm('Send emails to all leads? This will:\n1. Check timezone (Mon-Fri 9-7)\n2. Scrape websites using Firecrawl\n3. Generate personalized emails\n4. Send emails automatically\n\nContinue?')) {
      return;
    }

    setSendingEmails(true);
    setError(null);
    try {
      const result = await leadsApi.sendEmails();
      alert(`✅ ${result.message}\n\nCheck server logs for detailed progress.`);
      // Refresh leads after a delay
      setTimeout(() => {
        loadLeads();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send emails');
    } finally {
      setSendingEmails(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Leads List</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="email_sent">Email Sent</option>
            <option value="replied">Replied</option>
          </select>
          <button
            onClick={handleSendEmails}
            className="btn btn-primary"
            disabled={sendingEmails || leads.length === 0}
            style={{
              background: sendingEmails ? '#ccc' : '#0070f3',
              cursor: sendingEmails || leads.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {sendingEmails ? 'Sending...' : '📧 Send Emails'}
          </button>
          <button onClick={loadLeads} className="btn btn-secondary">Refresh</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#666',
          background: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>No leads found</p>
          <p style={{ fontSize: '14px' }}>Scrape some leads first using the "Scrape Leads" tab</p>
        </div>
      ) : (
        <div>
          <div style={{
            marginBottom: '15px',
            padding: '12px',
            background: '#e7f3ff',
            borderRadius: '4px',
            border: '1px solid #b3d9ff'
          }}>
            <strong>Total Leads:</strong> {leads.length}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Title</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Company</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Industry</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Country</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Size</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr
                    key={lead.id || index}
                    style={{
                      borderBottom: '1px solid #eee',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px' }}>
                      <strong>{lead.founder_name || ''}</strong>
                      {!lead.founder_name && <span style={{ color: '#999' }}>N/A</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {lead.founder_email ? (
                        <a href={`mailto:${lead.founder_email}`} style={{ color: '#0070f3', textDecoration: 'none' }}>
                          {lead.founder_email}
                        </a>
                      ) : (
                        <span style={{ color: '#999' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>{lead.position || <span style={{ color: '#999' }}>N/A</span>}</td>
                    <td style={{ padding: '12px' }}>
                      {lead.company_name || <span style={{ color: '#999' }}>N/A</span>}
                      {lead.company_website && (
                        <div>
                          <a
                            href={lead.company_website.startsWith('http') ? lead.company_website : `https://${lead.company_website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: '#666', textDecoration: 'none' }}
                          >
                            🌐 Website
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>{lead.company_industry || <span style={{ color: '#999' }}>N/A</span>}</td>
                    <td style={{ padding: '12px' }}>{lead.company_country || <span style={{ color: '#999' }}>N/A</span>}</td>
                    <td style={{ padding: '12px' }}>
                      {lead.company_employee_size ? (
                        <span>{lead.company_employee_size}</span>
                      ) : (
                        <span style={{ color: '#999' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        className={`badge badge-${lead.status === 'replied' ? 'success' : lead.status === 'email_sent' ? 'info' : 'warning'}`}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: lead.status === 'replied' ? '#d4edda' : lead.status === 'email_sent' ? '#d1ecf1' : '#fff3cd',
                          color: lead.status === 'replied' ? '#155724' : lead.status === 'email_sent' ? '#0c5460' : '#856404',
                          border: `1px solid ${lead.status === 'replied' ? '#c3e6cb' : lead.status === 'email_sent' ? '#bee5eb' : '#ffeaa7'}`
                        }}
                      >
                        {lead.status || 'new'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

