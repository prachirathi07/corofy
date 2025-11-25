-- ============================================
-- Migration: Add follow-up scheduled date columns to scraped_data
-- ============================================

-- Step 1: Add follow-up scheduled date columns
-- ============================================

ALTER TABLE scraped_data 
  ADD COLUMN IF NOT EXISTS followup_5_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS followup_10_scheduled_date DATE;

-- Step 2: Verify columns exist
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'followup_5_scheduled_date'
    ) THEN
        RAISE NOTICE 'followup_5_scheduled_date column exists';
    ELSE
        RAISE WARNING 'followup_5_scheduled_date column does not exist';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'followup_10_scheduled_date'
    ) THEN
        RAISE NOTICE 'followup_10_scheduled_date column exists';
    ELSE
        RAISE WARNING 'followup_10_scheduled_date column does not exist';
    END IF;
END $$;

-- Step 3: Add indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scraped_data_followup_5_date 
  ON scraped_data(followup_5_scheduled_date)
  WHERE (followup_5_sent IS NULL OR followup_5_sent = 'false') AND mail_status = 'email_sent';

CREATE INDEX IF NOT EXISTS idx_scraped_data_followup_10_date 
  ON scraped_data(followup_10_scheduled_date)
  WHERE (followup_10_sent IS NULL OR followup_10_sent = 'false') AND mail_status = 'email_sent';

-- Step 4: Add column comments
-- ============================================

COMMENT ON COLUMN scraped_data.followup_5_scheduled_date IS 
  'Date when 5-day follow-up email should be sent (5 days after initial email)';

COMMENT ON COLUMN scraped_data.followup_10_scheduled_date IS 
  'Date when 10-day follow-up email should be sent (10 days after initial email)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

