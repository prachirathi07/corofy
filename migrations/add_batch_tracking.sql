-- Progress Tracking for Email Batches
-- Allows monitoring batch progress and resuming failed batches

-- Create email_batches table
CREATE TABLE IF NOT EXISTS email_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_leads INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed, cancelled
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    batch_metadata JSONB DEFAULT '{}'::jsonb -- Store additional context
);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_email_batches_status 
ON email_batches(status);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_email_batches_started 
ON email_batches(started_at DESC);

-- Create index for active batches
CREATE INDEX IF NOT EXISTS idx_email_batches_active 
ON email_batches(status, started_at DESC) 
WHERE status IN ('running', 'failed');

-- Add comments for documentation
COMMENT ON TABLE email_batches IS 'Tracks progress of email sending batches';
COMMENT ON COLUMN email_batches.status IS 'Batch status: running, completed, failed, cancelled';
COMMENT ON COLUMN email_batches.batch_metadata IS 'Additional context like batch type, filters used, etc.';

-- Create view for active batches
CREATE OR REPLACE VIEW active_email_batches AS
SELECT 
    id,
    total_leads,
    processed_count,
    success_count,
    failed_count,
    skipped_count,
    status,
    started_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60, 2) as duration_minutes,
    CASE 
        WHEN total_leads > 0 THEN ROUND((processed_count::DECIMAL / total_leads::DECIMAL) * 100, 2)
        ELSE 0
    END as progress_percentage
FROM email_batches
WHERE status IN ('running', 'failed')
ORDER BY started_at DESC;

-- Verify tables created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name = 'email_batches';
