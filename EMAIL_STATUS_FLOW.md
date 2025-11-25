# Email Status Flow

This document describes the complete email status flow from lead creation to follow-ups.

## Status Flow Diagram

```
new (lead scraped)
  ↓
  ├─→ scheduled (not in business hours) ─→ email_sent (when processed)
  │
  └─→ email_sent (in business hours, sent immediately)
        ↓
        ├─→ followup_5day_sent (5 days later, if no reply)
        │     ↓
        │     └─→ followup_10day_sent (10 days after initial, if no reply)
        │
        └─→ reply_received (if lead replies at any point)
```

## Detailed Status Transitions

### 1. **new** → **scheduled** or **email_sent**

**When:** Lead is scraped and email is ready to send

**Conditions:**
- If **NOT in business hours** (outside Mon-Sat 9 AM - 6 PM in lead's timezone):
  - Status: `scheduled`
  - `scheduled_time` is set to next available business hours slot
  - `email_timezone` is set to lead's timezone
  
- If **IN business hours** (Mon-Sat 9 AM - 6 PM in lead's timezone):
  - Status: `email_sent`
  - Email is sent immediately
  - `sent_at` is set to current timestamp

**Code Location:**
- `app/routers/leads.py` - `_send_emails_to_leads()` function
- Checks timezone using `timezone_service.check_lead_business_hours()`
- Calls `queue_email_for_lead()` if not in business hours
- Calls `send_email_to_lead()` if in business hours

### 2. **scheduled** → **email_sent**

**When:** Scheduled email is processed by the queue processor

**Conditions:**
- `scheduled_time` has passed
- Current time is in business hours (Mon-Sat 9 AM - 6 PM)
- Email is sent via webhook

**Code Location:**
- `app/services/email_sending_service.py` - `process_email_queue()` method
- Runs periodically (via cron/scheduler)
- Checks `mail_status = 'scheduled'` and `scheduled_time <= now()`
- Verifies business hours before sending

### 3. **email_sent** → **followup_5day_sent**

**When:** 5 days after initial email was sent

**Conditions:**
- `mail_status = 'email_sent'`
- `followup_5_scheduled_date <= today`
- `followup_5_sent` is `NULL` or `'false'`
- Current time is in business hours (Mon-Sat 9 AM - 6 PM)
- No reply received (`mail_status != 'reply_received'`)

**Code Location:**
- `app/services/followup_service.py` - `process_due_followups()` method
- Runs periodically (via cron/scheduler)
- Queries for leads with `mail_status = 'email_sent'` and due 5-day follow-ups
- Checks timezone before sending
- Updates status to `followup_5day_sent` after successful send

### 4. **followup_5day_sent** → **followup_10day_sent**

**When:** 10 days after initial email was sent

**Conditions:**
- `mail_status = 'followup_5day_sent'`
- `followup_10_scheduled_date <= today`
- `followup_10_sent` is `NULL` or `'false'`
- Current time is in business hours (Mon-Sat 9 AM - 6 PM)
- No reply received (`mail_status != 'reply_received'`)

**Code Location:**
- `app/services/followup_service.py` - `process_due_followups()` method
- Queries for leads with `mail_status = 'followup_5day_sent'` and due 10-day follow-ups
- Updates status to `followup_10day_sent` after successful send

### 5. **Any status** → **reply_received**

**When:** Lead replies to any email (initial, 5-day, or 10-day follow-up)

**Conditions:**
- Reply is detected via n8n webhook
- Reply is analyzed by OpenAI
- All pending follow-ups are cancelled

**Code Location:**
- `app/services/reply_service.py` - `_analyze_reply()` method
- Updates `mail_status = 'reply_received'`
- Cancels follow-ups via `followup_service.cancel_followups_for_lead()`

### 6. **Any status** → **failed**

**When:** Email sending fails

**Conditions:**
- Webhook returns error
- Gmail API error
- Network timeout

**Code Location:**
- `app/services/email_sending_service.py` - `_send_email_immediately()` method
- Updates `mail_status = 'failed'`
- Adds to dead letter queue for retry

## Business Hours Logic

**Business Hours Definition:**
- **Days:** Monday through Saturday (Mon-Sat)
- **Hours:** 9:00 AM to 6:00 PM (9:00 - 17:59)
- **Timezone:** Lead's timezone (based on `company_country`)

**Scheduling Logic:**
- If **Sunday**: Schedule for Monday 9 AM
- If **Saturday after 6 PM**: Schedule for Monday 9 AM
- If **Weekday after 6 PM**: Schedule for next day 9 AM
- If **Before 9 AM**: Schedule for 9 AM same day (if weekday) or next Monday (if Sunday)
- If **Currently in business hours**: Can send immediately OR schedule for next hour

## Key Points

1. **Status is the source of truth**: All email states are tracked in `mail_status`
2. **Timezone-aware**: All scheduling and sending respects lead's timezone
3. **Business hours enforced**: Emails are only sent during business hours
4. **Follow-ups auto-cancel**: If reply is received, pending follow-ups are cancelled
5. **Scheduled emails processed**: Queue processor runs periodically to send scheduled emails

## Database Fields Used

- `mail_status`: Primary status field (TEXT)
- `scheduled_time`: When to send scheduled emails (TIMESTAMP WITH TIME ZONE)
- `email_timezone`: Lead's timezone (VARCHAR)
- `sent_at`: When email was actually sent (TIMESTAMP WITH TIME ZONE)
- `followup_5_scheduled_date`: Date for 5-day follow-up (DATE)
- `followup_10_scheduled_date`: Date for 10-day follow-up (DATE)
- `followup_5_sent`: Tracking flag (TEXT: "true", "false", "cancelled", NULL)
- `followup_10_sent`: Tracking flag (TEXT: "true", "false", "cancelled", NULL)

