-- Create Email Send Timestamps Table
-- This table stores the last email send timestamp per user to enforce 24-hour cooldown across all devices

CREATE TABLE IF NOT EXISTS email_send_timestamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  last_send_timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE email_send_timestamps ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust for production)
CREATE POLICY "Allow all operations on email_send_timestamps" ON email_send_timestamps
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_timestamps_user ON email_send_timestamps(user_email);

-- Insert default record for the main user (if it doesn't exist)
INSERT INTO email_send_timestamps (user_email, last_send_timestamp)
VALUES ('corofy.marketing@gmail.com', 0)
ON CONFLICT (user_email) DO NOTHING;

