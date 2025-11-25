-- Create email_send_timestamps table for 24-hour email sending cooldown
-- This table stores when emails were last sent for each user

CREATE TABLE IF NOT EXISTS email_send_timestamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  last_send_timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_send_timestamps_user_email ON email_send_timestamps(user_email);

-- Enable Row Level Security
ALTER TABLE email_send_timestamps ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on email_send_timestamps" ON email_send_timestamps
  FOR ALL USING (true) WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE email_send_timestamps IS 'Stores 24-hour email sending cooldown timestamps per user';

