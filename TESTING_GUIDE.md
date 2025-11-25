# 🧪 INTEGRATION TESTING GUIDE
**Quick Reference for Testing Frontend-Backend Integration**

---

## 🎯 TESTING PRIORITIES

### 1. CRITICAL PATH (Must Test First)
```
ProductForm → /api/leads/scrape → scraped_data table
```

### 2. VERIFICATION POINTS
- ✅ Industry parameter passed correctly
- ✅ SIC codes mapped and sent
- ✅ Only verified emails returned
- ✅ Data saved to scraped_data
- ✅ mail_status defaults to 'not_sent'
- ✅ is_verified field populated

---

## 📝 TEST SCENARIOS

### Scenario 1: Basic Lead Scraping
**Goal:** Verify end-to-end scraping flow

**Steps:**
1. Open frontend: `http://localhost:3000`
2. Navigate to ProductForm
3. Select:
   - Industry: "Agrochemical"
   - Countries: "United States"
4. Click Submit
5. Confirm in modal
6. Wait for progress notification

**Expected Results:**
```
✓ Progress notification shows "Initiating lead scraping..."
✓ Success message: "Lead scraping initiated! Found X leads..."
✓ Navigates to /database page
✓ Leads visible in database view
```

**Backend Verification:**
```bash
# Check logs
tail -f logs/app.log

# Should see:
# - "Calling Apollo API with filters..."
# - "Found X leads from Apollo"
# - "Saved X leads to scraped_data"
```

**Database Verification:**
```sql
-- Check scraped_data table
SELECT 
    id,
    first_name,
    last_name,
    email,
    company_name,
    company_industry,
    company_sic_code,
    mail_status,
    is_verified,
    created_at
FROM scraped_data
ORDER BY created_at DESC
LIMIT 10;

-- Expected:
-- mail_status = 'not_sent'
-- is_verified = true
-- company_sic_code = '2879' (for Agrochemical)
```

---

### Scenario 2: Verify Apollo Filters
**Goal:** Confirm all filters are applied correctly

**Test API Directly:**
```bash
curl -X POST http://localhost:8000/api/leads/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "total_leads_wanted": 5,
    "sic_codes": ["2879"],
    "industry": "Agrochemical",
    "source": "apollo"
  }'
```

**Check Backend Logs:**
```python
# Should log the Apollo API payload:
{
    "email_status": ["verified"],  # ✓ ONLY verified
    "reveal_personal_emails": True,  # ✓ Enabled
    "c_suites": ["CEO", "CFO", "CTO", "CMO", "COO", "Board of Directors"],
    "_industry_filter": "Agrochemical",  # ✓ Industry passed
    "organization_sic_codes": ["2879"],  # ✓ SIC codes passed
    "person_locations": ["United States"],
    # NO phone number fields ✓
}
```

**Verify Response:**
```json
{
    "success": true,
    "data": {
        "search_id": "uuid-here",
        "total_leads_found": 5,
        "leads_saved": 5
    }
}
```

---

### Scenario 3: Email Sending Flow
**Goal:** Test email personalization and scheduling

**Steps:**
1. Navigate to /database
2. Select 1-2 leads
3. Click "Send Emails"
4. Wait for processing

**Expected Backend Flow:**
```
1. POST /api/emails/send
   ↓
2. For each lead:
   - Check company_websites cache
   - Scrape if not cached (Firecrawl)
   - Personalize with GPT-4
   - Calculate business hours
   ↓
3. UPDATE scraped_data
   - mail_status = 'scheduled'
   - personalized_email_subject = "..."
   - personalized_email_body = "..."
   - scheduled_send_time = "2025-11-25 09:00:00-05:00"
```

**Database Verification:**
```sql
SELECT 
    id,
    email,
    mail_status,
    personalized_email_subject,
    scheduled_send_time,
    sent_at
FROM scraped_data
WHERE mail_status IN ('scheduled', 'sent')
ORDER BY scheduled_send_time;
```

---

### Scenario 4: Scheduler Processing
**Goal:** Verify background jobs are running

**Check Scheduler Status:**
```bash
curl http://localhost:8000/health

# Expected response:
{
    "status": "healthy",
    "services": {
        "scheduler": {
            "status": "running",
            "message": "Active"
        }
    }
}
```

**Monitor Scheduler Logs:**
```bash
tail -f logs/app.log | grep -i scheduler

# Should see every 5 minutes:
# - "Processing email queue..."
# - "Checking for email replies..."
```

**Test Email Queue Processing:**
```sql
-- Manually set a lead to be sent NOW
UPDATE scraped_data
SET 
    mail_status = 'scheduled',
    scheduled_send_time = NOW() - INTERVAL '1 minute'
WHERE id = 'some-lead-id';

-- Wait 5 minutes for scheduler
-- Then check:
SELECT mail_status, sent_at, gmail_message_id
FROM scraped_data
WHERE id = 'some-lead-id';

-- Expected:
-- mail_status = 'sent'
-- sent_at = <timestamp>
-- gmail_message_id = <gmail-id>
```

---

## 🔍 DEBUGGING CHECKLIST

### Frontend Issues

#### Problem: Form doesn't submit
**Check:**
- [ ] Browser console for errors
- [ ] Network tab for failed requests
- [ ] ProductForm validation logic

**Common Causes:**
- Missing industry or countries
- API client not imported correctly
- CORS issues

#### Problem: Progress notification doesn't show
**Check:**
- [ ] `showProgressNotification` state
- [ ] `progressMessage` and `progressType` states
- [ ] Return statement includes notification component

**Fix:**
```typescript
// Ensure these are in handleConfirmSubmit:
setShowProgressNotification(true);
setProgressMessage('Initiating lead scraping...');
setProgressType('loading');
```

#### Problem: Navigation doesn't work
**Check:**
- [ ] `router.push('/database')` is called
- [ ] Success response received
- [ ] No errors in catch block

---

### Backend Issues

#### Problem: No leads returned from Apollo
**Check:**
- [ ] Apollo API key is valid
- [ ] Filters are too restrictive
- [ ] SIC codes are correct
- [ ] Industry exists in Apollo

**Debug:**
```python
# Add logging in apollo_service.py
logger.info(f"Apollo API payload: {payload}")
logger.info(f"Apollo API response: {response.json()}")
```

#### Problem: Emails not sending
**Check:**
- [ ] Gmail credentials are valid
- [ ] Daily quota not exceeded
- [ ] Scheduled time is in the past
- [ ] mail_status is 'scheduled'

**Verify:**
```sql
-- Check daily quota
SELECT * FROM daily_email_quota
WHERE date = CURRENT_DATE;

-- Check scheduled emails
SELECT COUNT(*) FROM scraped_data
WHERE mail_status = 'scheduled'
AND scheduled_send_time <= NOW();
```

#### Problem: Website scraping fails
**Check:**
- [ ] Firecrawl API key is valid
- [ ] Rate limits not exceeded
- [ ] Website is accessible
- [ ] Domain is correct

**Test Manually:**
```bash
curl -X POST http://localhost:8000/api/websites/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "company_website": "https://example.com",
    "company_domain": "example.com"
  }'
```

---

### Database Issues

#### Problem: Data not saving
**Check:**
- [ ] Supabase connection is active
- [ ] Table exists
- [ ] Permissions are correct
- [ ] Foreign key constraints

**Test Connection:**
```python
# In Python shell
from app.core.database import get_db
db = get_db()
result = db.table("scraped_data").select("id").limit(1).execute()
print(result.data)
```

#### Problem: mail_status not updating
**Check:**
- [ ] UPDATE queries are executing
- [ ] No transaction conflicts
- [ ] Triggers are not interfering

**Debug:**
```sql
-- Check recent updates
SELECT 
    id,
    email,
    mail_status,
    updated_at
FROM scraped_data
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 📊 MONITORING COMMANDS

### Check System Health
```bash
# Overall health
curl http://localhost:8000/health

# System status
curl http://localhost:8000/api/system/status
```

### View Recent Logs
```bash
# All logs
tail -f logs/app.log

# Errors only
tail -f logs/app.log | grep ERROR

# Specific service
tail -f logs/app.log | grep ApolloService
```

### Database Queries
```sql
-- Lead count by status
SELECT mail_status, COUNT(*) as count
FROM scraped_data
GROUP BY mail_status;

-- Recent scraping activity
SELECT 
    id,
    total_leads_found,
    total_leads_wanted,
    status,
    created_at
FROM apollo_searches
ORDER BY created_at DESC
LIMIT 10;

-- Email sending stats
SELECT 
    DATE(sent_at) as date,
    COUNT(*) as emails_sent
FROM scraped_data
WHERE mail_status = 'sent'
GROUP BY DATE(sent_at)
ORDER BY date DESC;
```

---

## ✅ INTEGRATION TEST CHECKLIST

### Pre-Test Setup
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Database accessible
- [ ] All API keys configured
- [ ] Scheduler is running

### Frontend Tests
- [ ] ProductForm loads without errors
- [ ] Industry dropdown populated
- [ ] Country multi-select works
- [ ] Custom industry can be added
- [ ] SIC codes are mapped correctly
- [ ] Confirmation modal appears
- [ ] Progress notifications display
- [ ] Navigation to /database works

### Backend Tests
- [ ] /api/leads/scrape accepts requests
- [ ] Apollo API is called with correct filters
- [ ] Data is saved to scraped_data
- [ ] mail_status defaults to 'not_sent'
- [ ] is_verified field is populated
- [ ] Response includes search_id

### Email Flow Tests
- [ ] /api/emails/send processes leads
- [ ] Websites are scraped (or cached)
- [ ] Emails are personalized
- [ ] Business hours calculated correctly
- [ ] mail_status updated to 'scheduled'
- [ ] Scheduler sends emails
- [ ] mail_status updated to 'sent'
- [ ] Gmail IDs stored

### Reply Detection Tests
- [ ] Replies are detected
- [ ] mail_status updated to 'replied'
- [ ] Thread matching works
- [ ] Follow-ups are cancelled

---

## 🚨 COMMON ERRORS & SOLUTIONS

### Error: "CORS policy blocked"
**Solution:**
```python
# In app/main.py, ensure:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Error: "Apollo API 400 Bad Request"
**Solution:**
- Check API key
- Verify payload structure
- Ensure filters are valid
- Check Apollo API docs

### Error: "Daily quota exceeded"
**Solution:**
```sql
-- Reset quota for testing
DELETE FROM daily_email_quota
WHERE date = CURRENT_DATE;
```

### Error: "Gmail authentication failed"
**Solution:**
- Re-run OAuth flow
- Check credentials.json
- Verify token.json
- Check Gmail API is enabled

---

## 📞 SUPPORT RESOURCES

### Logs
- Backend: `logs/app.log`
- Frontend: Browser DevTools Console
- Database: Supabase Dashboard Logs

### API Documentation
- Backend: `http://localhost:8000/docs` (Swagger UI)
- Apollo: https://apolloio.github.io/apollo-api-docs/
- Firecrawl: https://docs.firecrawl.dev/
- OpenAI: https://platform.openai.com/docs/

### Database
- Supabase Dashboard: https://app.supabase.com/
- Direct SQL: Use Supabase SQL Editor

---

**END OF TESTING GUIDE**
