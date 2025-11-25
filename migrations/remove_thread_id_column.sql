-- ============================================
-- Migration: Remove thread_id column from scraped_data
-- Replace all references with gmail_thread_id
-- ============================================

-- Step 1: Check if thread_id column exists and drop it
-- ============================================

DO $$
BEGIN
    -- Check if thread_id column exists in scraped_data table
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'thread_id'
    ) THEN
        -- Drop the thread_id column
        ALTER TABLE scraped_data DROP COLUMN thread_id;
        RAISE NOTICE 'Dropped thread_id column from scraped_data table';
    ELSE
        RAISE NOTICE 'thread_id column does not exist in scraped_data table - nothing to drop';
    END IF;
END $$;

-- Step 2: Verify gmail_thread_id column exists
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'gmail_thread_id'
    ) THEN
        -- Add gmail_thread_id if it doesn't exist
        ALTER TABLE scraped_data 
        ADD COLUMN gmail_thread_id VARCHAR(255);
        
        CREATE INDEX IF NOT EXISTS idx_scraped_data_gmail_thread_id 
        ON scraped_data(gmail_thread_id);
        
        RAISE NOTICE 'Added gmail_thread_id column to scraped_data table';
    ELSE
        RAISE NOTICE 'gmail_thread_id column already exists in scraped_data table';
    END IF;
END $$;

-- Step 3: Verify migration
-- ============================================

DO $$
DECLARE
    thread_id_exists BOOLEAN;
    gmail_thread_id_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'thread_id'
    ) INTO thread_id_exists;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'scraped_data' 
        AND column_name = 'gmail_thread_id'
    ) INTO gmail_thread_id_exists;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'thread_id column exists: %', thread_id_exists;
    RAISE NOTICE 'gmail_thread_id column exists: %', gmail_thread_id_exists;
    RAISE NOTICE '===========================================';
    
    IF thread_id_exists THEN
        RAISE WARNING 'thread_id column still exists - migration may have failed';
    END IF;
    
    IF NOT gmail_thread_id_exists THEN
        RAISE WARNING 'gmail_thread_id column does not exist - migration may have failed';
    END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- All code references to thread_id have been updated to use gmail_thread_id
-- The thread_id column has been removed from scraped_data table
-- ============================================

