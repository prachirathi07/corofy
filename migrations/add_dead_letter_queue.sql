-- Dead Letter Queue for Failed Emails
-- Stores failed email attempts for automatic retry

-- Create failed_emails table
CREATE TABLE IF NOT EXISTS failed_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES scraped_data(id) ON DELETE CASCADE,
    email_to VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    error_message TEXT,
    error_type VARCHAR(50), -- network, validation, api_error, timeout, etc.
    attempt_count INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'pending', -- pending, retrying, failed, resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_retry_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_failed_emails_status 
ON failed_emails(status) 
WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_failed_emails_next_retry 
ON failed_emails(next_retry_at) 
WHERE status = 'pending' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_failed_emails_lead_id 
ON failed_emails(lead_id);

CREATE INDEX IF NOT EXISTS idx_failed_emails_created 
ON failed_emails(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_emails_error_type 
ON failed_emails(error_type);

-- Add comments
COMMENT ON TABLE failed_emails IS 'Dead letter queue for failed email attempts';
COMMENT ON COLUMN failed_emails.status IS 'Status: pending (ready to retry), retrying (in progress), failed (max attempts reached), resolved (successfully sent)';
COMMENT ON COLUMN failed_emails.error_type IS 'Type of error: network, validation, api_error, timeout, rate_limit, etc.';
COMMENT ON COLUMN failed_emails.next_retry_at IS 'Scheduled time for next retry attempt';

-- Create view for retry-ready emails
CREATE OR REPLACE VIEW retry_ready_emails AS
SELECT 
    id,
    lead_id,
    email_to,
    subject,
    error_message,
    error_type,
    attempt_count,
    max_attempts,
    created_at,
    last_attempt_at,
    next_retry_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_since_failure
FROM failed_emails
WHERE status = 'pending'
AND attempt_count < max_attempts
AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY created_at ASC;

-- Create view for failed emails summary
CREATE OR REPLACE VIEW failed_emails_summary AS
SELECT 
    status,
    error_type,
    COUNT(*) as count,
    MIN(created_at) as oldest_failure,
    MAX(created_at) as newest_failure
FROM failed_emails
GROUP BY status, error_type
ORDER BY count DESC;

-- Verify tables created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name = 'failed_emails';
