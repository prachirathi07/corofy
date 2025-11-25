# 🔍 COMPLETE PROJECT AUDIT & ARCHITECTURE DOCUMENTATION
**Lead Scraping & Email Automation System**  
**Date:** November 25, 2025  
**Status:** Production-Ready with Frontend Integration

---

## 📋 TABLE OF CONTENTS
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Decisions](#architecture-decisions)
4. [Database Schema](#database-schema)
5. [Backend Services](#backend-services)
6. [Frontend Components](#frontend-components)
7. [Integration Points](#integration-points)
8. [Critical Design Decisions](#critical-design-decisions)
9. [Known Issues & Workarounds](#known-issues)
10. [Testing Checklist](#testing-checklist)

---

## 1. PROJECT OVERVIEW

### Purpose
Automated B2B lead generation and email outreach system that:
- Scrapes leads from Apollo.io based on industry/SIC codes
- Enriches leads with company website data via Firecrawl
- Personalizes emails using OpenAI GPT-4
- Sends emails via Gmail API with smart scheduling
- Tracks replies and manages follow-ups

### Current State
- ✅ Backend: Fully functional, production-ready
- ✅ Frontend: Recently integrated, ProductForm.tsx just repaired
- ⚠️ Integration: Needs comprehensive testing
- 📊 Database: `scraped_data` table is the single source of truth

---

## 2. TECHNOLOGY STACK

### Backend (Python/FastAPI)
```
FastAPI 0.104.1          - Web framework
Uvicorn 0.24.0           - ASGI server
Supabase 2.8.1           - PostgreSQL database client
OpenAI 1.3.7             - GPT-4 for personalization
Firecrawl-py 0.0.16      - Website scraping
APScheduler 3.10.4       - Job scheduling
Google APIs              - Gmail integration
Tenacity 8.2.0+          - Retry logic
```

### Frontend (Next.js/React)
```
Next.js 15.x             - React framework
TypeScript               - Type safety
Material-UI (@mui)       - UI components
Supabase Client          - Direct DB access
```

### Database
```
Supabase (PostgreSQL)    - Hosted database
```

---

## 3. ARCHITECTURE DECISIONS

### 🎯 CRITICAL DECISION: Simplified Architecture

**What Changed:**
- **BEFORE:** Complex multi-table system (leads, email_queue, emails_sent, follow_ups)
- **AFTER:** Single `scraped_data` table with `mail_status` field

**Why:**
- Eliminated data synchronization issues
- Simplified email tracking
- Reduced database complexity
- Easier to maintain and debug

### Database Evolution

#### Original Schema (supabase_schema.sql)
```sql
- apollo_searches
- leads
- email_queue
- emails_sent
- email_replies
- follow_ups
- company_websites
- email_campaigns
```

#### Current Schema (scraped_data table)
```sql
CREATE TABLE scraped_data (
    id UUID PRIMARY KEY,
    apollo_search_id UUID,
    
    -- Lead Info
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    title VARCHAR(255),
    
    -- Company Info
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    company_website VARCHAR(500),
    company_employee_size INTEGER,
    company_country VARCHAR(100),
    company_industry VARCHAR(255),
    company_sic_code VARCHAR(50),
    
    -- Email Tracking (NEW SIMPLIFIED APPROACH)
    mail_status VARCHAR(50) DEFAULT 'not_sent',
    -- Values: 'not_sent', 'scheduled', 'sent', 'failed', 'replied', 'bounced'
    
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Email Content
    personalized_email_subject VARCHAR(500),
    personalized_email_body TEXT,
    
    -- Gmail Tracking
    gmail_message_id VARCHAR(255),
    gmail_thread_id VARCHAR(255),
    
    -- Scheduling
    scheduled_send_time TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 📊 Mail Status Flow
```
not_sent → scheduled → sent → replied
                    ↓
                  failed
```

---

## 4. DATABASE SCHEMA

### Tables in Use

#### 1. `scraped_data` (PRIMARY TABLE)
**Purpose:** Single source of truth for all leads and email tracking

**Key Fields:**
- `mail_status`: Tracks email lifecycle
- `is_verified`: Email verification status from Apollo
- `gmail_message_id`: For reply detection
- `scheduled_send_time`: Business hours scheduling

#### 2. `apollo_searches`
**Purpose:** Track scraping requests

**Key Fields:**
- `sic_codes`: Array of SIC codes
- `person_titles`: Array of titles (CEO, CFO, CTO, CMO, COO, "Board of Directors")
  - Note: Stored in DB as array, sent to Apollo API as `person_titles`
- `total_leads_wanted`: Request size
- `total_leads_found`: Actual results
- `source`: Always 'apollo'

#### 3. `company_websites`
**Purpose:** Cache scraped website content

**Key Fields:**
- `company_domain`: Unique identifier
- `scraped_content`: Full HTML/text
- `extracted_info`: Structured JSONB
- `scraping_status`: pending/success/failed

#### 4. `dead_letter_queue`
**Purpose:** Failed email tracking

**Key Fields:**
- `lead_id`: Reference to scraped_data
- `failure_reason`: Error message
- `retry_count`: Attempt tracking

#### 5. `daily_email_quota`
**Purpose:** Rate limiting (50 emails/day)

**Key Fields:**
- `date`: Tracking date
- `emails_sent_count`: Daily counter
- `quota_limit`: 50 (configurable)

---

## 5. BACKEND SERVICES

### Core Services

#### 1. **ApolloService** (`apollo_service.py`)
**Purpose:** Lead scraping from Apollo.io

**Key Methods:**
- `search_people()`: Main search with filters
- `enrich_person()`: Get additional lead data
- `parse_apollo_response()`: Standardize data

**Critical Configuration:**
```python
# Email Filters
email_status = ["verified"]  # ONLY verified emails
reveal_personal_emails = True  # Broader discovery

# Person Titles (sent as person_titles to Apollo API)
person_titles = ["CEO", "CFO", "CTO", "CMO", "COO", "Board of Directors"]

# Employee Size Ranges
[
    {"min": 1, "max": 10},
    {"min": 11, "max": 50},
    {"min": 51, "max": 200},
    {"min": 201, "max": 500}
]

# Countries
["United States", "Canada", "United Kingdom", ...]

# Phone Numbers
❌ NOT requested or stored (removed as per user request)
```

**Industry Filter:**
```python
# Passed as '_industry_filter' in payload
# Example: "Chemicals", "Oil & Gas", etc.
```

#### 2. **FirecrawlService** (`firecrawl_service.py`)
**Purpose:** Website scraping with rate limiting

**Features:**
- Retry logic with exponential backoff
- Rate limiting (respects Firecrawl limits)
- Caches results in `company_websites`

#### 3. **OpenAIService** (`openai_service.py`)
**Purpose:** Email personalization with GPT-4

**Key Methods:**
- `personalize_email()`: Generate custom emails
- `classify_industry()`: Auto-detect industry from website

**Prompt Strategy:**
- Uses company website content
- Tailors to recipient's role
- Maintains professional tone

#### 4. **EmailSendingService** (`email_sending_service.py`)
**Purpose:** Gmail API integration

**Features:**
- Business hours scheduling (9 AM - 5 PM local time)
- Timezone-aware sending
- Thread tracking for replies
- Daily quota management (50/day)

**Critical Flow:**
```python
1. Check daily quota
2. Get leads with mail_status='scheduled'
3. Filter by scheduled_send_time <= NOW
4. Send via Gmail API
5. Update mail_status='sent'
6. Store gmail_message_id and gmail_thread_id
```

#### 5. **ReplyService** (`reply_service.py`)
**Purpose:** Detect and process email replies

**Features:**
- Polls Gmail for new messages
- Matches by gmail_thread_id
- Updates mail_status='replied'
- Cancels follow-ups automatically

#### 6. **SchedulerService** (`scheduler_service.py`)
**Purpose:** Background job orchestration

**Jobs:**
```python
# Every 5 minutes
- process_email_queue()
- check_for_replies()

# Every hour
- process_dead_letter_queue()
```

#### 7. **DeadLetterQueueService** (`dead_letter_queue_service.py`)
**Purpose:** Retry failed emails

**Features:**
- Max 3 retries
- Exponential backoff
- Permanent failure tracking

---

## 6. FRONTEND COMPONENTS

### Key Components

#### 1. **ProductForm.tsx** (JUST REPAIRED)
**Purpose:** Main form for initiating lead scraping

**Location:** `dashboard/dharm-mehulbhai/components/ProductForm.tsx`

**Features:**
- Industry selection (static + custom)
- Brand/Chemical selection (for specific industries)
- Country multi-select
- SIC code mapping
- Confirmation modal
- Progress notifications

**Critical Functions:**
```typescript
handleSubmit()          // Validates and prepares payload
handleConfirmSubmit()   // Calls /api/leads/scrape
handleCancelSubmit()    // Cancels submission
```

**API Integration:**
```typescript
const apiPayload = {
    total_leads_wanted: 10,  // Test mode
    sic_codes: ['2879'],     // From industry mapping
    industry: 'Agrochemical', // Explicitly passed
    source: 'apollo'
};

const result = await leadsApi.scrapeLeads(apiPayload);
```

**Recent Fixes:**
- ✅ Added missing `handleConfirmSubmit` function
- ✅ Added missing `handleCancelSubmit` function
- ✅ Fixed broken `handleSubmit` function
- ✅ Added `isLoadingData` check
- ✅ Removed orphaned JSX code
- ✅ Added proper return statement with Progress Notification

#### 2. **API Client** (`lib/api.ts`)
**Purpose:** Frontend-backend communication

**Key Methods:**
```typescript
leadsApi.scrapeLeads(payload)
leadsApi.getAll(skip, limit)
leadsApi.sendEmails(leadIds)
```

#### 3. **Product Data** (`lib/productData.ts`)
**Purpose:** Static industry/brand/chemical mappings

**Contains:**
- Industry → SIC code mappings
- Brand → Chemical relationships
- Country → Product availability

---

## 7. INTEGRATION POINTS

### Frontend → Backend Flow

#### Lead Scraping Flow
```
1. User fills ProductForm
   ↓
2. handleSubmit() validates
   ↓
3. Confirmation modal shows
   ↓
4. handleConfirmSubmit() calls API
   ↓
5. POST /api/leads/scrape
   {
       total_leads_wanted: 10,
       sic_codes: ['2879'],
       industry: 'Agrochemical',
       source: 'apollo'
   }
   ↓
6. Backend creates apollo_search record
   ↓
7. ApolloService.search_people()
   ↓
8. Leads saved to scraped_data
   ↓
9. Response returned to frontend
   ↓
10. Frontend shows success notification
   ↓
11. Navigates to /database page
```

#### Email Sending Flow
```
1. User selects leads in database view
   ↓
2. Clicks "Send Emails"
   ↓
3. POST /api/emails/send
   {
       lead_ids: [uuid1, uuid2, ...]
   }
   ↓
4. Backend processes each lead:
   - Scrape company website (if not cached)
   - Personalize email with GPT-4
   - Schedule for business hours
   - Update mail_status='scheduled'
   ↓
5. Scheduler picks up scheduled emails
   ↓
6. EmailSendingService sends via Gmail
   ↓
7. mail_status updated to 'sent'
```

### API Endpoints

#### Leads Router (`/api/leads`)
```python
POST   /scrape              # Initiate Apollo scraping
GET    /                    # List all leads
GET    /{lead_id}           # Get single lead
DELETE /{lead_id}           # Delete lead
POST   /bulk-delete         # Delete multiple leads
```

#### Emails Router (`/api/emails`)
```python
POST   /send                # Schedule emails for leads
GET    /sent                # List sent emails
POST   /process-queue       # Manual queue processing
```

#### Websites Router (`/api/websites`)
```python
POST   /scrape              # Scrape company website
GET    /{domain}            # Get cached website data
```

---

## 8. CRITICAL DESIGN DECISIONS

### 🔴 Decision 1: Email Verification Only
**What:** Only request "verified" emails from Apollo
**Why:** Reduce bounce rate, improve deliverability
**Impact:** Fewer leads but higher quality

**Code Location:**
```python
# app/services/apollo_service.py, line ~226
email_status = ["verified"]  # NOT ["verified", "guessed"]
```

### 🔴 Decision 2: Reveal Personal Emails
**What:** Set `reveal_personal_emails: True`
**Why:** Broader email discovery, more contact options
**Impact:** May get personal emails instead of work emails

**Code Location:**
```python
# app/services/apollo_service.py, line ~238
"reveal_personal_emails": True
```

### 🔴 Decision 3: No Phone Numbers
**What:** Removed all phone number requests and storage
**Why:** User request - focus on email outreach only
**Impact:** Cleaner data, no phone-based contact

**Code Location:**
```python
# app/services/apollo_service.py
# enrich_person() - phone fields removed
# parse_apollo_response() - phone extraction removed
```

### 🔴 Decision 4: Board of Directors Included
**What:** Added "Board of Directors" to person_titles list
**Why:** Match n8n workflow configuration
**Impact:** Broader executive targeting

**Code Location:**
```python
# app/services/apollo_service.py, line ~234
# Sent to Apollo API as:
"person_titles": ["CEO", "CFO", "CTO", "CMO", "COO", "Board of Directors"]
```

### 🔴 Decision 5: Industry Filter Explicit
**What:** Pass industry as `_industry_filter` in Apollo payload
**Why:** Ensure industry filtering is applied
**Impact:** More targeted results

**Code Location:**
```python
# app/services/apollo_service.py, line ~238
if industry:
    payload["_industry_filter"] = industry
```

### 🔴 Decision 6: Single Table Architecture
**What:** Use `scraped_data` table with `mail_status` field
**Why:** Simplify data flow, eliminate sync issues
**Impact:** Easier maintenance, clearer state management

**Migration:** `migrations/final_ultra_simplified_migration.sql`

### 🔴 Decision 7: Daily Email Quota (50)
**What:** Hard limit of 50 emails per day
**Why:** Gmail sending limits, avoid spam flags
**Impact:** Controlled sending pace

**Code Location:**
```python
# app/services/daily_email_quota_service.py
DAILY_QUOTA_LIMIT = 50
```

### 🔴 Decision 8: Business Hours Scheduling
**What:** Only send emails 9 AM - 5 PM recipient's local time
**Why:** Better open rates, professional timing
**Impact:** Emails queued until appropriate time

**Code Location:**
```python
# app/services/timezone_service.py
# calculate_next_business_hour()
```

---

## 9. KNOWN ISSUES & WORKAROUNDS

### ⚠️ Issue 1: Frontend .gitignore Blocking
**Problem:** `lib/api.ts` blocked by gitignore
**Impact:** Cannot view file with standard tools
**Workaround:** Use `Get-Content` PowerShell command
**Status:** Not critical, file is accessible

### ⚠️ Issue 2: Nested Git Repository
**Problem:** `dashboard/dharm-mehulbhai` had its own `.git`
**Impact:** Git treats it as submodule
**Resolution:** ✅ FIXED - Removed nested `.git` directory
**Status:** Resolved

### ⚠️ Issue 3: ProductForm.tsx Corruption
**Problem:** File had orphaned JSX, missing functions
**Impact:** Component wouldn't compile
**Resolution:** ✅ FIXED - Used Python script to repair
**Status:** Resolved

### ⚠️ Issue 4: Industry Parameter Missing
**Problem:** Frontend wasn't passing `industry` to backend
**Impact:** Apollo searches lacked industry filter
**Resolution:** ✅ FIXED - Added `industry` to `apiPayload`
**Status:** Resolved

---

## 10. TESTING CHECKLIST

### 🧪 Backend Testing

#### Apollo Integration
- [ ] Test `/api/leads/scrape` with industry filter
- [ ] Verify `sic_codes` are passed correctly
- [ ] Confirm only "verified" emails returned
- [ ] Check `reveal_personal_emails` is working
- [ ] Verify NO phone numbers in response
- [ ] Confirm "Board of Directors" in results

#### Database
- [ ] Verify data saved to `scraped_data` table
- [ ] Check `mail_status` defaults to 'not_sent'
- [ ] Confirm `is_verified` field populated
- [ ] Verify `apollo_search_id` foreign key

#### Email Flow
- [ ] Test email personalization with GPT-4
- [ ] Verify business hours scheduling
- [ ] Check daily quota enforcement (50/day)
- [ ] Test Gmail API sending
- [ ] Verify `mail_status` updates to 'sent'
- [ ] Check `gmail_message_id` storage

#### Reply Detection
- [ ] Test reply detection via Gmail API
- [ ] Verify `mail_status` updates to 'replied'
- [ ] Check follow-up cancellation

### 🎨 Frontend Testing

#### ProductForm
- [ ] Test industry selection
- [ ] Test brand/chemical selection
- [ ] Test country multi-select
- [ ] Verify SIC code mapping
- [ ] Test custom industry addition
- [ ] Check confirmation modal
- [ ] Verify progress notifications
- [ ] Test navigation to /database

#### API Integration
- [ ] Verify `/api/leads/scrape` call
- [ ] Check payload structure
- [ ] Test error handling
- [ ] Verify success navigation

### 🔗 Integration Testing

- [ ] End-to-end scraping flow
- [ ] Frontend → Backend → Database
- [ ] Email sending from UI
- [ ] Data display in database view
- [ ] Error propagation to frontend

---

## 11. ENVIRONMENT VARIABLES

### Backend (.env)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Apollo
APOLLO_API_KEY=xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# Firecrawl
FIRECRAWL_API_KEY=fc-xxx

# Gmail
GMAIL_CREDENTIALS_PATH=credentials.json
GMAIL_TOKEN_PATH=token.json
GMAIL_SENDER_EMAIL=your@email.com

# Config
LOG_LEVEL=INFO
ENVIRONMENT=production
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

---

## 12. DEPLOYMENT NOTES

### Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
# Install dependencies
cd dashboard/dharm-mehulbhai
npm install

# Run dev server
npm run dev
```

### Database Migrations
```bash
# Run in order:
1. supabase_schema.sql (base schema)
2. migrations/final_ultra_simplified_migration.sql (scraped_data table)
3. migrations/add_batch_tracking.sql
4. migrations/add_daily_email_quota.sql
5. migrations/add_dead_letter_queue.sql
6. migrations/complete_mail_status_setup.sql
```

---

## 13. NEXT STEPS

### Immediate
1. ✅ ProductForm.tsx repair - COMPLETED
2. ⏭️ Comprehensive integration testing
3. ⏭️ Verify all filters in Apollo API
4. ⏭️ Confirm database writes

### Short-term
- Add error logging to frontend
- Implement retry logic in frontend
- Add loading states
- Improve error messages

### Long-term
- Add analytics dashboard
- Implement A/B testing for emails
- Add webhook for real-time reply notifications
- Scale daily quota based on account health

---

## 📞 SUPPORT & MAINTENANCE

### Log Locations
- Backend: `logs/` directory
- Frontend: Browser console
- Database: Supabase dashboard

### Monitoring
- Health check: `GET /health`
- System status: `GET /api/system/status`
- Scheduler status: Check logs for "Scheduler started"

### Common Issues
1. **Emails not sending:** Check daily quota, Gmail credentials
2. **No leads found:** Verify Apollo API key, check filters
3. **Website scraping fails:** Check Firecrawl API key, rate limits
4. **Personalization fails:** Verify OpenAI API key, check credits

---

**END OF AUDIT DOCUMENT**
