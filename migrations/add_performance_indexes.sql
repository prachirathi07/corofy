-- Performance Indexes for Email Sending System
-- Run this in Supabase SQL Editor

-- ============================================
-- Scraped Data Indexes
-- ============================================

-- Index for finding unprocessed leads
CREATE INDEX IF NOT EXISTS idx_scraped_data_email_processed 
ON scraped_data(email_processed) 
WHERE email_processed IS NOT NULL;

-- Index for finding leads with valid emails
CREATE INDEX IF NOT EXISTS idx_scraped_data_founder_email 
ON scraped_data(founder_email) 
WHERE founder_email IS NOT NULL AND founder_email != '';

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_scraped_data_created_at 
ON scraped_data(created_at DESC);

-- Composite index for unprocessed leads with emails
CREATE INDEX IF NOT EXISTS idx_scraped_data_unprocessed_with_email
ON scraped_data(email_processed, founder_email)
WHERE email_processed IS NULL OR email_processed = false;

-- ============================================
-- Email Queue Indexes
-- ============================================

-- Index for finding pending emails
CREATE INDEX IF NOT EXISTS idx_email_queue_status 
ON email_queue(status) 
WHERE status = 'pending';

-- Index for finding scheduled emails
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled 
ON email_queue(scheduled_time) 
WHERE status = 'pending';

-- Index for lead lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_lead_id 
ON email_queue(lead_id);

-- ============================================
-- Company Websites Indexes
-- ============================================

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS idx_company_websites_domain 
ON company_websites(company_domain);

-- Index for successful scrapes
CREATE INDEX IF NOT EXISTS idx_company_websites_status 
ON company_websites(scraping_status) 
WHERE scraping_status = 'success';

-- ============================================
-- Daily Email Tracking Indexes
-- ============================================

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_daily_email_tracking_date 
ON daily_email_tracking(last_send_date DESC);

-- ============================================
-- Analyze Tables for Query Optimization
-- ============================================

ANALYZE scraped_data;
ANALYZE email_queue;
ANALYZE company_websites;
ANALYZE daily_email_tracking;

-- ============================================
-- Verify Indexes Created
-- ============================================

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('scraped_data', 'email_queue', 'company_websites', 'daily_email_tracking')
ORDER BY tablename, indexname;
