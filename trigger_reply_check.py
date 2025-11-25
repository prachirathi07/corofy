import asyncio
import logging
import sys
import os
from app.services.reply_service import ReplyService
from app.core.database import get_db

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

async def main():
    try:
        print("Triggering manual reply check...")
        db = get_db()
        service = ReplyService()
        
        # Call the check_and_analyze_replies method
        result = await service.check_and_analyze_replies()
        
        print("\nReply check complete!")
        print(f"Result: {result}")
        
    except Exception as e:
        print(f"\nError checking replies: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
