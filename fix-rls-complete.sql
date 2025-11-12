-- Complete fix for Row Level Security on "scraped Data" table
-- Copy and run this ENTIRE script in your Supabase SQL Editor

-- Step 1: Disable RLS temporarily to check data
ALTER TABLE "scraped Data" DISABLE ROW LEVEL SECURITY;

-- Step 2: Check if data exists (you should see your records)
SELECT COUNT(*) as total_records FROM "scraped Data";

-- Step 3: Re-enable RLS
ALTER TABLE "scraped Data" ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'scraped Data'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON "scraped Data"', r.policyname);
    END LOOP;
END $$;

-- Step 5: Create new policy that allows ALL operations for EVERYONE
CREATE POLICY "allow_all_scraped_data" 
ON "scraped Data"
FOR ALL 
TO public
USING (true) 
WITH CHECK (true);

-- Step 6: Grant necessary permissions
GRANT ALL ON "scraped Data" TO anon;
GRANT ALL ON "scraped Data" TO authenticated;

-- Step 7: Verify the policy was created
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'scraped Data';

-- Step 8: Test query (should return your data)
SELECT 
    id,
    "Founder Name",
    "Company Name",
    "Company's Industry"
FROM "scraped Data"
LIMIT 5;



