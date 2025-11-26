# Email Timer Setup Instructions

## ⚠️ IMPORTANT: Database Table Required

The email timer feature requires a database table to store timer information. If you're seeing the error "Failed to save timer", you need to create the table first.

## Step 1: Create the Database Table

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `create-email-timer-table.sql`
5. Click **Run** to execute the SQL

The SQL will create:
- `email_send_timestamps` table
- Index on `user_email` for fast lookups
- Row Level Security policies

## Step 2: Verify Table Creation

After running the SQL, verify the table exists:

1. Go to **Table Editor** in Supabase
2. Look for `email_send_timestamps` table
3. It should have these columns:
   - `id` (UUID, Primary Key)
   - `user_email` (TEXT, Unique)
   - `last_send_timestamp` (BIGINT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

## Step 3: Test the Timer

1. Restart your Next.js server: `npm run dev`
2. Go to the database page
3. Click "Send Mail" button
4. The timer should start and save successfully
5. Refresh the page - timer should persist

## Troubleshooting

### Error: "Table does not exist"
- **Solution**: Run the SQL migration from `create-email-timer-table.sql`

### Error: "Permission denied"
- **Solution**: Check that Row Level Security policies are set correctly
- The SQL script includes: `CREATE POLICY "Allow all operations on email_send_timestamps"`

### Error: "Failed to save timer"
- Check the browser console for detailed error messages
- Verify the table exists in Supabase
- Check that your Supabase credentials are correct in `.env.local`

## Quick SQL Check

Run this in Supabase SQL Editor to check if the table exists:

```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'email_send_timestamps'
);
```

If it returns `false`, the table doesn't exist and you need to run the migration.

