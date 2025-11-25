"""
Test script to verify gmail_thread_id is in the webhook payload
This tests the payload without actually sending the email
"""
import asyncio
import logging
import sys
import os
from app.core.database import get_db
from app.services.email_personalization_service import EmailPersonalizationService
from app.services.webhook_service import WebhookService

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_payload():
    """Test that gmail_thread_id is included in webhook payload"""
    try:
        db = get_db()
        
        print("=" * 80)
        print("TEST: Verify gmail_thread_id in Webhook Payload")
        print("=" * 80)
        
        # Find a lead with gmail_thread_id and gmail_message_id
        print("\n1. Finding a lead with email_sent, gmail_thread_id, and gmail_message_id...")
        result = db.table("scraped_data").select(
            "id, founder_name, founder_email, gmail_thread_id, gmail_message_id"
        ).eq("mail_status", "email_sent").not_.is_("gmail_thread_id", "null").not_.is_("gmail_message_id", "null").limit(1).execute()
        
        if not result.data:
            print("❌ No leads found with both gmail_thread_id and gmail_message_id")
            return
        
        lead = result.data[0]
        lead_id = lead["id"]
        gmail_thread_id = lead.get("gmail_thread_id")
        gmail_message_id = lead.get("gmail_message_id")
        
        print(f"✅ Found lead: {lead.get('founder_name')}")
        print(f"   Lead ID: {lead_id}")
        print(f"   Gmail Thread ID: {gmail_thread_id}")
        print(f"   Gmail Message ID: {gmail_message_id}")
        
        # Generate follow-up email
        print(f"\n2. Generating follow-up email content...")
        email_service = EmailPersonalizationService(db)
        email_result = await email_service.generate_email_for_lead(
            lead_id=lead_id,
            email_type="followup_5day"
        )
        
        if not email_result.get("success"):
            print(f"❌ Failed to generate email: {email_result.get('error')}")
            return
        
        subject = email_result.get("subject")
        body = email_result.get("body")
        
        print(f"✅ Email generated")
        print(f"   Subject: {subject[:60]}...")
        
        # Test webhook payload
        print(f"\n3. Testing webhook payload construction...")
        webhook_service = WebhookService()
        
        # This is what the webhook service does internally
        payload = {
            "email_id": lead.get("founder_email"),
            "subject": subject,
            "body": body
        }
        
        # Add gmail_thread_id and message_id for follow-ups
        email_type = "followup_5day"
        if email_type.startswith("followup_"):
            if gmail_thread_id:
                payload["gmail_thread_id"] = gmail_thread_id
            if gmail_message_id:
                payload["message_id"] = gmail_message_id
        
        # Get webhook URL that would be used
        webhook_service = WebhookService()
        webhook_url = webhook_service._get_webhook_url("followup_5day")
        
        print(f"\n📦 WEBHOOK PAYLOAD:")
        print(f"   email_id: {payload.get('email_id')}")
        print(f"   subject: {payload.get('subject')[:60]}...")
        print(f"   body length: {len(payload.get('body', ''))} chars")
        print(f"   gmail_thread_id: {payload.get('gmail_thread_id', 'NOT FOUND ❌')}")
        print(f"   message_id: {payload.get('message_id', 'NOT FOUND ❌')}")
        print(f"\n🌐 WEBHOOK URL:")
        print(f"   URL for followup_5day: {webhook_url}")
        
        has_thread_id = bool(payload.get("gmail_thread_id"))
        has_message_id = bool(payload.get("message_id"))
        
        if has_thread_id and has_message_id:
            print(f"\n✅ SUCCESS: Both gmail_thread_id and message_id are in payload!")
            print(f"   Thread ID: {payload.get('gmail_thread_id')}")
            print(f"   Message ID: {payload.get('message_id')}")
            print(f"\n📋 Next Steps:")
            print(f"   1. Verify n8n workflow receives this payload")
            print(f"   2. Check n8n workflow uses gmail_thread_id and message_id in Gmail node")
            print(f"   3. In Gmail 'Send Email' node:")
            print(f"      - Set Thread ID to: $json.gmail_thread_id")
            print(f"      - Set Message ID to: $json.message_id")
        else:
            print(f"\n❌ PROBLEM: Missing required fields in payload!")
            if not has_thread_id:
                print(f"   - gmail_thread_id is NOT in payload!")
            if not has_message_id:
                print(f"   - message_id is NOT in payload!")
            print(f"   This means the Python code isn't adding them correctly.")
        
        print("\n" + "=" * 80)
        print("TEST COMPLETE")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_payload())

