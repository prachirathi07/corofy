-- Simplified daily email quota system
-- Tracks when emails were last sent and which batch to process next

CREATE TABLE IF NOT EXISTS daily_email_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    last_send_date DATE NOT NULL UNIQUE,
    batch_offset INTEGER DEFAULT 0,  -- Which batch number (0 = leads 1-400, 1 = leads 401-800, etc.)
    leads_processed INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_daily_email_tracking_date ON daily_email_tracking(last_send_date);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_daily_email_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_email_tracking_updated_at
    BEFORE UPDATE ON daily_email_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_email_tracking_updated_at();

-- Add a simple processed flag to scraped_data
ALTER TABLE scraped_data 
ADD COLUMN IF NOT EXISTS email_processed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_scraped_data_email_processed ON scraped_data(email_processed);
