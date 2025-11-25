import asyncio
import httpx
import json
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

async def test_n8n_reply():
    """Test what n8n returns for a specific thread"""
    thread_id = "19ab9e775d33643f"
    n8n_url = "https://n8n.srv963601.hstgr.cloud/webhook/check-reply"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            n8n_url,
            json={"gmail_thread_id": thread_id},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.text:
            try:
                data = response.json()
                print(f"\nParsed JSON:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
                print(f"\nKeys: {list(data.keys())}")
                print(f"has_reply: {data.get('has_reply')}")
                body = data.get('body', '')
                print(f"body length: {len(body) if body else 0}")
                print(f"body (first 200 chars): {body[:200] if body else 'EMPTY/NULL'}")
                print(f"subject: {data.get('subject', 'NOT FOUND')}")
                print(f"from: {data.get('from', 'NOT FOUND')}")
            except Exception as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Raw response (first 500 chars): {response.text[:500]}")

if __name__ == "__main__":
    asyncio.run(test_n8n_reply())

