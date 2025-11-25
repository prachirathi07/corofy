import asyncio
import logging
from app.services.reply_service import ReplyService
from app.core.database import get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

async def test_analysis():
    """Test the analysis fix with the existing reply"""
    db = get_db()
    service = ReplyService()
    
    # Get the lead with the reply
    lead_id = "eac2ba5a-8182-4929-9b87-e694b4a05a50"
    
    # Simulate the reply data that n8n returns
    reply_data = {
        "has_reply": True,
        "reply_body": "hi mehul, i am interested in collaborating. talk soon!",
        "reply_subject": "Re: Hi Aashish",
        "reply_from": "test@example.com",
        "lead_id": lead_id
    }
    
    print("Testing analysis with fixed data mapping...")
    print(f"Reply body: {reply_data['reply_body']}")
    print(f"Reply subject: {reply_data['reply_subject']}")
    
    # Call analysis
    result = await service._analyze_reply(reply_data, lead_id)
    
    print(f"\nAnalysis result: {result}")
    
    # Check database
    lead_result = db.table("scraped_data").select("mail_status, reply_priority, mail_replies").eq("id", lead_id).execute()
    if lead_result.data:
        lead = lead_result.data[0]
        print(f"\nDatabase status:")
        print(f"  mail_status: {lead.get('mail_status')}")
        print(f"  reply_priority: {lead.get('reply_priority')}")
        print(f"  mail_replies: {lead.get('mail_replies', '')[:100]}...")

if __name__ == "__main__":
    asyncio.run(test_analysis())

