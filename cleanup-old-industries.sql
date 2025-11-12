-- ============================================
-- Clean Up Old Industry Data (OPTIONAL)
-- ============================================
-- This script updates old records with JSON array format
-- to the new clean text format
-- 
-- Run this in Supabase SQL Editor if you want to fix old data
-- ============================================

-- 1. Check what old data exists
SELECT 
  "Company's Industry",
  COUNT(*) as count
FROM "scraped Data"
WHERE "Company's Industry" LIKE '[%]'
GROUP BY "Company's Industry"
ORDER BY count DESC;

-- Expected output:
-- ["oil & energy"] - X records
-- ["oil & energy","utilities"] - Y records
-- etc.

-- ============================================
-- 2. OPTION A: Delete Old Records (Clean Slate)
-- ============================================
-- Uncomment if you want to DELETE all old records

-- DELETE FROM "scraped Data" 
-- WHERE "Company's Industry" LIKE '[%]';

-- ============================================
-- 3. OPTION B: Update Old Records (Preserve Data)
-- ============================================
-- Uncomment lines below to UPDATE old records instead

-- Update oil & energy to Oil & Gas
-- UPDATE "scraped Data" 
-- SET "Company's Industry" = 'Oil & Gas',
--     updated_at = NOW()
-- WHERE "Company's Industry" = '["oil & energy"]' 
--    OR "Company's Industry" = '["oil & energy","utilities"]';

-- Update chemicals/agrochemicals to Agrochemical
-- UPDATE "scraped Data"
-- SET "Company's Industry" = 'Agrochemical',
--     updated_at = NOW()
-- WHERE "Company's Industry" LIKE '%chemical%'
--   AND "Company's Industry" LIKE '[%]';

-- Update lubricants to Lubricant
-- UPDATE "scraped Data"
-- SET "Company's Industry" = 'Lubricant',
--     updated_at = NOW()
-- WHERE "Company's Industry" LIKE '%lubricant%'
--   AND "Company's Industry" LIKE '[%]';

-- ============================================
-- 4. Verify Clean Data
-- ============================================
-- Check that only clean industries remain
SELECT 
  "Company's Industry",
  COUNT(*) as count
FROM "scraped Data"
GROUP BY "Company's Industry"
ORDER BY "Company's Industry";

-- Expected output (after cleanup):
-- Agrochemical - X records
-- Lubricant - Y records
-- Oil & Gas - Z records

-- ============================================
-- 5. Check for any remaining problematic records
-- ============================================
SELECT 
  id,
  "Founder Name",
  "Company Name",
  "Company's Industry",
  created_at
FROM "scraped Data"
WHERE "Company's Industry" LIKE '[%]'
ORDER BY created_at DESC
LIMIT 20;

-- If this returns 0 rows, cleanup is complete!

-- ============================================
-- RECOMMENDATION
-- ============================================
-- For your use case, I recommend OPTION A (DELETE)
-- because:
-- 1. You just set up the correct flow today
-- 2. Old data has inconsistent format
-- 3. You can re-scrape leads with correct format
-- 4. Keeps your database clean from the start
-- 
-- If you want to keep old leads, use OPTION B (UPDATE)
-- ============================================

