# Backend-Frontend Integration Analysis & Task List

## 📋 Executive Summary

**Current State:**
- **Backend**: FastAPI application with comprehensive API endpoints for lead scraping, email management, and website scraping
- **Frontend**: Next.js application that currently bypasses the backend and directly accesses Supabase database
- **Integration Gap**: Frontend is NOT using the backend API - needs complete integration

---

## 🔍 Detailed Analysis

### Backend Architecture

**Technology Stack:**
- FastAPI (Python)
- Supabase (PostgreSQL database)
- Apollo API (Lead scraping)
- OpenAI (Email personalization)
- Firecrawl (Website scraping)
- Gmail API (Email sending)

**API Endpoints Available:**
```
Base URL: http://localhost:8000 (development)

1. Lead Management:
   - POST /api/leads/scrape - Scrape leads from Apollo
   - POST /api/leads/send-emails - Send emails to selected leads
   - GET /api/leads/ - Get all leads (paginated)
   - GET /api/leads/{lead_id} - Get specific lead
   - GET /api/leads/send-status - Check email sending status

2. Email Management:
   - POST /api/emails/generate/{lead_id} - Generate personalized email
   - GET /api/emails/queue - Get queued emails
   - GET /api/emails/sent - Get sent emails
   - POST /api/emails/send/{lead_id} - Send email to lead
   - POST /api/emails/queue/process - Process email queue

3. Website Management:
   - POST /api/websites/scrape - Scrape company website
   - GET /api/websites/{company_domain} - Get cached website content

4. System:
   - GET /health - Health check
   - GET /api/system/status - System status

5. Auth:
   - GET /api/auth/gmail/authorize - Gmail OAuth
   - GET /api/auth/gmail/callback - OAuth callback
```

**Database Schema:**
- Main table: `scraped_data` (stores leads/founders)
- Other tables: `apollo_searches`, `company_websites`, `email_queue`, `emails_sent`, etc.

---

### Frontend Architecture

**Technology Stack:**
- Next.js 15.5.4
- React 19.1.0
- TypeScript
- Supabase Client (direct database access)
- Material-UI
- Recharts (analytics)

**Current Pages:**
1. **Dashboard (`/`)** - ProductForm for lead scraping configuration
2. **Database (`/database`)** - FoundersTable showing all leads
3. **Analytics (`/analytics`)** - EmailStatsDashboard with statistics
4. **Scrape Data (`/scrape-data`)** - Displays scraped data (currently broken)
5. **Import Data (`/import-data`)** - Import founders manually (currently disabled)

**Current Data Flow (PROBLEMATIC):**
```
Frontend → Supabase (Direct) ❌
Should be: Frontend → Backend API → Supabase ✅
```

**Key Issues Identified:**

1. **ProductForm.tsx** (Line 958):
   - Currently sends data to `NEXT_PUBLIC_N8N_WEBHOOK_URL` (n8n webhook)
   - Should call: `POST /api/leads/scrape`

2. **FoundersTable.tsx** (Lines 68-69, 486, 557):
   - Direct Supabase queries: `supabase.from('scraped_data').select('*')`
   - Should call: `GET /api/leads/`

3. **EmailStatsDashboard.tsx** (Lines 68, 147):
   - Direct Supabase queries for statistics
   - Should call: Backend endpoints or aggregate from `/api/leads/`

4. **No API Client Layer**:
   - Missing centralized API service/client
   - No error handling for API calls
   - No loading states management

5. **Environment Variables Missing**:
   - No `NEXT_PUBLIC_API_BASE_URL` configured
   - Frontend doesn't know where backend is running

---

## 🎯 Integration Requirements

### 1. API Client Service
Create a centralized API client to handle all backend communication:
- Base URL configuration
- Request/response interceptors
- Error handling
- TypeScript types for API responses

### 2. Replace Direct Supabase Calls
Replace all direct Supabase database calls with backend API calls:
- Lead fetching → `GET /api/leads/`
- Lead creation → `POST /api/leads/scrape`
- Email sending → `POST /api/leads/send-emails`
- Statistics → Aggregate from API or create new endpoint

### 3. Update ProductForm
- Replace n8n webhook call with `POST /api/leads/scrape`
- Map form data to backend API request format
- Handle API responses and errors

### 4. Update FoundersTable
- Replace Supabase queries with `GET /api/leads/`
- Update lead deletion to use backend API (if endpoint exists)
- Update email sending to use `POST /api/leads/send-emails`

### 5. Update EmailStatsDashboard
- Fetch data from backend API
- Consider creating `/api/analytics/stats` endpoint if needed

### 6. Environment Configuration
- Add `NEXT_PUBLIC_API_BASE_URL` to frontend `.env.local`
- Update CORS in backend to allow frontend origin

---

## 📝 Task List

### Phase 1: Setup & Configuration
- [ ] **Task 1.1**: Create API client service (`lib/apiClient.ts`)
  - Configure base URL from environment variable
  - Add request/response interceptors
  - Implement error handling
  - Add TypeScript types

- [ ] **Task 1.2**: Add environment variables
  - Create/update `.env.local` in frontend
  - Add `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
  - Document required variables

- [ ] **Task 1.3**: Update backend CORS
  - Configure allowed origins in `app/main.py`
  - Add frontend URL to allowed origins

### Phase 2: API Integration - Lead Management
- [ ] **Task 2.1**: Create API service for leads (`lib/api/leads.ts`)
  - `getLeads(skip, limit)` → `GET /api/leads/`
  - `getLead(leadId)` → `GET /api/leads/{lead_id}`
  - `scrapeLeads(payload)` → `POST /api/leads/scrape`
  - `sendEmails(leadIds)` → `POST /api/leads/send-emails`
  - `getSendStatus()` → `GET /api/leads/send-status`

- [ ] **Task 2.2**: Update ProductForm to use backend API
  - Replace n8n webhook call with `scrapeLeads()`
  - Map form data to API request format:
    ```typescript
    {
      employee_size_min?: number,
      employee_size_max?: number,
      countries: string[],
      sic_codes: string[],
      c_suites?: string[],
      industry?: string,
      total_leads_wanted: number,
      source: "apollo"
    }
    ```
  - Handle API responses (success/error)
  - Update progress notifications

- [ ] **Task 2.3**: Update FoundersTable to use backend API
  - Replace `supabase.from('scraped_data')` with `getLeads()`
  - Update pagination to use API pagination
  - Handle API errors gracefully
  - Update refresh functionality

### Phase 3: API Integration - Email Management
- [ ] **Task 3.1**: Create API service for emails (`lib/api/emails.ts`)
  - `generateEmail(leadId, emailType)` → `POST /api/emails/generate/{lead_id}`
  - `sendEmail(leadId, emailType)` → `POST /api/emails/send/{lead_id}`
  - `getEmailQueue()` → `GET /api/emails/queue`
  - `getSentEmails(skip, limit)` → `GET /api/emails/sent`

- [ ] **Task 3.2**: Update FoundersTable email sending
  - Replace current email sending logic with `sendEmails()`
  - Update verification flow to work with backend
  - Handle email sending status from API

- [ ] **Task 3.3**: Update EmailStatsDashboard
  - Fetch data from backend API instead of Supabase
  - Consider creating analytics endpoint if needed
  - Update statistics calculations

### Phase 4: Data Mapping & Type Safety
- [ ] **Task 4.1**: Create TypeScript interfaces
  - Define `Lead` interface matching backend model
  - Define API request/response types
  - Map frontend field names to backend field names

- [ ] **Task 4.2**: Field name mapping
  - Frontend uses: `'Founder Name'`, `'Company Name'`, etc.
  - Backend uses: `founder_name`, `company_name`, etc.
  - Create mapping functions for conversion

- [ ] **Task 4.3**: Update all components
  - Replace frontend field names with backend field names
  - Or create adapter functions to convert between formats

### Phase 5: Error Handling & UX
- [ ] **Task 5.1**: Implement error handling
  - API error responses
  - Network errors
  - Validation errors
  - User-friendly error messages

- [ ] **Task 5.2**: Loading states
  - Add loading indicators for API calls
  - Disable buttons during operations
  - Show progress for long-running operations

- [ ] **Task 5.3**: Success feedback
  - Success notifications
  - Update UI after successful operations
  - Refresh data after mutations

### Phase 6: Testing & Validation
- [ ] **Task 6.1**: Test lead scraping flow
  - ProductForm → Backend API → Database
  - Verify data appears in FoundersTable

- [ ] **Task 6.2**: Test email sending flow
  - Select leads → Send emails → Verify status
  - Check email queue and sent emails

- [ ] **Task 6.3**: Test error scenarios
  - Invalid API requests
  - Network failures
  - Backend errors

- [ ] **Task 6.4**: Verify data consistency
  - Frontend displays match backend data
  - Field mappings are correct
  - Pagination works correctly

---

## 🔧 Technical Implementation Details

### API Request/Response Formats

**Scrape Leads Request:**
```typescript
POST /api/leads/scrape
{
  "employee_size_min": 10,
  "employee_size_max": 1000,
  "countries": ["United States", "Germany"],
  "sic_codes": ["2879"],
  "c_suites": ["CEO", "CFO"],
  "industry": "Agrochemical",
  "total_leads_wanted": 625,
  "source": "apollo"
}

Response:
{
  "success": true,
  "total_leads_found": 625
}
```

**Get Leads Request:**
```typescript
GET /api/leads/?skip=0&limit=50

Response:
[
  {
    "id": "uuid",
    "founder_name": "John Doe",
    "company_name": "Acme Corp",
    "founder_email": "john@acme.com",
    "mail_status": "new",
    ...
  }
]
```

**Send Emails Request:**
```typescript
POST /api/leads/send-emails
{
  "lead_ids": ["uuid1", "uuid2", ...]
}

Response:
{
  "success": true,
  "message": "Started processing 10 leads",
  "count": 10
}
```

### Field Name Mapping

| Frontend Field | Backend Field | Notes |
|---------------|---------------|-------|
| `'Founder Name'` | `founder_name` | |
| `'Company Name'` | `company_name` | |
| `'Position'` | `position` | |
| `'Founder Email'` | `founder_email` | |
| `'Founder Linkedin'` | `founder_linkedin` | |
| `'Founder Address'` | `founder_address` | |
| `"Company's Industry"` | `company_industry` | |
| `'Company Website'` | `company_website` | |
| `'Company Linkedin'` | `company_linkedin` | |
| `'Company Phone'` | `company_phone` | |
| `'Verification'` | `is_verified` | Boolean |
| `'Mail Status'` | `mail_status` | |
| `'Mail Replys'` | `mail_replies` | |
| `'5 Min Sent'` | `followup_5_sent` | Boolean |
| `'10 Min Sent'` | `followup_10_sent` | Boolean |
| `'Priority based on Reply'` | `reply_priority` | |

---

## ⚠️ Critical Considerations

1. **Backend API Limits:**
   - Email sending limited to 10 leads per request (safety check)
   - Daily email quota enforcement
   - Rate limiting on Apollo API calls

2. **Data Consistency:**
   - Frontend must use backend field names
   - Or implement adapter layer for conversion
   - Ensure all field mappings are correct

3. **Error Handling:**
   - Backend returns structured error responses
   - Frontend must handle and display appropriately
   - Network errors vs API errors

4. **Authentication:**
   - Currently no authentication in backend
   - May need to add auth tokens later
   - CORS must be configured correctly

5. **Real-time Updates:**
   - Consider WebSocket or polling for status updates
   - Email sending is async (background task)
   - Need to poll for completion status

---

## 📊 Success Criteria

✅ Frontend successfully calls backend API for all operations
✅ No direct Supabase calls from frontend components
✅ Data flows: Frontend → Backend → Database
✅ All field mappings are correct
✅ Error handling works properly
✅ Loading states and user feedback implemented
✅ All existing functionality preserved
✅ Type safety maintained with TypeScript

---

## 🚀 Next Steps

1. Review this analysis
2. Confirm approach and priorities
3. Start with Phase 1 (Setup & Configuration)
4. Proceed through phases sequentially
5. Test after each phase
6. Document any deviations or issues

---

**Prepared by:** AI Assistant
**Date:** 2025-01-27
**Status:** Ready for Review & Confirmation

