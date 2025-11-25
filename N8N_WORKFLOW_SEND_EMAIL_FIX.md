# Fix: n8n Workflow to Use gmail_thread_id for Follow-ups

## Problem
Follow-up emails are creating new Gmail threads instead of replying in the same thread.

## Root Cause
The n8n workflow for **sending emails** (webhook: `5c430cd6-c53b-43bc-9960-1cd16d428991`) is not using the `gmail_thread_id` that Python sends in the payload.

## Verification ✅
Python code is working correctly:
- ✅ Retrieves `gmail_thread_id` from database
- ✅ Includes it in webhook payload as `gmail_thread_id`
- ✅ Test confirms: `gmail_thread_id: 19ab9e74fe96abde` is in payload

## n8n Workflow Fix Required

### Current Payload (What Python Sends)
```json
{
  "email_id": "recipient@email.com",
  "subject": "Follow-up: ...",
  "body": "Email body...",
  "gmail_thread_id": "19ab9e74fe96abde"  // ← This is included for follow-ups
}
```

### Required n8n Workflow Structure

```
1. Webhook Node
   - Receives POST request with payload
   
2. Code Node (Extract Thread ID) - OPTIONAL but recommended
   - Extract gmail_thread_id from $json.gmail_thread_id
   - Log it for debugging
   - Pass to next node
   
3. Gmail "Send Email" Node
   - To: $json.email_id
   - Subject: $json.subject
   - Body: $json.body
   - Thread ID: $json.gmail_thread_id  ← CRITICAL: Set this field!
   - If Thread ID is empty/null, Gmail will create new thread
   - If Thread ID exists, Gmail will reply in that thread
```

### Gmail Node Configuration

In the Gmail "Send Email" node, you need to set:

**Field**: `Thread ID` (or `ThreadId` depending on n8n version)
**Value**: `={{ $json.gmail_thread_id }}`

**Important Notes**:
- If `gmail_thread_id` is null/empty, Gmail will create a new thread (this is fine for initial emails)
- If `gmail_thread_id` has a value, Gmail will reply in that thread (this is what we want for follow-ups)

### Alternative: Conditional Logic

If your Gmail node doesn't support optional Thread ID, use a Code node:

```javascript
const emailId = $json.email_id;
const subject = $json.subject;
const body = $json.body;
const threadId = $json.gmail_thread_id;

// Prepare email data
const emailData = {
  to: emailId,
  subject: subject,
  body: body
};

// Only add threadId if it exists (for follow-ups)
if (threadId) {
  emailData.threadId = threadId;
  console.log('Using thread ID for reply:', threadId);
} else {
  console.log('No thread ID - creating new thread');
}

return [{
  json: emailData
}];
```

Then in Gmail node, use:
- Thread ID: `={{ $json.threadId }}`

## Testing the Fix

1. **Check n8n Execution Logs**:
   - Look for the webhook payload
   - Verify `gmail_thread_id` is in the received data
   - Check if Gmail node used the thread ID

2. **Check Gmail**:
   - Send a follow-up email
   - Verify it appears in the same thread as the initial email
   - If it's in a new thread, the workflow isn't using the thread ID

3. **Use Test Script**:
   ```bash
   python test_followup_payload.py
   ```
   This confirms the payload includes `gmail_thread_id`

## Expected Behavior

### Initial Email (email_type="initial")
- Payload: `{ email_id, subject, body }` (no gmail_thread_id)
- Gmail: Creates new thread
- Response: Returns `gmail_thread_id` which we store

### Follow-up Email (email_type="followup_5day" or "followup_10day")
- Payload: `{ email_id, subject, body, gmail_thread_id: "..." }`
- Gmail: Should reply in thread specified by `gmail_thread_id`
- Response: Returns same or new `gmail_thread_id` (should be same)

## Debugging Steps

1. **Check Python Logs**:
   - Look for: `"📎 Follow-up email: Using gmail_thread_id {id}"`
   - Look for: `"📦 Payload now includes gmail_thread_id: {id}"`
   - Look for: `"🔗 gmail_thread_id in payload: {id}"`

2. **Check n8n Execution**:
   - Open the execution in n8n
   - Check Webhook node output - should see `gmail_thread_id` in JSON
   - Check Gmail node input - should see `gmail_thread_id` being used
   - Check Gmail node output - verify email was sent in correct thread

3. **Manual Test**:
   - Use `test_followup_5day.py` to send a follow-up
   - Check Gmail to see if it's in the same thread

## Summary

✅ **Python Code**: Working correctly - sends `gmail_thread_id` in payload
❌ **n8n Workflow**: Needs to be configured to use `gmail_thread_id` in Gmail node

**Fix**: Set Thread ID field in Gmail "Send Email" node to `={{ $json.gmail_thread_id }}`

