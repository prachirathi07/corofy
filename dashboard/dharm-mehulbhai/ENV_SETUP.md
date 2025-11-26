# Environment Variables Setup

## Required Environment Variables

Create a `.env.local` file in the `dashboard/dharm-mehulbhai` directory with the following variables:

```bash
# Backend API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Supabase Configuration (still needed for some direct operations)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# n8n Webhook (optional - if still needed for legacy operations)
# NEXT_PUBLIC_N8N_WEBHOOK_URL=your_n8n_webhook_url_here
```

## Development Setup

1. Copy the variables above to `.env.local`
2. Update `NEXT_PUBLIC_API_BASE_URL` to match your backend server (default: `http://localhost:8000`)
3. Ensure your Supabase credentials are correct
4. Restart your Next.js dev server after adding/updating environment variables

## Production Setup

For production, update:
- `NEXT_PUBLIC_API_BASE_URL` to your production backend URL (e.g., `https://api.yourdomain.com`)
- Ensure CORS is configured in the backend to allow your frontend domain

