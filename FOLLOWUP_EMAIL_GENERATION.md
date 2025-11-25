# Follow-up Email Generation Process

## Overview

Follow-up emails are **generated fresh** using OpenAI each time they are sent. They do NOT reuse the initial email content.

## How Follow-up Emails Are Generated

### 1. **Trigger Point**
When a follow-up email is due (5 or 10 days after initial email), the system:
- Checks if follow-up date has arrived
- Verifies it's business hours in the lead's timezone
- Calls `EmailSendingService.send_email_to_lead()` with `email_type="followup_5day"` or `"followup_10day"`

### 2. **Email Content Generation Flow**

```
EmailSendingService.send_email_to_lead()
    ↓
EmailPersonalizationService.generate_email_for_lead(email_type="followup_5day")
    ↓
OpenAIService.generate_personalized_email(email_type="followup_5day")
    ↓
OpenAIService._build_followup_prompt()  # Different from initial email prompt!
    ↓
OpenAI API generates NEW content
    ↓
Returns: { subject, body }
```

### 3. **Follow-up Email Prompt**

The follow-up prompt is **completely different** from the initial email prompt:

**Location**: `app/services/openai_service.py` → `_build_followup_prompt()`

**Prompt Structure**:
```python
Write a follow-up email sent {days} days after initial outreach.

Recipient: {lead_name}
Title: {lead_title}
Company: {company_name}

Requirements:
- Short (2 paragraphs)
- Polite
- Soft CTA
- Acknowledge they're busy

OUTPUT FORMAT (JSON):
{
    "subject": "...",
    "body": "..."
}
```

### 4. **Key Differences from Initial Email**

| Aspect | Initial Email | Follow-up Email |
|--------|--------------|-----------------|
| **Length** | Longer, detailed | Short (2 paragraphs) |
| **Tone** | Professional pitch | Polite, acknowledging busy schedule |
| **CTA** | Strong call-to-action | Soft CTA |
| **Personalization** | Uses company website content | Basic personalization |
| **Prompt** | `_build_initial_email_prompt()` | `_build_followup_prompt()` |
| **Product Catalogs** | Includes detailed catalogs | Not included |

### 5. **Code Flow Details**

#### Step 1: Email Type Detection
```python
# app/services/openai_service.py:52-54
if email_type in ["followup_5day", "followup_10day"]:
    days = 5 if email_type == "followup_5day" else 10
    prompt = self._build_followup_prompt(lead_name, lead_title, company_name, days)
```

#### Step 2: Follow-up Prompt Generation
```python
# app/services/openai_service.py:278-304
def _build_followup_prompt(self, lead_name, lead_title, company_name, days):
    return f"""
    Write a follow-up email sent {days} days after initial outreach.
    ...
    """
```

#### Step 3: OpenAI API Call
- Uses same model: `gpt-4o-mini`
- Returns JSON with `subject` and `body`
- No website scraping for follow-ups (faster, simpler)

#### Step 4: Email Sending
- Uses same `gmail_thread_id` to keep emails in same thread
- Sends via n8n webhook
- Updates `followup_5_sent` or `followup_10_sent` to `"true"`

## Example Follow-up Email Structure

**Subject**: Usually something like "Re: [Original Subject]" or "Following up on [Topic]"

**Body**: 
- Paragraph 1: Polite acknowledgment that they're busy, reference to initial email
- Paragraph 2: Soft reminder of value proposition, gentle CTA

## Testing Follow-up Generation

Use the test script: `test_followup_5day.py`

```bash
python test_followup_5day.py
```

This script will:
1. Find a lead with `mail_status='email_sent'`
2. Generate follow-up email content
3. Show you the generated subject and body
4. Optionally send the email

## Important Notes

1. **Fresh Content**: Each follow-up generates NEW content - never reuses initial email
2. **Same Thread**: Uses `gmail_thread_id` to keep all emails in same Gmail thread
3. **No Website Scraping**: Follow-ups don't re-scrape websites (faster generation)
4. **Shorter**: Follow-ups are intentionally shorter and more polite
5. **Automatic**: Follow-ups are automatically scheduled when initial email is sent

## Configuration

Follow-up timing is configured in:
- `app/services/followup_service.py` → `schedule_followups_for_lead()`
- 5 days: `sent_at + timedelta(days=5)`
- 10 days: `sent_at + timedelta(days=10)`

Follow-up prompt can be customized in:
- `app/services/openai_service.py` → `_build_followup_prompt()`

