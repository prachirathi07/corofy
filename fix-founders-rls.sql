-- Fix Row Level Security for "scraped Data" table
-- Run this in Supabase SQL Editor

-- Enable RLS (if not already enabled)
ALTER TABLE "scraped Data" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on scraped Data" ON "scraped Data";
DROP POLICY IF EXISTS "Enable read access for all users" ON "scraped Data";
DROP POLICY IF EXISTS "Enable insert for all users" ON "scraped Data";
DROP POLICY IF EXISTS "Enable update for all users" ON "scraped Data";
DROP POLICY IF EXISTS "Enable delete for all users" ON "scraped Data";

-- Create a single policy for all operations
CREATE POLICY "Allow all operations on scraped Data" ON "scraped Data"
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Verify the policy was created
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'scraped Data';



