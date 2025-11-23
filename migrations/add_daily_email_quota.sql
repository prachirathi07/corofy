-- Add a table to track daily email sending limits
CREATE TABLE IF NOT EXISTS daily_email_quota (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    emails_sent INTEGER DEFAULT 0,
    quota_limit INTEGER DEFAULT 400,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_email_quota_date ON daily_email_quota(date);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_daily_email_quota_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_email_quota_updated_at
    BEFORE UPDATE ON daily_email_quota
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_email_quota_updated_at();

-- Add a column to track last batch processed
ALTER TABLE scraped_data 
ADD COLUMN IF NOT EXISTS email_batch_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_batch_date DATE;

CREATE INDEX IF NOT EXISTS idx_scraped_data_email_batch ON scraped_data(email_batch_processed, email_batch_date);
