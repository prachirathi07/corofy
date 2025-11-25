"""
Test script to send 5-day follow-up emails
"""
import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta
from app.services.followup_service import FollowUpService
from app.services.email_sending_service import EmailSendingService
from app.core.database import get_db

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_followup_5day():
    """Test sending 5-day follow-up emails"""
    try:
        db = get_db()
        
        print("=" * 80)
        print("TEST: 5-Day Follow-up Email")
        print("=" * 80)
        
        # Option 1: Test with a specific lead ID
        # Uncomment and set a lead ID that has sent_at and mail_status='email_sent'
        # lead_id = "your-lead-id-here"
        
        # Option 2: Find a lead that has sent an email
        print("\n1. Finding a lead with email_sent status...")
        result = db.table("scraped_data").select("id, founder_name, founder_email, mail_status, sent_at, followup_5_sent, followup_5_scheduled_date").eq("mail_status", "email_sent").limit(1).execute()
        
        if not result.data:
            print("❌ No leads found with mail_status='email_sent'")
            print("   Please send an initial email first, then run this test.")
            return
        
        lead = result.data[0]
        lead_id = lead["id"]
        
        print(f"✅ Found lead: {lead.get('founder_name')} ({lead.get('founder_email')})")
        print(f"   Lead ID: {lead_id}")
        print(f"   Mail Status: {lead.get('mail_status')}")
        print(f"   Sent At: {lead.get('sent_at')}")
        print(f"   Follow-up 5 Sent: {lead.get('followup_5_sent')}")
        print(f"   Follow-up 5 Scheduled Date: {lead.get('followup_5_scheduled_date')}")
        
        # Check if follow-up is already sent
        if lead.get('followup_5_sent') == 'true' or lead.get('followup_5_sent') is True:
            print("\n⚠️  Follow-up 5 has already been sent for this lead.")
            response = input("   Do you want to test anyway? (y/n): ")
            if response.lower() != 'y':
                return
        
        # Option 3: Manually set a lead ID
        # Uncomment the line below and set your lead ID
        # lead_id = "eac2ba5a-8182-4929-9b87-e694b4a05a50"
        
        print(f"\n2. Testing follow-up email generation for lead {lead_id}...")
        
        # Test email generation
        from app.services.email_personalization_service import EmailPersonalizationService
        email_service = EmailPersonalizationService(db)
        
        print("   Generating follow-up email content...")
        email_result = await email_service.generate_email_for_lead(
            lead_id=lead_id,
            email_type="followup_5day"
        )
        
        if not email_result.get("success"):
            print(f"❌ Failed to generate email: {email_result.get('error')}")
            return
        
        print("✅ Email content generated successfully!")
        print(f"\n   Subject: {email_result.get('subject')}")
        print(f"   Body length: {len(email_result.get('body', ''))} characters")
        print(f"   Is Personalized: {email_result.get('is_personalized')}")
        print(f"   Company Website Used: {email_result.get('company_website_used')}")
        
        # Show preview of body (first 300 chars)
        body_preview = email_result.get('body', '')[:300]
        print(f"\n   Body Preview:\n   {body_preview}...")
        
        # Ask if user wants to send
        print("\n" + "=" * 80)
        response = input("Do you want to SEND this follow-up email? (y/n): ")
        
        if response.lower() != 'y':
            print("❌ Email not sent (user cancelled)")
            return
        
        print("\n3. Sending follow-up email...")
        
        # Send the follow-up email
        email_sending_service = EmailSendingService(db)
        send_result = await email_sending_service.send_email_to_lead(
            lead_id=lead_id,
            email_type="followup_5day"
        )
        
        if send_result.get("success"):
            print("✅ Follow-up email sent successfully!")
            print(f"   Message: {send_result.get('message')}")
            
            # Check updated lead status
            updated_lead = db.table("scraped_data").select("followup_5_sent, gmail_thread_id, gmail_message_id").eq("id", lead_id).execute()
            if updated_lead.data:
                lead_data = updated_lead.data[0]
                print(f"\n   Updated Status:")
                print(f"   - Follow-up 5 Sent: {lead_data.get('followup_5_sent')}")
                print(f"   - Gmail Thread ID: {lead_data.get('gmail_thread_id')}")
                print(f"   - Gmail Message ID: {lead_data.get('gmail_message_id')}")
        else:
            print(f"❌ Failed to send follow-up email: {send_result.get('error')}")
        
        print("\n" + "=" * 80)
        print("TEST COMPLETE")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

async def test_followup_scheduling():
    """Test scheduling follow-ups for a lead"""
    try:
        db = get_db()
        
        print("\n" + "=" * 80)
        print("TEST: Schedule Follow-ups")
        print("=" * 80)
        
        # Find a lead with sent email
        result = db.table("scraped_data").select("id, founder_name, sent_at, mail_status").eq("mail_status", "email_sent").limit(1).execute()
        
        if not result.data:
            print("❌ No leads found with mail_status='email_sent'")
            return
        
        lead = result.data[0]
        lead_id = lead["id"]
        sent_at_str = lead.get("sent_at")
        
        if not sent_at_str:
            print(f"❌ Lead {lead_id} has no sent_at timestamp")
            return
        
        # Parse sent_at
        sent_at = datetime.fromisoformat(sent_at_str.replace('Z', '+00:00'))
        
        print(f"✅ Found lead: {lead.get('founder_name')}")
        print(f"   Lead ID: {lead_id}")
        print(f"   Sent At: {sent_at}")
        
        # Schedule follow-ups
        followup_service = FollowUpService()
        result = followup_service.schedule_followups_for_lead(lead_id, sent_at)
        
        if result.get("success"):
            print("✅ Follow-ups scheduled successfully!")
            print(f"   5-day follow-up: {result.get('followup_5day_date')}")
            print(f"   10-day follow-up: {result.get('followup_10day_date')}")
        else:
            print(f"❌ Failed to schedule follow-ups: {result.get('error')}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Follow-up Email Test Script")
    print("=" * 80)
    print("1. Test 5-day follow-up email generation and sending")
    print("2. Test follow-up scheduling")
    print("=" * 80)
    
    choice = input("\nSelect option (1 or 2): ")
    
    if choice == "1":
        asyncio.run(test_followup_5day())
    elif choice == "2":
        asyncio.run(test_followup_scheduling())
    else:
        print("Invalid choice. Running option 1 by default...")
        asyncio.run(test_followup_5day())

