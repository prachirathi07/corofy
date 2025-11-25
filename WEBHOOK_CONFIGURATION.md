# Webhook URL Configuration Guide

## Overview
This project uses n8n webhooks for data scraping and lead generation. All webhook URLs should be configured via environment variables for security and flexibility.

---

## Environment Variable Setup

### 1. Configure `.env.local`

Add your n8n webhook URL to `.env.local`:

```env
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
```

> **Note**: The `NEXT_PUBLIC_` prefix is required for Next.js to expose this variable to the browser.

### 2. Application Code (Already Configured ✅)

The ProductForm component already uses the environment variable:

```typescript
// components/ProductForm.tsx
const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
```

---

## n8n Workflow Configuration

### JSON Workflow Files

The following files contain n8n workflow templates:
- `lead-generation.json`
- `lead-generator/lead-generation.json`

These files have placeholder webhook URLs that need to be updated after importing into n8n.

### How to Import and Configure

1. **Import Workflow into n8n**
   - Open your n8n instance
   - Go to Workflows → Import
   - Upload the JSON file

2. **Update Webhook URLs**
   - Find the "Webhook" node in the workflow
   - Update the webhook path/URL to match your n8n instance
   - Save the workflow

3. **Get Your Webhook URL**
   - Click on the Webhook node
   - Copy the "Production URL"
   - Add this URL to your `.env.local` file

---

## Workflow Files Reference

| File | Location | Purpose |
|------|----------|---------|
| `lead-generation.json` | Root directory | Main lead generation workflow |
| `lead-generator/lead-generation.json` | lead-generator/ | Alternative lead generation workflow |

---

## Testing

After configuration, test the webhook:

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Fill out the Product Selection Form

3. Submit the form

4. Check your n8n workflow execution logs

---

## Security Notes

- ✅ Never commit `.env.local` to version control (already in `.gitignore`)
- ✅ Use environment variables for all sensitive URLs and API keys
- ✅ Rotate webhook URLs if they become compromised

---

## Troubleshooting

### Form submission fails
- Verify `NEXT_PUBLIC_N8N_WEBHOOK_URL` is set in `.env.local`
- Restart the development server after changing `.env.local`
- Check browser console for errors

### n8n workflow not triggering
- Ensure the webhook node is active in n8n
- Verify the webhook URL matches between `.env.local` and n8n
- Check n8n execution logs for errors
