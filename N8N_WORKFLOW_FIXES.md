# n8n Workflow Fixes for Check Reply

## Issues Found

1. **Thread ID Extraction**: The original workflow tried to access `$json.body.gmail_thread_id` directly, but n8n webhooks can structure the incoming data differently depending on the request format.

2. **Response Format**: The response might not be properly formatted as JSON, causing parsing errors in the Python code.

3. **Reply Detection Logic**: The original code only checked for 'INBOX' label, but didn't properly exclude messages sent by us.

4. **Body Extraction**: The original code only used `snippet`, which might not contain the full reply body.

## Fixes Applied

### 1. Added "Extract Thread ID" Node
- **Purpose**: Safely extract `gmail_thread_id` from the webhook request
- **Location**: Between Webhook and Get Thread nodes
- **Logic**: 
  - Tries multiple possible locations: `$json.gmail_thread_id`, `$json.body.gmail_thread_id`, or parsed body string
  - Logs debug information to help troubleshoot
  - Returns error if thread ID not found

### 2. Fixed Gmail Node
- **Change**: Changed from `={{ $json.body.gmail_thread_id }}` to `={{ $json.gmail_thread_id }}`
- **Reason**: The Extract Thread ID node now provides the thread ID in the root of the JSON object

### 3. Improved Reply Processing
- **Better Reply Detection**: 
  - Checks for 'INBOX' label AND ensures it's not from us (excludes 'SENT' label)
  - Iterates backwards through messages to find the latest reply
  
- **Better Body Extraction**:
  - First tries to get full body from `msg.payload.body.data` (base64 decoded)
  - Falls back to extracting from `msg.payload.parts` if needed
  - Uses `snippet` as last resort
  
- **Better Logging**: Added console.log statements for debugging

### 4. Fixed Response Format
- **Change**: Changed response from `={{ $json }}` to `={{ JSON.stringify($json) }}`
- **Reason**: Ensures proper JSON formatting for the Python code

## Expected Response Format

The workflow now returns:
```json
{
  "has_reply": true/false,
  "body": "reply body text",
  "subject": "reply subject",
  "from": "sender@email.com",
  "date": "timestamp",
  "message_id": "gmail_message_id"
}
```

## How to Apply

1. Open your n8n workflow editor
2. Import the fixed workflow from `n8n_workflow_check_reply_fixed.json`
3. Or manually update your existing workflow:
   - Add the "Extract Thread ID" code node between Webhook and Get Thread
   - Update the Gmail node to use `={{ $json.gmail_thread_id }}`
   - Update the Process Reply code with the improved logic
   - Update the Respond node to use `={{ JSON.stringify($json) }}`

## Testing

After applying the fixes, test by:
1. Running the `trigger_reply_check.py` script
2. Check n8n execution logs for the debug console.log output
3. Verify the response format matches what Python expects

