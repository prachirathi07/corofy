"""
Test script to verify gmail_thread_id is being used for follow-up emails
"""
import asyncio
import logging
import sys
import os
from app.core.database import get_db
from app.services.email_sending_service import EmailSendingService

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_followup_thread_id():
    """Test that follow-up emails use the same gmail_thread_id"""
    try:
        db = get_db()
        
        print("=" * 80)
        print("TEST: Follow-up Email Thread ID")
        print("=" * 80)
        
        # Find a lead that has sent an email with gmail_thread_id
        print("\n1. Finding a lead with email_sent status and gmail_thread_id...")
        result = db.table("scraped_data").select(
            "id, founder_name, founder_email, mail_status, sent_at, gmail_thread_id, gmail_message_id"
        ).eq("mail_status", "email_sent").not_.is_("gmail_thread_id", "null").limit(1).execute()
        
        if not result.data:
            print("❌ No leads found with mail_status='email_sent' and gmail_thread_id")
            print("   Please send an initial email first, then run this test.")
            return
        
        lead = result.data[0]
        lead_id = lead["id"]
        original_thread_id = lead.get("gmail_thread_id")
        
        print(f"✅ Found lead: {lead.get('founder_name')} ({lead.get('founder_email')})")
        print(f"   Lead ID: {lead_id}")
        print(f"   Original Gmail Thread ID: {original_thread_id}")
        print(f"   Gmail Message ID: {lead.get('gmail_message_id')}")
        
        if not original_thread_id:
            print("❌ Lead has no gmail_thread_id. Cannot test follow-up thread.")
            return
        
        print(f"\n2. Testing follow-up email generation with thread ID...")
        print(f"   Expected: Follow-up should use thread ID: {original_thread_id}")
        
        # Test email generation
        from app.services.email_personalization_service import EmailPersonalizationService
        email_service = EmailPersonalizationService(db)
        
        email_result = await email_service.generate_email_for_lead(
            lead_id=lead_id,
            email_type="followup_5day"
        )
        
        if not email_result.get("success"):
            print(f"❌ Failed to generate email: {email_result.get('error')}")
            return
        
        print("✅ Email content generated")
        
        # Now test sending
        print(f"\n3. Testing email sending service...")
        email_sending_service = EmailSendingService(db)
        
        # Get the lead again to verify thread ID
        lead_check = db.table("scraped_data").select("gmail_thread_id").eq("id", lead_id).execute()
        if lead_check.data:
            current_thread_id = lead_check.data[0].get("gmail_thread_id")
            print(f"   Current gmail_thread_id in DB: {current_thread_id}")
            if current_thread_id != original_thread_id:
                print(f"   ⚠️  WARNING: Thread ID changed! Original: {original_thread_id}, Current: {current_thread_id}")
        
        print(f"\n4. Sending follow-up email...")
        print(f"   This should use gmail_thread_id: {original_thread_id}")
        print(f"   Check the logs above to verify gmail_thread_id is in the payload")
        
        response = input("\n   Do you want to SEND this follow-up email? (y/n): ")
        
        if response.lower() != 'y':
            print("❌ Email not sent (user cancelled)")
            return
        
        send_result = await email_sending_service.send_email_to_lead(
            lead_id=lead_id,
            email_type="followup_5day"
        )
        
        if send_result.get("success"):
            print("\n✅ Follow-up email sent!")
            
            # Check if thread ID was preserved
            updated_lead = db.table("scraped_data").select("gmail_thread_id, followup_5_sent").eq("id", lead_id).execute()
            if updated_lead.data:
                new_thread_id = updated_lead.data[0].get("gmail_thread_id")
                print(f"\n   Thread ID Check:")
                print(f"   - Original: {original_thread_id}")
                print(f"   - After follow-up: {new_thread_id}")
                
                if new_thread_id == original_thread_id:
                    print(f"   ✅ SUCCESS: Thread ID preserved! Follow-up is in same thread.")
                else:
                    print(f"   ⚠️  WARNING: Thread ID changed! Follow-up may be in new thread.")
                    print(f"   This could mean n8n created a new thread instead of replying.")
        else:
            print(f"❌ Failed to send: {send_result.get('error')}")
        
        print("\n" + "=" * 80)
        print("TEST COMPLETE")
        print("=" * 80)
        print("\n📋 Check the logs above for:")
        print("   1. 'Follow-up email: Checking for gmail_thread_id' - should show the thread ID")
        print("   2. 'Follow-up email: Using gmail_thread_id' - confirms it's in payload")
        print("   3. 'WEBHOOK PAYLOAD' - should include 'gmail_thread_id' field")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_followup_thread_id())

