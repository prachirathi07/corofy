'use client';

import { useState, useEffect, useCallback } from 'react';
import { Founder } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';

export default function FoundersTable() {
  const { user } = useAuth();
  const [founders, setFounders] = useState<Founder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [tablePriorityFilter, setTablePriorityFilter] = useState<string>('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [industriesLoading, setIndustriesLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailSuccessPopup, setShowEmailSuccessPopup] = useState(false);
  const [showDeleteConfirmPopup, setShowDeleteConfirmPopup] = useState(false);
  const [showDeleteSuccessPopup, setShowDeleteSuccessPopup] = useState(false);
  const [showDeleteErrorPopup, setShowDeleteErrorPopup] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [showLimitToast, setShowLimitToast] = useState(false);
  
  // Email limit and timer states
  const EMAIL_LIMIT = 400;
  const [emailSendTimestamp, setEmailSendTimestamp] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [canSendEmails, setCanSendEmails] = useState(true);
  const [totalEmailsSent, setTotalEmailsSent] = useState<number>(0); // Track cumulative emails sent
  
  // Configure your webhook URL here - now using environment variable
  const WEBHOOK_URL = process.env.NEXT_PUBLIC_WEBHOOK_URL_FOUNDERS_TABLE || 'https://n8n.srv963601.hstgr.cloud/webhook/56f43b46-2fd1-4821-bbc7-1d20547e88b9';

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch data from Supabase only
      const url = selectedIndustry
        ? `/api/founders?industry=${encodeURIComponent(selectedIndustry)}`
        : '/api/founders';
      
      console.log('🔄 Fetching data from:', url);
      console.log('🌐 Current window location:', window.location.href);
      console.log('🔗 Full URL will be:', window.location.origin + url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
      });
      
      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Data received:', data);
      
      if (data.success) {
        const founders = Array.isArray(data.data) ? data.data : [];
        
        // Debug: Log the first founder's follow-up data
        if (founders.length > 0) {
          console.log('🔍 Debug - First founder follow-up data:', {
            id: founders[0].id,
            '1st Follow-Up Sent (5 days)': founders[0]['1st Follow-Up Sent (5 days)'],
            '2nd Follow-Up Sent (10 days)': founders[0]['2nd Follow-Up Sent (10 days)'],
            '1st Follow-Up Sent (5 days) type': typeof founders[0]['1st Follow-Up Sent (5 days)'],
            '2nd Follow-Up Sent (10 days) type': typeof founders[0]['2nd Follow-Up Sent (10 days)']
          });
        }
        
        // Sort by created_at in descending order (newest first)
        const sortedFounders = founders.sort((a: Founder, b: Founder) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Descending order
        });
        
        // Only set Verification to true for first 400 unsent emails, rest should be false
        // First, identify which founders should be verified and which need updates
        let verifiedCount = 0;
        const updatePromises: Promise<Response>[] = [];
        
        const foundersWithDefaultVerification = sortedFounders.map((founder: Founder) => {
          const shouldVerify = founder['Mail Status'] !== 'SENT' && verifiedCount < EMAIL_LIMIT;
          
          if (shouldVerify) {
            verifiedCount++;
          }
          
          // Only update database if the value needs to change
          if (founder['Verification'] !== shouldVerify) {
            updatePromises.push(
              fetch(`/api/founders?id=${founder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 'Verification': shouldVerify }),
              })
            );
          }
          
          return {
            ...founder,
            'Verification': shouldVerify,
            'Priority based on Reply': founder['Priority based on Reply'] || '-',
            '1st Follow-Up Sent (5 days)': founder['1st Follow-Up Sent (5 days)'],
            '2nd Follow-Up Sent (10 days)': founder['2nd Follow-Up Sent (10 days)']
          };
        });
        
        // Update database for records that changed
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(`✅ Updated ${updatePromises.length} verification records in database`);
        }
        
        console.log(`✅ Verification limit applied: ${verifiedCount} emails selected out of ${sortedFounders.length} total`);
        
        // Calculate total emails already sent (cumulative count)
        const totalSent = sortedFounders.filter((f: Founder) => f['Mail Status'] === 'SENT').length;
        setTotalEmailsSent(totalSent);
        console.log(`📊 Total emails sent (cumulative): ${totalSent} / ${EMAIL_LIMIT} (${EMAIL_LIMIT - totalSent} remaining)`);
        
        setFounders(foundersWithDefaultVerification);
        setLastRefreshTime(new Date());
        setCurrentPage(1); // Reset to page 1 when data refreshes
      } else {
        setError(data.error || 'Failed to fetch founders from Supabase');
      }
    } catch (error) {
      setError('Error fetching founders data from Supabase');
      console.error('Error fetching founders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIndustry]);

  // Fetch industries on component mount
  useEffect(() => {
    const fetchIndustries = async () => {
      setIndustriesLoading(true);
      try {
        console.log('🔄 Frontend: Fetching company industries from API...');
        console.log('🌐 Current window location:', window.location.href);
        console.log('🔗 Full URL will be:', window.location.origin + '/api/founder-industries');
        
        // Fetch industries from founder industries API
        const response = await fetch('/api/founder-industries', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-cache',
        });
        
        console.log('📡 Frontend: API response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Frontend: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📦 Frontend: API response data:', data);
        
        if (data.success && Array.isArray(data.data)) {
          setIndustries(data.data);
          console.log(`✅ Frontend: Loaded ${data.data.length} unique company industries:`, data.data);
        } else {
          console.warn('⚠️ Frontend: API returned unsuccessful or non-array data:', data);
          setIndustries([]);
        }
      } catch (error) {
        console.error('❌ Frontend: Error fetching founder industries:', error);
        setIndustries([]);
      } finally {
        setIndustriesLoading(false);
      }
    };
    fetchIndustries();
  }, []);

  // Auto-select next 400 unsent emails after timer expires
  const autoSelectNextBatch = useCallback(() => {
    const unsentFounders = founders.filter(f =>
      f['Mail Status'] !== 'SENT' &&
      (f['Verification'] === false || f['Verification'] === null)
    );
    
    // Select up to 400 unsent founders
    const toSelect = unsentFounders.slice(0, EMAIL_LIMIT);
    
    // Update verification to true for these founders
    setFounders(prevFounders =>
      prevFounders.map(founder => {
        const shouldSelect = toSelect.some(f => f.id === founder.id);
        return shouldSelect
          ? { ...founder, 'Verification': true }
          : founder;
      })
    );
  }, [founders, EMAIL_LIMIT]);

  // Load email send timestamp from database and check timer status
  useEffect(() => {
    const loadEmailTimer = async () => {
      const userEmail = user || 'corofy.marketing@gmail.com';
      try {
        const response = await fetch(`/api/email-timer?userEmail=${encodeURIComponent(userEmail)}`);
        const data = await response.json();
        
        if (data.success && data.timestamp && data.timestamp > 0) {
          const timestamp = data.timestamp;
          setEmailSendTimestamp(timestamp);
          
          const now = Date.now();
          const elapsed = now - timestamp;
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          
          if (elapsed < twentyFourHours) {
            const remaining = twentyFourHours - elapsed;
            setTimeRemaining(remaining);
            setCanSendEmails(false);
          } else {
            // Timer expired, clear timestamp and allow sending
            await fetch('/api/email-timer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userEmail, timestamp: 0 })
            });
            setEmailSendTimestamp(null);
            setTimeRemaining(null);
            setCanSendEmails(true);
          }
        } else {
          // No timer active
          setEmailSendTimestamp(null);
          setTimeRemaining(null);
          setCanSendEmails(true);
        }
      } catch (error) {
        console.error('Error loading email timer:', error);
        // On error, allow sending (fail open)
        setCanSendEmails(true);
      }
    };

    if (user) {
      loadEmailTimer();
    }
  }, [user]);

  // Timer countdown effect
  useEffect(() => {
    if (!emailSendTimestamp || canSendEmails) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const elapsed = now - emailSendTimestamp;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (elapsed >= twentyFourHours) {
        // Timer expired - clear from database
        const userEmail = user || 'corofy.marketing@gmail.com';
        try {
          await fetch('/api/email-timer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail, timestamp: 0 })
          });
        } catch (error) {
          console.error('Error clearing email timer:', error);
        }
        setEmailSendTimestamp(null);
        setTimeRemaining(null);
        setCanSendEmails(true);
        clearInterval(interval);
        
        // Auto-select next 400 unsent emails
        autoSelectNextBatch();
      } else {
        const remaining = twentyFourHours - elapsed;
        setTimeRemaining(remaining);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [emailSendTimestamp, canSendEmails, autoSelectNextBatch, user]);

  // Fetch founders when industry changes or component mounts
  useEffect(() => {
    refreshData();
  }, [selectedIndustry, refreshData]);

  // Refresh data when component becomes visible
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

  // const formatDate = (dateString: string) => {
  //   return new Date(dateString).toLocaleDateString('en-US', {
  //     year: 'numeric',
  //     month: 'short',
  //     day: 'numeric',
  //     hour: '2-digit',
  //     minute: '2-digit'
  //   });
  // };

  // Calculate priority based on reply status
  const calculatePriority = (founder: Founder) => {
    // If priority is already set in database and it's not the default "-", use it
    if (founder['Priority based on Reply'] && 
        founder['Priority based on Reply'].trim() !== '' && 
        founder['Priority based on Reply'] !== '-') {
      return founder['Priority based on Reply'];
    }

    // Calculate priority based on reply status
    const hasReplied = founder['Mail Replys'] && 
      founder['Mail Replys'].trim() !== '' && 
      founder['Mail Replys'].toLowerCase() !== 'no reply' &&
      founder['Mail Replys'].toLowerCase() !== 'no_reply';

    const mailStatus = founder['Mail Status'];
    const followUp5Days = founder['1st Follow-Up Sent (5 days)'];
    const followUp10Days = founder['2nd Follow-Up Sent (10 days)'];

    // High priority: Has replied
    if (hasReplied) {
      return 'High';
    }

    // For mail sent but no reply yet, or follow-ups sent - show "-" instead of Medium
    if (mailStatus === 'SENT' || followUp5Days || followUp10Days) {
      return null; // This will show "-"
    }

    // Default case: No mail sent yet or no data available - show "-"
    return null; // This will show "-"
  };

  // Format time remaining in HH:MM:SS
  const formatTimeRemaining = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVerificationChange = async (founderId: string, currentValue: boolean | null) => {
    // Don't allow changes if timer is active (emails were sent and waiting for 24 hours)
    if (!canSendEmails && totalEmailsSent >= EMAIL_LIMIT) {
      return;
    }

    // Don't allow changes if mail was already sent
    const founder = founders.find(f => f.id === founderId);
    if (founder && founder['Mail Status'] === 'SENT') {
      return;
    }

    // Get current verified count
    const currentVerifiedCount = founders.filter(f => f['Verification'] === true).length;
    const isChecking = !currentValue; // true if we're checking this box
    
    // Calculate remaining emails available
    const remainingEmails = EMAIL_LIMIT - totalEmailsSent;
    
    // If checking a box, enforce remaining limit (not total limit, but remaining)
    if (isChecking && currentVerifiedCount >= remainingEmails) {
      setShowLimitToast(true);
      setTimeout(() => setShowLimitToast(false), 3000);
      return;
    }

    // Only update the UI state - don't update database yet
    // Database will be updated when Send Mail button is clicked
    setFounders(prevFounders =>
      prevFounders.map(founder =>
        founder.id === founderId
          ? { ...founder, 'Verification': !currentValue }
          : founder
      )
    );
  };


  // Filter founders by priority if filter is set
  const filteredFoundersByPriority = tablePriorityFilter
    ? founders.filter(founder => {
        const priority = founder['Priority based on Reply'];
        if (tablePriorityFilter === 'High Priority') {
          return priority === 'High Priority';
        } else if (tablePriorityFilter === 'Medium Priority') {
          return priority === 'Medium Priority';
        } else if (tablePriorityFilter === 'Low Priority') {
          return priority === 'Low Priority';
        }
        return true;
      })
    : founders;

  // Pagination logic
  const totalPages = Math.ceil(filteredFoundersByPriority.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFounders = filteredFoundersByPriority.slice(startIndex, endIndex);

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    // Scroll to top of table when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle individual lead selection
  const handleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  // Handle select all on current page
  const handleSelectAll = () => {
    if (selectedLeads.size === currentFounders.length) {
      // Deselect all on current page
      setSelectedLeads(prev => {
        const newSet = new Set(prev);
        currentFounders.forEach(founder => newSet.delete(founder.id));
        return newSet;
      });
    } else {
      // Select all on current page
      setSelectedLeads(prev => {
        const newSet = new Set(prev);
        currentFounders.forEach(founder => newSet.add(founder.id));
        return newSet;
      });
    }
  };

  // Handle bulk delete - show confirmation popup
  const handleDeleteSelected = () => {
    if (selectedLeads.size === 0) {
      setDeleteMessage('Please select at least one lead to delete');
      setShowDeleteErrorPopup(true);
      setTimeout(() => setShowDeleteErrorPopup(false), 3000);
      return;
    }

    setShowDeleteConfirmPopup(true);
  };

  // Confirm delete action
  const confirmDelete = async () => {
    setShowDeleteConfirmPopup(false);
    setIsDeleting(true);
    
    try {
      const idsToDelete = Array.from(selectedLeads);
      
      // Delete leads in batches
      const deletePromises = idsToDelete.map(id =>
        fetch(`/api/founders?id=${id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const failedDeletes = results.filter(r => !r.ok);

      if (failedDeletes.length > 0) {
        setDeleteMessage(`Failed to delete ${failedDeletes.length} lead(s). Please try again.`);
        setShowDeleteErrorPopup(true);
        setTimeout(() => setShowDeleteErrorPopup(false), 5000);
      } else {
        setDeleteMessage(`Successfully deleted ${selectedLeads.size} lead(s)`);
        setShowDeleteSuccessPopup(true);
        setTimeout(() => setShowDeleteSuccessPopup(false), 3000);
      }

      // Clear selection and refresh data
      setSelectedLeads(new Set());
      await refreshData();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setDeleteMessage('Error deleting leads. Please try again.');
      setShowDeleteErrorPopup(true);
      setTimeout(() => setShowDeleteErrorPopup(false), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete action
  const cancelDelete = () => {
    setShowDeleteConfirmPopup(false);
  };

  // Get verified founders (those with Verification checked)
  const getVerifiedFounders = () => {
    return founders.filter(f => f['Verification'] === true);
  };

  // Handle send to webhook - updates database verification column for both checked and unchecked
  const handleSendToWebhook = async () => {
    setIsSendingEmail(true);
    try {
      // Get founders that are checked (should be true in database)
      const verifiedFounders = founders.filter(f => f['Verification'] === true);
      
      if (verifiedFounders.length === 0) {
        alert('No founders selected for email');
        setIsSendingEmail(false);
        return;
      }

      // Calculate remaining emails available to send
      const remainingEmails = EMAIL_LIMIT - totalEmailsSent;
      
      // Check if this batch would exceed the limit
      if (verifiedFounders.length > remainingEmails) {
        alert(`You can only send ${remainingEmails} more email${remainingEmails !== 1 ? 's' : ''} (${totalEmailsSent} already sent out of ${EMAIL_LIMIT} limit). Please uncheck ${verifiedFounders.length - remainingEmails} email${verifiedFounders.length - remainingEmails !== 1 ? 's' : ''} to continue.`);
        setIsSendingEmail(false);
        return;
      }

      // Check if timer is active and we've reached the limit
      if (!canSendEmails && totalEmailsSent >= EMAIL_LIMIT) {
        alert(`You have reached the ${EMAIL_LIMIT} email limit. Please wait for the 24-hour timer to expire before sending more emails.`);
        setIsSendingEmail(false);
        return;
      }
      
      // Get founders that are unchecked (should be false in database)
      const unverifiedFounders = founders.filter(f => f['Verification'] === false || f['Verification'] === null);

      const totalToUpdate = verifiedFounders.length + unverifiedFounders.length;

      if (totalToUpdate === 0) {
        alert('No founders to update');
        setIsSendingEmail(false);
        return;
      }

      // Update database verification to true for checked founders
      const verifyPromises = verifiedFounders.map(founder =>
        fetch(`/api/founders?id=${founder.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'Verification': true
          })
        })
      );

      // Update database verification to false for unchecked founders
      const unverifyPromises = unverifiedFounders.map(founder =>
        fetch(`/api/founders?id=${founder.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'Verification': false
          })
        })
      );

      // Wait for all database updates to complete
      const allPromises = [...verifyPromises, ...unverifyPromises];
      const updateResults = await Promise.all(allPromises);
      const failedUpdates = updateResults.filter(r => !r.ok);

      if (failedUpdates.length > 0) {
        console.error(`Failed to update ${failedUpdates.length} founder(s) in database`);
      }

      // Trigger the webhook after successful database update
      try {
        // Build query parameters for GET request
        const queryParams = new URLSearchParams({
          message: 'Workflow was started',
          verifiedFounders: verifiedFounders.length.toString(),
          unverifiedFounders: unverifiedFounders.length.toString(),
          totalUpdated: totalToUpdate.toString(),
          timestamp: new Date().toISOString()
        });
        
        const webhookUrlWithParams = `${WEBHOOK_URL}?${queryParams.toString()}`;
        console.log('🚀 Triggering webhook:', webhookUrlWithParams);
        
        const webhookResponse = await fetch(webhookUrlWithParams, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });

        if (webhookResponse.ok) {
          const responseData = await webhookResponse.json();
          console.log('✅ Webhook triggered successfully:', responseData);
        } else {
          console.error('❌ Webhook failed:', webhookResponse.status, webhookResponse.statusText);
          const errorText = await webhookResponse.text();
          console.error('❌ Webhook error details:', errorText);
        }
      } catch (webhookError) {
        console.error('❌ Error triggering webhook:', webhookError);
      }

      // Calculate new total after this send
      const newTotalSent = totalEmailsSent + verifiedFounders.length;
      
      // Start 24-hour timer only if we've reached or exceeded the EMAIL_LIMIT (400) emails
      // This is cumulative across all batches
      if (newTotalSent >= EMAIL_LIMIT) {
        const timestamp = Date.now();
        const userEmail = user || 'corofy.marketing@gmail.com';
        try {
          await fetch('/api/email-timer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail, timestamp })
          });
        } catch (error) {
          console.error('Error saving email timer:', error);
        }
        setEmailSendTimestamp(timestamp);
        setTimeRemaining(24 * 60 * 60 * 1000); // 24 hours in milliseconds
        setCanSendEmails(false);
        console.log(`⏰ Timer started: Reached ${EMAIL_LIMIT} email limit (${newTotalSent} total sent). 24-hour cooldown activated.`);
      } else {
        // If we haven't reached 400 total, don't start the timer - allow more sends
        const remaining = EMAIL_LIMIT - newTotalSent;
        console.log(`✅ Sent ${verifiedFounders.length} emails. Total sent: ${newTotalSent} / ${EMAIL_LIMIT} (${remaining} remaining). Timer not started.`);
      }
      
      // Update total emails sent count
      setTotalEmailsSent(newTotalSent);

      // Show success popup
      setShowEmailSuccessPopup(true);
      
      // Auto-close popup after 3 seconds
      setTimeout(() => {
        setShowEmailSuccessPopup(false);
      }, 3000);

      // Refresh the data to show updated database status
      await refreshData();
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('❌ Error updating verification in database. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 rounded-t-lg">
        <h2 className="text-xl font-bold">Founders Database</h2>
        <p className="text-blue-100 mt-1">View all founders stored in the database</p>
      </div>

      <div className="p-6">
        
        {/* Timer and Limit Banner */}
        {!canSendEmails && timeRemaining !== null && (
          <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-orange-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Sending Paused</h3>
                  <p className="text-sm text-gray-700 mt-1">
                    You can send the next batch of emails in: <span className="font-mono font-bold text-orange-700">{formatTimeRemaining(timeRemaining)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    You&apos;ve reached the {EMAIL_LIMIT} email limit ({totalEmailsSent} sent). After the timer expires, you can send more emails.
                  </p>
                </div>
              </div>
              <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">{formatTimeRemaining(timeRemaining)}</div>
                <div className="text-xs text-gray-500 mt-1">Remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Remaining Emails Counter */}
        {canSendEmails && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Sending Available</h3>
                  <p className="text-sm text-gray-700 mt-1">
                    You can send <span className="font-bold text-blue-700">{EMAIL_LIMIT - totalEmailsSent}</span> more email{EMAIL_LIMIT - totalEmailsSent !== 1 ? 's' : ''} ({totalEmailsSent} / {EMAIL_LIMIT} sent)
                  </p>
                </div>
              </div>
              <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{EMAIL_LIMIT - totalEmailsSent}</div>
                <div className="text-xs text-gray-500 mt-1">Remaining</div>
              </div>
            </div>
          </div>
        )}


        {/* Industry Filter and Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
          <div className="flex-1">
            <label htmlFor="industry-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Company Industry {industriesLoading ? (
                <span className="text-gray-400 font-normal">(Loading...)</span>
              ) : industries.length > 0 ? (
                <span className="text-gray-500 font-normal">({industries.length} industries available)</span>
              ) : (
                <span className="text-red-500 font-normal">(No industries found - check console)</span>
              )}
            </label>
            <select
              id="industry-filter"
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              disabled={industriesLoading}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="text-black">
                {industriesLoading ? 'Loading industries...' : industries.length > 0 ? `All Company Industries (${industries.length} total)` : 'No industries found'}
              </option>
              {industries.map(industry => (
                <option key={industry} value={industry} className="text-black">
                  {industry}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {selectedLeads.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Deleting...' : `Delete Selected (${selectedLeads.size})`}
              </button>
            )}
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading founders...</span>
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

        {/* Founders Table */}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={currentFounders.length > 0 && currentFounders.every(f => selectedLeads.has(f.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Founder Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Founder Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Founder LinkedIn
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Founder Address
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Industry
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Website
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company LinkedIn
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Phone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verification
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mail Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mail Replys
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Follow-Up Sent (5 days)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Follow-Up Sent (10 days)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Mail Priority</span>
                      <span className="text-gray-400" title="Priority based on reply status: High (replied), Low (not sent), - (mail sent but no reply)">
                        ℹ️
                      </span>
                      <select
                        value={tablePriorityFilter}
                        onChange={(e) => {
                          setTablePriorityFilter(e.target.value);
                          setCurrentPage(1); // Reset to first page when filter changes
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 text-xs border border-gray-300 rounded px-2 py-1 text-gray-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                        title="Filter by priority"
                      >
                        <option value="">All</option>
                        <option value="High Priority">High</option>
                        <option value="Medium Priority">Medium</option>
                        <option value="Low Priority">Low</option>
                      </select>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFoundersByPriority.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-3 py-4 text-center text-gray-500">
                      {tablePriorityFilter ? `No founders found with ${tablePriorityFilter}` : 'No founders found'}
                    </td>
                  </tr>
                ) : (
                  currentFounders.map((founder, index) => (
                    <tr key={founder.id} className={`hover:bg-gray-50 ${selectedLeads.has(founder.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(founder.id)}
                          onChange={() => handleLeadSelection(founder.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-700">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {founder['Founder Name']}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Company Name']}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Position']}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Founder Email'] ? (
                          <a href={`mailto:${founder['Founder Email']}`} className="text-blue-600 hover:text-blue-800">
                            {founder['Founder Email']}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Founder Linkedin'] ? (
                          <a href={founder['Founder Linkedin']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            LinkedIn
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={founder['Founder Address'] || ''}>
                          {founder['Founder Address'] || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={founder["Company's Industry"] || ''}>
                          {founder["Company's Industry"] || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Company Website'] ? (
                          <a href={founder['Company Website']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            Website
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Company Linkedin'] ? (
                          <a href={founder['Company Linkedin']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            LinkedIn
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Company Phone'] || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={founder['Verification'] || false}
                            onChange={() => handleVerificationChange(founder.id, founder['Verification'])}
                            disabled={!canSendEmails || founder['Mail Status'] === 'SENT'}
                            className={`h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                              !canSendEmails || founder['Mail Status'] === 'SENT'
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            }`}
                            title={
                              founder['Mail Status'] === 'SENT'
                                ? 'Mail already sent - cannot modify verification'
                                : !canSendEmails
                                ? 'Verification locked - waiting for 24-hour timer'
                                : founder['Verification']
                                ? 'Click to unverify'
                                : 'Click to verify'
                            }
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Mail Status'] ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            founder['Mail Status'] === 'SENT' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {founder['Mail Status']}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {founder['Mail Replys'] ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const followUp5Days = founder['1st Follow-Up Sent (5 days)'];
                          const isFollowUp5DaysSent = followUp5Days && 
                            followUp5Days.trim() !== '' && 
                            followUp5Days.toLowerCase() === 'sent';
                          
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isFollowUp5DaysSent 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isFollowUp5DaysSent ? 'Sent' : 'Not Sent'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const followUp10Days = founder['2nd Follow-Up Sent (10 days)'];
                          const isFollowUp10DaysSent = followUp10Days && 
                            followUp10Days.trim() !== '' && 
                            followUp10Days.toLowerCase() === 'sent';
                          
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isFollowUp10DaysSent 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isFollowUp10DaysSent ? 'Sent' : 'Not Sent'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const priority = calculatePriority(founder);
                          
                          // If priority is null, undefined, or empty, show "-"
                          if (!priority || priority === null || priority === undefined || priority.trim() === '') {
                            return <span className="text-gray-400">-</span>;
                          }
                          
                          const hasReplied = founder['Mail Replys'] && 
                            founder['Mail Replys'].trim() !== '' && 
                            founder['Mail Replys'].toLowerCase() !== 'no reply' &&
                            founder['Mail Replys'].toLowerCase() !== 'no_reply';
                          
                          let tooltipText = '';
                          if (priority === 'High') {
                            tooltipText = hasReplied ? 'High Priority: Has replied to email' : 'High Priority: Set by database';
                          } else if (priority === 'Low') {
                            tooltipText = 'Low Priority: No mail sent yet';
                          }
                          
                          return (
                            <span 
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-help ${
                                priority === 'High' 
                                  ? 'bg-red-100 text-red-800' 
                                  : priority === 'Low'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                              title={tooltipText}
                            >
                              {priority}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && !error && filteredFoundersByPriority.length > 0 && (
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
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm text-black"
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
                Showing {startIndex + 1} to {Math.min(endIndex, filteredFoundersByPriority.length)} of {filteredFoundersByPriority.length} founder{filteredFoundersByPriority.length !== 1 ? 's' : ''}
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
        {!isLoading && !error && founders.length > 0 && lastRefreshTime && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  Data loaded successfully! {founders.length} founder{founders.length !== 1 ? 's' : ''} found.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Send Mail Button - Fixed at bottom center */}
      {getVerifiedFounders().length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-slide-up-bounce">
          <button
            onClick={handleSendToWebhook}
            disabled={isSendingEmail || !canSendEmails}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-all transform hover:scale-105 hover:shadow-3xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingEmail ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span className="font-semibold text-lg">Sending...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-semibold text-lg">Send Mail</span>
                <span className="bg-white text-blue-600 rounded-full px-3 py-1 text-sm font-bold">
                  {getVerifiedFounders().length}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Email Success Toast Notification */}
      {showEmailSuccessPopup && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md border-l-4 border-green-500 animate-slideDown">
            <div className="flex items-start gap-4">
              {/* Success icon */}
              <div className="flex-shrink-0">
                <div className="bg-green-100 rounded-full p-2.5">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              {/* Message */}
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  ✉️ Emails Sent Successfully!
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Successfully sent emails to <span className="font-semibold text-green-700">{getVerifiedFounders().length}</span> verified founder{getVerifiedFounders().length !== 1 ? 's' : ''}.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Your workflow has been triggered and all emails are being processed.
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowEmailSuccessPopup(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors ml-2"
                aria-label="Close notification"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
{/* Limit Toast Notification */}
      {showLimitToast && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md border-l-4 border-orange-500 animate-slideDown">
            <div className="flex items-start gap-4">
              {/* Warning icon */}
              <div className="flex-shrink-0">
                <div className="bg-orange-100 rounded-full p-2.5">
                  <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              
              {/* Message */}
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  ⚠️ Selection Limit Reached
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  You can only select up to <span className="font-semibold text-orange-700">{EMAIL_LIMIT - totalEmailsSent} more email{EMAIL_LIMIT - totalEmailsSent !== 1 ? 's' : ''}</span> ({totalEmailsSent} already sent out of {EMAIL_LIMIT} limit).
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Please uncheck some emails before selecting more.
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowLimitToast(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors ml-2"
                aria-label="Close notification"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup - Top Toast */}
      {showDeleteConfirmPopup && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md border-l-4 border-orange-500 animate-slideDown">
            <div className="flex items-start gap-4">
              {/* Warning icon */}
              <div className="flex-shrink-0">
                <div className="bg-orange-100 rounded-full p-2.5">
                  <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              
              {/* Message */}
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  ⚠️ Are you sure you want to delete?
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  You are about to delete <span className="font-semibold text-orange-700">{selectedLeads.size}</span> lead{selectedLeads.size !== 1 ? 's' : ''}. This action cannot be undone.
                </p>
                
                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-sm"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </button>
                  <button
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    className="bg-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors ml-2"
                aria-label="Close confirmation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Popup */}
      {showDeleteSuccessPopup && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md border-l-4 border-green-500 animate-slideDown">
            <div className="flex items-start gap-4">
              {/* Success icon */}
              <div className="flex-shrink-0">
                <div className="bg-green-100 rounded-full p-2.5">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              {/* Message */}
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  🗑️ Deleted Successfully!
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {deleteMessage}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowDeleteSuccessPopup(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors ml-2"
                aria-label="Close notification"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Error Popup */}
      {showDeleteErrorPopup && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md border-l-4 border-red-500 animate-slideDown">
            <div className="flex items-start gap-4">
              {/* Error icon */}
              <div className="flex-shrink-0">
                <div className="bg-red-100 rounded-full p-2.5">
                  <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Message */}
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  ❌ Delete Failed
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {deleteMessage}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowDeleteErrorPopup(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors ml-2"
                aria-label="Close notification"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
