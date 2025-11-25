# 🚀 PRE-PRODUCTION CHECKLIST
**Complete Verification Before Going Live**

---

## ✅ CRITICAL - MUST COMPLETE

### 🔐 1. SECURITY & CREDENTIALS

#### Environment Variables
- [ ] **Backend `.env`** - All API keys present and valid
  ```bash
  # Verify file exists and has all keys
  cat .env | grep -E "SUPABASE_URL|SUPABASE_KEY|APOLLO_API_KEY|OPENAI_API_KEY|FIRECRAWL_API_KEY|GMAIL_"
  ```
- [ ] **Frontend `.env.local`** - API URLs configured correctly
  ```bash
  # Check frontend env
  cat dashboard/dharm-mehulbhai/.env.local
  ```
- [ ] **No hardcoded secrets** in code
  ```bash
  # Search for potential hardcoded secrets
  grep -r "sk-" app/ --exclude-dir=__pycache__
  grep -r "eyJ" app/ --exclude-dir=__pycache__
  ```

#### API Keys Validation
- [ ] **Apollo API Key** - Test with actual API call
  ```bash
  curl -X POST http://localhost:8000/api/leads/scrape \
    -H "Content-Type: application/json" \
    -d '{"total_leads_wanted": 1, "sic_codes": ["2879"], "industry": "Test", "source": "apollo"}'
  ```
- [ ] **OpenAI API Key** - Check credits available
  - Visit: https://platform.openai.com/usage
  - Ensure sufficient credits for production volume
- [ ] **Firecrawl API Key** - Verify rate limits
  - Check plan limits
  - Ensure rate limiting is configured
- [ ] **Gmail API** - OAuth tokens valid
  ```bash
  # Check if token.json exists and is recent
  ls -la credentials.json token.json
  ```

#### CORS Configuration
- [ ] **Update CORS origins** in `app/main.py`
  ```python
  # Change from:
  allow_origins=["*"]
  # To production domains:
  allow_origins=[
      "https://yourdomain.com",
      "https://www.yourdomain.com"
  ]
  ```

---

### 🗄️ 2. DATABASE

#### Schema & Migrations
- [ ] **All migrations applied** to production database
  ```sql
  -- Run in order:
  1. supabase_schema.sql
  2. migrations/final_ultra_simplified_migration.sql
  3. migrations/add_batch_tracking.sql
  4. migrations/add_daily_email_quota.sql
  5. migrations/add_dead_letter_queue.sql
  6. migrations/complete_mail_status_setup.sql
  7. migrations/add_performance_indexes.sql
  ```

- [ ] **Verify table structure**
  ```sql
  -- Check scraped_data table
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'scraped_data'
  ORDER BY ordinal_position;
  
  -- Should have:
  -- - mail_status (VARCHAR, default 'not_sent')
  -- - is_verified (BOOLEAN)
  -- - retry_count (INTEGER)
  -- - next_retry_at (TIMESTAMP)
  -- - error_message (TEXT)
  ```

- [ ] **Indexes created**
  ```sql
  -- Verify critical indexes exist
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'scraped_data';
  
  -- Should include:
  -- - idx_mail_status
  -- - idx_scheduled_send_time
  -- - idx_gmail_thread_id
  ```

#### Database Permissions
- [ ] **Row Level Security (RLS)** configured (if needed)
- [ ] **Service role key** has correct permissions
- [ ] **Anon key** restricted appropriately

#### Backup Strategy
- [ ] **Automated backups** enabled in Supabase
- [ ] **Backup retention** policy set (7-30 days recommended)
- [ ] **Test restore** from backup (critical!)

---

### 🔧 3. BACKEND CONFIGURATION

#### Service Configuration
- [ ] **Daily email quota** set appropriately
  ```python
  # Check in daily_email_quota_service.py
  DAILY_QUOTA_LIMIT = 50  # Adjust for production
  ```

- [ ] **Scheduler intervals** configured
  ```python
  # Check scheduler_service.py
  # Email queue: Every 2 hours (line 31)
  # DLQ retry: Every 1 hour (line 40)
  # Rate limiter cleanup: Every 10 minutes (line 49)
  ```

- [ ] **Retry delays** appropriate for production
  ```python
  # Check dead_letter_queue_service.py
  retry_delays = [300, 1800, 7200]  # 5min, 30min, 2hr
  max_attempts = 3
  ```

- [ ] **Rate limiting** configured for Firecrawl
  ```python
  # Check firecrawl_service.py
  # Ensure rate limits match your plan
  ```

#### Logging
- [ ] **Log level** set correctly
  ```python
  # In .env
  LOG_LEVEL=INFO  # Not DEBUG in production
  ```

- [ ] **Log rotation** configured
  ```python
  # Check logging_config.py
  # Ensure logs don't fill disk
  ```

- [ ] **Sensitive data** not logged
  ```bash
  # Search for potential PII logging
  grep -r "logger.*email" app/services/
  grep -r "logger.*password" app/services/
  ```

#### Error Handling
- [ ] **All endpoints** have try-catch blocks
- [ ] **Error responses** don't leak sensitive info
- [ ] **Exception handlers** registered in `main.py`

---

### 🎨 4. FRONTEND

#### API Integration
- [ ] **API base URL** points to production backend
  ```typescript
  // Check .env.local
  NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
  ```

- [ ] **Error handling** implemented in all API calls
  ```typescript
  // Check lib/api.ts
  // Ensure all methods have try-catch
  ```

- [ ] **Loading states** for all async operations
- [ ] **User feedback** for success/error states

#### ProductForm
- [ ] **Form validation** working correctly
- [ ] **SIC code mapping** accurate
- [ ] **Industry data** up to date
- [ ] **Country list** complete
- [ ] **Confirmation modal** displays correct data
- [ ] **Progress notifications** show/hide properly
- [ ] **Navigation** works after submission

#### Build & Deploy
- [ ] **Production build** succeeds
  ```bash
  cd dashboard/dharm-mehulbhai
  npm run build
  ```

- [ ] **No console errors** in production build
- [ ] **Environment variables** injected at build time
- [ ] **Static assets** optimized

---

### 📧 5. EMAIL SYSTEM

#### Gmail API Setup
- [ ] **OAuth consent screen** configured
- [ ] **Scopes** properly set
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.readonly`
- [ ] **Token refresh** working
  ```python
  # Test token refresh
  # Run email sending and verify it works after 1 hour
  ```

- [ ] **Sender email** verified and professional
- [ ] **Email signature** configured (if needed)

#### Email Content
- [ ] **Templates** reviewed for professionalism
- [ ] **Personalization** working correctly
  ```python
  # Test with actual company website
  # Verify GPT-4 generates relevant content
  ```

- [ ] **Subject lines** not spammy
- [ ] **Unsubscribe link** included (if required by law)
- [ ] **Company info** in footer

#### Deliverability
- [ ] **SPF record** configured for domain
- [ ] **DKIM** enabled
- [ ] **DMARC** policy set
- [ ] **Sender reputation** checked
  - Use: https://www.mail-tester.com/
- [ ] **Test emails** to different providers
  - [ ] Gmail
  - [ ] Outlook
  - [ ] Yahoo
  - [ ] Corporate email (if targeting B2B)

#### Rate Limiting
- [ ] **Daily quota** enforced (50 emails/day)
- [ ] **Business hours** scheduling working
  ```python
  # Test timezone calculations
  # Verify emails scheduled correctly for different timezones
  ```

---

### 🔍 6. APOLLO INTEGRATION

#### API Configuration
- [ ] **Filters** correctly configured
  ```python
  # Verify in apollo_service.py:
  # - email_status: ["verified"]
  # - reveal_personal_emails: True
  # - person_titles: correct list
  # - NO phone numbers requested
  ```

- [ ] **Employee size ranges** match requirements
  ```python
  # Check _get_employee_size_ranges()
  # Should return 4 ranges: 1-10, 11-50, 51-200, 201-500
  ```

- [ ] **Countries list** complete and accurate
- [ ] **Industry filter** passed correctly

#### Data Quality
- [ ] **Test scraping** with real filters
  ```bash
  # Scrape 5 leads and verify data quality
  curl -X POST http://localhost:8000/api/leads/scrape \
    -H "Content-Type: application/json" \
    -d '{
      "total_leads_wanted": 5,
      "sic_codes": ["2879"],
      "industry": "Agrochemical",
      "source": "apollo"
    }'
  ```

- [ ] **Verify data saved** to `scraped_data`
  ```sql
  SELECT * FROM scraped_data ORDER BY created_at DESC LIMIT 5;
  ```

- [ ] **Check field population**
  - [ ] email (should always be present)
  - [ ] is_verified (should be true)
  - [ ] company_name
  - [ ] company_domain
  - [ ] company_sic_code
  - [ ] title
  - [ ] NO phone numbers

#### API Credits
- [ ] **Check Apollo credits** remaining
- [ ] **Monitor usage** during testing
- [ ] **Set up alerts** for low credits (if available)

---

### 🤖 7. AI/ML SERVICES

#### OpenAI
- [ ] **Model version** specified
  ```python
  # Check openai_service.py
  model = "gpt-4"  # or "gpt-4-turbo"
  ```

- [ ] **Token limits** appropriate
  ```python
  max_tokens = 500  # For email generation
  ```

- [ ] **Temperature** set correctly
  ```python
  temperature = 0.7  # Balance creativity/consistency
  ```

- [ ] **Prompt engineering** tested
  - [ ] Generates professional emails
  - [ ] Avoids spam triggers
  - [ ] Personalizes based on company info
  - [ ] Maintains consistent tone

- [ ] **Fallback** for API failures
  ```python
  # What happens if OpenAI is down?
  # Should have generic template fallback
  ```

#### Firecrawl
- [ ] **Rate limits** respected
- [ ] **Retry logic** working
- [ ] **Cache** functioning
  ```sql
  -- Check company_websites table
  SELECT COUNT(*) FROM company_websites
  WHERE scraping_status = 'success';
  ```

- [ ] **Error handling** for failed scrapes
  ```python
  # What happens if website can't be scraped?
  # Should still send email with generic content
  ```

---

### ⏰ 8. SCHEDULER & BACKGROUND JOBS

#### Scheduler Status
- [ ] **Scheduler starts** on application startup
  ```bash
  # Check logs for:
  # "🚀 Background Scheduler STARTED"
  ```

- [ ] **Jobs registered** correctly
  ```bash
  # Check logs for:
  # "⏰ Scheduler jobs configured"
  ```

- [ ] **Jobs running** on schedule
  ```bash
  # Monitor logs for job execution:
  tail -f logs/app.log | grep "JOB START"
  ```

#### Job Testing
- [ ] **Email queue processing** works
  ```sql
  -- Create test scheduled email
  UPDATE scraped_data
  SET mail_status = 'scheduled',
      scheduled_send_time = NOW() - INTERVAL '1 minute'
  WHERE id = 'test-lead-id';
  
  -- Wait for scheduler (2 hours or trigger manually)
  -- Verify mail_status changes to 'sent'
  ```

- [ ] **DLQ retry** works
  ```sql
  -- Create test failed email
  UPDATE scraped_data
  SET mail_status = 'failed',
      retry_count = 0,
      next_retry_at = NOW()
  WHERE id = 'test-lead-id';
  
  -- Wait for scheduler (1 hour)
  -- Verify retry attempt in logs
  ```

- [ ] **Rate limiter cleanup** works
  - Check logs for cleanup messages

---

### 🧪 9. TESTING

#### Integration Tests
- [ ] **End-to-end scraping flow**
  1. Submit ProductForm
  2. Verify API call
  3. Check database writes
  4. Confirm frontend navigation

- [ ] **Email sending flow**
  1. Select leads
  2. Trigger email send
  3. Verify website scraping
  4. Check personalization
  5. Confirm scheduling
  6. Wait for scheduler
  7. Verify email sent

- [ ] **Reply detection**
  1. Send test email
  2. Reply to it
  3. Wait for scheduler
  4. Verify mail_status = 'replied'

#### Load Testing
- [ ] **Scrape 100+ leads** - verify performance
- [ ] **Send 50 emails** in one day - check quota
- [ ] **Database queries** optimized
  ```sql
  -- Check slow queries
  EXPLAIN ANALYZE
  SELECT * FROM scraped_data
  WHERE mail_status = 'scheduled'
  AND scheduled_send_time <= NOW();
  ```

#### Error Scenarios
- [ ] **Apollo API down** - graceful failure
- [ ] **OpenAI API down** - fallback template
- [ ] **Firecrawl timeout** - generic email sent
- [ ] **Gmail API error** - email queued in DLQ
- [ ] **Database connection lost** - proper error handling

---

### 📊 10. MONITORING & OBSERVABILITY

#### Health Checks
- [ ] **Health endpoint** working
  ```bash
  curl http://localhost:8000/health
  ```

- [ ] **System status** endpoint working
  ```bash
  curl http://localhost:8000/api/system/status
  ```

#### Logging
- [ ] **Logs accessible** and readable
- [ ] **Log aggregation** set up (optional but recommended)
  - Consider: Datadog, Sentry, LogRocket
- [ ] **Error tracking** configured
  - Sentry integration for production errors

#### Metrics (Recommended)
- [ ] **Track key metrics**:
  - Leads scraped per day
  - Emails sent per day
  - Email success rate
  - DLQ size
  - API response times
  - Error rates

#### Alerts (Recommended)
- [ ] **Set up alerts** for:
  - API failures (Apollo, OpenAI, Gmail)
  - Database connection issues
  - Scheduler stopped
  - DLQ size > threshold
  - Daily quota exceeded
  - Error rate spike

---

### 🚀 11. DEPLOYMENT

#### Backend Deployment
- [ ] **Hosting platform** chosen
  - Options: Railway, Render, Fly.io, AWS, GCP
- [ ] **Environment variables** configured in platform
- [ ] **Database connection** string updated
- [ ] **Port configuration** correct
- [ ] **Health check** endpoint configured
- [ ] **Auto-restart** on failure enabled
- [ ] **Resource limits** set appropriately
  - Memory: 512MB minimum
  - CPU: 1 core minimum

#### Frontend Deployment
- [ ] **Hosting platform** chosen
  - Options: Vercel, Netlify, Cloudflare Pages
- [ ] **Build command** configured
  ```bash
  npm run build
  ```
- [ ] **Environment variables** set
- [ ] **Custom domain** configured (if applicable)
- [ ] **SSL certificate** enabled
- [ ] **CDN** configured for static assets

#### DNS & Domain
- [ ] **Domain purchased** (if needed)
- [ ] **DNS records** configured
  - A record for backend
  - CNAME for frontend
  - MX records for email (if using custom domain)
- [ ] **SSL/TLS** certificates installed
- [ ] **HTTPS redirect** enabled

---

### 📝 12. DOCUMENTATION

#### Code Documentation
- [ ] **README.md** updated with:
  - Setup instructions
  - Environment variables
  - Deployment steps
  - Troubleshooting guide

- [ ] **API documentation** complete
  - Swagger/OpenAPI docs at `/docs`
  - All endpoints documented

- [ ] **Architecture docs** up to date
  - PROJECT_AUDIT.md ✅
  - ARCHITECTURE_DIAGRAM.md ✅
  - TESTING_GUIDE.md ✅

#### Operational Docs
- [ ] **Runbook** created
  - How to restart services
  - How to check logs
  - How to handle common errors
  - Emergency contacts

- [ ] **Backup/Restore** procedures documented
- [ ] **Scaling** guidelines documented

---

### 🔒 13. COMPLIANCE & LEGAL

#### Email Compliance
- [ ] **CAN-SPAM Act** compliance (US)
  - [ ] Unsubscribe link in emails
  - [ ] Physical address in footer
  - [ ] Accurate subject lines
  - [ ] Honor unsubscribe requests within 10 days

- [ ] **GDPR** compliance (EU)
  - [ ] Consent mechanism
  - [ ] Data deletion capability
  - [ ] Privacy policy
  - [ ] Data processing agreement

- [ ] **CASL** compliance (Canada)
  - [ ] Consent obtained
  - [ ] Identification of sender
  - [ ] Unsubscribe mechanism

#### Data Privacy
- [ ] **Privacy policy** published
- [ ] **Terms of service** published
- [ ] **Data retention** policy defined
- [ ] **Data deletion** mechanism implemented

---

### 🎯 14. PERFORMANCE OPTIMIZATION

#### Database
- [ ] **Connection pooling** configured
- [ ] **Query optimization** done
- [ ] **Indexes** on frequently queried columns
- [ ] **Vacuum/Analyze** scheduled (PostgreSQL)

#### API
- [ ] **Response caching** where appropriate
- [ ] **Pagination** implemented for large datasets
- [ ] **Rate limiting** on public endpoints
- [ ] **Compression** enabled (gzip)

#### Frontend
- [ ] **Code splitting** enabled
- [ ] **Lazy loading** for components
- [ ] **Image optimization** done
- [ ] **Bundle size** optimized
  ```bash
  npm run build
  # Check bundle size
  ```

---

### 🔐 15. SECURITY HARDENING

#### Application Security
- [ ] **SQL injection** prevention (using parameterized queries)
- [ ] **XSS protection** enabled
- [ ] **CSRF protection** enabled
- [ ] **Input validation** on all endpoints
- [ ] **Output encoding** for user data
- [ ] **Security headers** configured
  ```python
  # Add to main.py
  app.add_middleware(
      SecurityHeadersMiddleware,
      x_frame_options="DENY",
      x_content_type_options="nosniff",
      x_xss_protection="1; mode=block"
  )
  ```

#### Secrets Management
- [ ] **No secrets** in version control
- [ ] **Environment variables** used for all secrets
- [ ] **Secret rotation** plan in place
- [ ] **Access control** for production secrets

#### Network Security
- [ ] **HTTPS only** enforced
- [ ] **Firewall rules** configured
- [ ] **DDoS protection** enabled (if available)
- [ ] **IP whitelisting** for admin endpoints (optional)

---

### 📈 16. BUSINESS CONTINUITY

#### Disaster Recovery
- [ ] **Backup strategy** tested
- [ ] **Recovery time objective (RTO)** defined
- [ ] **Recovery point objective (RPO)** defined
- [ ] **Failover plan** documented

#### Scaling Plan
- [ ] **Horizontal scaling** possible
- [ ] **Database scaling** strategy
- [ ] **Load balancing** configured (if needed)
- [ ] **Auto-scaling** rules set

---

## 🎉 FINAL VERIFICATION

### Pre-Launch Checklist
- [ ] **All critical items** above completed
- [ ] **Staging environment** tested thoroughly
- [ ] **Production environment** configured
- [ ] **Team trained** on operations
- [ ] **Support process** defined
- [ ] **Rollback plan** ready
- [ ] **Launch date** scheduled
- [ ] **Monitoring** active

### Launch Day
- [ ] **Deploy backend** to production
- [ ] **Deploy frontend** to production
- [ ] **Verify health checks** passing
- [ ] **Test critical flows** in production
- [ ] **Monitor logs** for errors
- [ ] **Monitor metrics** for anomalies
- [ ] **Be ready** to rollback if needed

### Post-Launch (First 24 Hours)
- [ ] **Monitor error rates**
- [ ] **Check email deliverability**
- [ ] **Verify scheduler** running
- [ ] **Review logs** for issues
- [ ] **Gather user feedback**
- [ ] **Document issues** for future fixes

---

## 📞 EMERGENCY CONTACTS

```
Backend Issues: [Your Name/Team]
Frontend Issues: [Your Name/Team]
Database Issues: Supabase Support
Email Issues: Gmail API Support
Infrastructure: [Hosting Provider Support]
```

---

## 🎯 PRIORITY LEVELS

**P0 - Critical (Must Fix Before Launch):**
- Security vulnerabilities
- Data loss risks
- API key issues
- Database migration failures

**P1 - High (Should Fix Before Launch):**
- Error handling gaps
- Missing monitoring
- Performance issues
- Incomplete documentation

**P2 - Medium (Can Fix After Launch):**
- UI/UX improvements
- Additional features
- Code refactoring
- Enhanced logging

**P3 - Low (Nice to Have):**
- Optimization tweaks
- Additional metrics
- Advanced features

---

**GOOD LUCK WITH YOUR LAUNCH! 🚀**
