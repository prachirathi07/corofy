# Scrap Data Button - Webhook Flow

## Overview
When you click the **"Scrap Data"** button in the Product Selection Form, data is sent to the webhook URL configured in your `.env.local` file.

---

## Webhook URL Source

### Environment Variable
**File**: `.env.local`
```env
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
```

### Code Implementation
**File**: [ProductForm.tsx:932](file:///Users/dharmpatel/Desktop/Nenotech%20projects/Mehul%20Bhai%20Dynamic/Corofy-Dashboard/components/ProductForm.tsx#L932)

```typescript
const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(submitPayload),
});
```

---

## Complete Flow

### 1. User Clicks "Scrap Data" Button
**Location**: [ProductForm.tsx:1430-1435](file:///Users/dharmpatel/Desktop/Nenotech%20projects/Mehul%20Bhai%20Dynamic/Corofy-Dashboard/components/ProductForm.tsx#L1430-L1435)

```tsx
<button
  onClick={handleSubmit}
  className="bg-blue-600 text-white px-6 py-3 rounded-lg..."
>
  Scrap Data
</button>
```

### 2. `handleSubmit` Function Executes
Prepares the payload and shows confirmation modal

### 3. User Confirms in Modal
Clicks "Confirm & Scrap Data" button

### 4. `handleConfirmSubmit` Function Executes
**Location**: [ProductForm.tsx:924-950](file:///Users/dharmpatel/Desktop/Nenotech%20projects/Mehul%20Bhai%20Dynamic/Corofy-Dashboard/components/ProductForm.tsx#L924-L950)

- Reads webhook URL from `process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL`
- Sends POST request to the webhook
- Displays success/error message

---

## Data Payload Structure

The following data is sent to the webhook:

```json
{
  "industry": "Agrochemical",
  "brandName": "CORSA",
  "chemicalName": "Castor Oil Ethoxylate",
  "countries": ["USA", "Canada", "Mexico"],
  "sic_codes": ["2879"],
  "product": {
    "id": "1",
    "industry": "Agrochemical",
    "brandName": "CORSA",
    "chemicalName": "Castor Oil Ethoxylate",
    "application": "Nonionic Surfactant / Emulsifier",
    "targetCountries": ["USA", "Canada", "Mexico", ...]
  },
  "timestamp": "2025-11-21T06:08:29.123Z"
}
```

---

## Verification Steps

### Check Current Webhook URL

1. **View `.env.local` file**:
   ```bash
   cat .env.local | grep NEXT_PUBLIC_N8N_WEBHOOK_URL
   ```

2. **Check if it's set**:
   - If empty or not set, add your n8n webhook URL
   - Restart the dev server after changing

### Test the Flow

1. **Open browser console** (F12)
2. Fill out the product form
3. Click "Scrap Data"
4. Confirm in the modal
5. **Check console logs**:
   - Look for: `Submitting form data: {...}`
   - Check for any errors

### Verify n8n Receives Data

1. Open your n8n instance
2. Go to the workflow with the webhook
3. Check execution history
4. Verify the webhook was triggered

---

## Summary

✅ **Webhook URL**: Comes from `process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL`  
✅ **Code Location**: [ProductForm.tsx:932](file:///Users/dharmpatel/Desktop/Nenotech%20projects/Mehul%20Bhai%20Dynamic/Corofy-Dashboard/components/ProductForm.tsx#L932)  
✅ **Button Location**: [ProductForm.tsx:1434](file:///Users/dharmpatel/Desktop/Nenotech%20projects/Mehul%20Bhai%20Dynamic/Corofy-Dashboard/components/ProductForm.tsx#L1434)  
✅ **Configuration**: Set in `.env.local` file  
✅ **No Hardcoded URLs**: All webhook URLs use environment variables
