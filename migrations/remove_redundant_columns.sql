-- ============================================
-- REMOVE REDUNDANT COLUMNS FROM scraped_data
-- ============================================
-- This migration removes columns that are no longer needed:
-- 1. wait_initial_email, wait_followup_5, wait_followup_10 (never used)
-- 2. status (replaced by mail_status)
-- ============================================

-- Step 1: Remove unused wait columns
-- These columns are defined in models but never used in business logic
ALTER TABLE scraped_data 
  DROP COLUMN IF EXISTS wait_initial_email,
  DROP COLUMN IF EXISTS wait_followup_5,
  DROP COLUMN IF EXISTS wait_followup_10;

-- Step 2: Remove status column (replaced by mail_status)
-- Note: simplified_email_tracking_service.py has been updated to use mail_status
ALTER TABLE scraped_data 
  DROP COLUMN IF EXISTS status;

-- Step 3: Remove unused company columns (mostly NULL, not used in business logic)
-- These are populated from Apollo but never used in queries or logic
ALTER TABLE scraped_data 
  DROP COLUMN IF EXISTS company_blogpost,
  DROP COLUMN IF EXISTS company_angellist,
  DROP COLUMN IF EXISTS company_phone;

-- Step 4: Verify columns are removed
DO $$
BEGIN
    -- Check if columns still exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name IN ('wait_initial_email', 'wait_followup_5', 'wait_followup_10', 'status', 'company_blogpost', 'company_angellist', 'company_phone')
    ) THEN
        RAISE NOTICE 'Some columns still exist. Check manually.';
    ELSE
        RAISE NOTICE 'All redundant columns removed successfully.';
    END IF;
END $$;

-- ============================================
-- NOTES:
-- ============================================
-- retry_count and next_retry_at are KEPT:
-- - Used by DeadLetterQueueService for retrying failed emails
-- - Essential for email retry functionality
-- 
-- followup_5_sent and followup_10_sent are kept for now:
-- - Still used in queries for backward compatibility
-- - Can be removed in future after updating all queries to use mail_status only
-- 
-- email_processed is kept:
-- - Used in simplified_email_tracking_service.py for batch processing
-- - Tracks which leads have been processed in daily batches
-- ============================================

