-- Fix email_queue foreign key constraint
-- Step 1: Clean up orphaned records first

-- Delete orphaned records from email_queue that don't have matching leads in scraped_data
DELETE FROM email_queue
WHERE lead_id NOT IN (SELECT id FROM scraped_data);

-- Step 2: Drop the existing foreign key constraint
ALTER TABLE email_queue 
DROP CONSTRAINT IF EXISTS email_queue_lead_id_fkey;

-- Step 3: Add new foreign key constraint pointing to scraped_data
ALTER TABLE email_queue 
ADD CONSTRAINT email_queue_lead_id_fkey 
FOREIGN KEY (lead_id) 
REFERENCES scraped_data(id) 
ON DELETE CASCADE;

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'email_queue_lead_id_fkey';
