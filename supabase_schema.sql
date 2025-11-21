-- ============================================
-- Database Schema for Lead Scraping & Email Automation System
-- Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. APOLLO SEARCHES TABLE
-- Stores search criteria/filters for Apollo API
-- ============================================
CREATE TABLE apollo_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_size_min INTEGER,
    employee_size_max INTEGER,
    country VARCHAR(100),
    sic_codes TEXT[], -- Array of SIC codes
    c_suites TEXT[], -- Array of C-suite titles (CEO, CFO, etc.)
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    total_leads_found INTEGER DEFAULT 0,
    source VARCHAR(50) DEFAULT 'apollo', -- 'apollo' or 'apify' - tracks which source was used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 2. LEADS TABLE
-- Stores scraped leads from Apollo
-- ============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apollo_search_id UUID REFERENCES apollo_searches(id) ON DELETE SET NULL,
    apollo_id VARCHAR(255) UNIQUE, -- Apollo's lead ID
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    title VARCHAR(255), -- Job title
    company_name VARCHAR(255),
    company_domain VARCHAR(255), -- Company website domain
    company_website VARCHAR(500), -- Full website URL
    company_linkedin_url VARCHAR(500),
    company_blog_url VARCHAR(500), -- Company blog URL
    company_angellist_url VARCHAR(500), -- Company AngelList URL
    company_employee_size INTEGER,
    company_country VARCHAR(100),
    company_industry VARCHAR(255),
    company_sic_code VARCHAR(50),
    linkedin_url VARCHAR(500),
    phone VARCHAR(50),
    location VARCHAR(255),
    formatted_address VARCHAR(500), -- Full formatted address
    is_c_suite BOOLEAN DEFAULT FALSE,
    apollo_data JSONB, -- Store full Apollo response for reference
    status VARCHAR(50) DEFAULT 'new', -- new, email_sent, replied, bounced, unsubscribed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. COMPANY WEBSITES TABLE
-- Cache scraped website content to avoid re-scraping
-- ============================================
CREATE TABLE company_websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_domain VARCHAR(255) UNIQUE NOT NULL,
    website_url VARCHAR(500),
    scraped_content TEXT, -- Full scraped HTML/text content
    extracted_info JSONB, -- Structured info (about, services, products, etc.)
    scraping_status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed, not_found
    scraping_error TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. EMAIL CAMPAIGNS TABLE
-- Track email campaign metadata
-- ============================================
CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
    total_leads INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. EMAIL QUEUE TABLE
-- Queue for emails to be sent (with scheduled time)
-- ============================================
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    email_to VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500),
    email_body TEXT NOT NULL,
    email_type VARCHAR(50) DEFAULT 'initial', -- initial, followup_5day, followup_10day
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL, -- When to send (business hours)
    timezone VARCHAR(100), -- Lead's timezone
    status VARCHAR(50) DEFAULT 'pending', -- pending, sending, sent, failed, cancelled
    priority INTEGER DEFAULT 0, -- Higher priority emails sent first
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. EMAILS SENT TABLE
-- Track all sent emails
-- ============================================
CREATE TABLE emails_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    email_to VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500),
    email_body TEXT NOT NULL,
    email_type VARCHAR(50), -- initial, followup_5day, followup_10day
    gmail_message_id VARCHAR(255), -- Gmail's message ID for tracking
    gmail_thread_id VARCHAR(255), -- Gmail's thread ID for reply detection
    is_personalized BOOLEAN DEFAULT FALSE, -- True if website was scraped and personalized
    company_website_used BOOLEAN DEFAULT FALSE, -- True if company website was used
    sent_at TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(100),
    status VARCHAR(50), -- 'SENT' when email is sent, NULL otherwise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. EMAIL REPLIES TABLE
-- Store detected email replies
-- ============================================
CREATE TABLE email_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_sent_id UUID REFERENCES emails_sent(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255) UNIQUE NOT NULL,
    gmail_thread_id VARCHAR(255),
    reply_from VARCHAR(255) NOT NULL,
    reply_subject VARCHAR(500),
    reply_body TEXT NOT NULL,
    reply_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_positive BOOLEAN, -- Manual classification (optional)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. FOLLOW-UPS TABLE
-- Track scheduled follow-up emails
-- ============================================
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_sent_id UUID REFERENCES emails_sent(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    followup_type VARCHAR(50) NOT NULL, -- 5day, 10day
    scheduled_date DATE NOT NULL, -- Date when follow-up should be sent
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, cancelled, replied
    email_queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Leads indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_company_domain ON leads(company_domain);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_apollo_search_id ON leads(apollo_search_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Email queue indexes
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled_time ON email_queue(scheduled_time);
CREATE INDEX idx_email_queue_status_scheduled ON email_queue(status, scheduled_time);
CREATE INDEX idx_email_queue_lead_id ON email_queue(lead_id);

-- Emails sent indexes
CREATE INDEX idx_emails_sent_lead_id ON emails_sent(lead_id);
CREATE INDEX idx_emails_sent_gmail_thread_id ON emails_sent(gmail_thread_id);
CREATE INDEX idx_emails_sent_sent_at ON emails_sent(sent_at);
CREATE INDEX idx_emails_sent_status ON emails_sent(status);

-- Email replies indexes
CREATE INDEX idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX idx_email_replies_email_sent_id ON email_replies(email_sent_id);
CREATE INDEX idx_email_replies_gmail_thread_id ON email_replies(gmail_thread_id);

-- Follow-ups indexes
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_scheduled_date ON follow_ups(scheduled_date);
CREATE INDEX idx_follow_ups_lead_id ON follow_ups(lead_id);

-- Company websites indexes
CREATE INDEX idx_company_websites_domain ON company_websites(company_domain);
CREATE INDEX idx_company_websites_status ON company_websites(scraping_status);

-- ============================================
-- TRIGGERS for updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apollo_searches_updated_at BEFORE UPDATE ON apollo_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_websites_updated_at BEFORE UPDATE ON company_websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- Enable if you need user-based access control
-- ============================================

-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE emails_sent ENABLE ROW LEVEL SECURITY;
-- Add policies as needed based on your auth requirements

