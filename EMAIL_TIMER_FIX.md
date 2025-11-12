# Email Timer Fix - Cross-Device Synchronization

## Problem
The 24-hour email timer was stored in `localStorage`, which is device-specific. This meant that when you logged in on a different device, the timer wasn't visible, allowing you to send emails again even though you just sent them from another device.

## Solution
The timer is now stored in the database (Supabase), making it synchronized across all devices for the same user account.

## Changes Made

### 1. Database Table
Created `create-email-timer-table.sql` - A new table `email_send_timestamps` that stores:
- `user_email`: The user's email address (unique)
- `last_send_timestamp`: Unix timestamp of when emails were last sent
- `created_at` and `updated_at`: Timestamps for tracking

### 2. Database Methods
Added `EmailTimerDatabase` class in `lib/database.ts` with methods:
- `getEmailSendTimestamp(userEmail)`: Get the last send timestamp
- `setEmailSendTimestamp(userEmail, timestamp)`: Save/update the timestamp
- `clearEmailSendTimestamp(userEmail)`: Clear the timer (set to 0)

### 3. API Route
Created `/app/api/email-timer/route.ts` with:
- `GET`: Fetch the email send timestamp for a user
- `POST`: Save/update the email send timestamp

### 4. Component Updates
Updated `components/FoundersTable.tsx`:
- Removed all `localStorage` usage for email timer
- Now fetches timer from database on component mount
- Saves timer to database when emails are sent
- Timer is now synchronized across all devices

## Setup Instructions

### Step 1: Run the SQL Migration
Execute the SQL file in your Supabase SQL Editor:

```sql
-- Run this in Supabase SQL Editor
-- File: create-email-timer-table.sql
```

Or copy and paste the contents of `create-email-timer-table.sql` into your Supabase SQL Editor and execute it.

### Step 2: Restart Your Next.js Server
After running the SQL migration, restart your Next.js development server:

```bash
npm run dev
```

### Step 3: Test
1. Log in on Device A
2. Send emails (click "Send Mail")
3. Log in on Device B (or refresh Device A)
4. You should see the same 24-hour timer countdown on both devices

## How It Works

1. **On Component Load**: The component fetches the email send timestamp from the database
2. **When Sending Emails**: After successfully sending emails, the timestamp is saved to the database
3. **Timer Countdown**: The timer counts down locally but the source of truth is in the database
4. **Cross-Device Sync**: When you log in on a different device, it fetches the same timestamp from the database

## Benefits

✅ Timer is synchronized across all devices  
✅ Cannot bypass the 24-hour limit by switching devices  
✅ Timer persists even if you clear browser cache  
✅ Works for multiple users (if you add more users in the future)

## Notes

- The timer uses the user's email from the auth context
- Defaults to `corofy.marketing@gmail.com` if no user is found
- The timer is stored as a Unix timestamp (milliseconds since epoch)
- Timer automatically expires after 24 hours and allows sending again

