import logging
from datetime import date
from typing import Dict, Optional
from supabase import Client

logger = logging.getLogger(__name__)

class SimplifiedEmailTrackingService:
    """
    Simplified service for one-click-per-day email sending.
    - Allows only ONE send per day
    - Processes exactly 400 leads per day
    - Sequential batches: Day 1 = leads 1-400, Day 2 = leads 401-800, etc.
    - No retries for failed leads
    """
    
    def __init__(self, db: Client, batch_size: int = 400):
        self.db = db
        self.batch_size = batch_size
    
    def can_send_today(self) -> Dict:
        """
        Check if emails can be sent today.
        Returns: {
            "can_send": bool,
            "reason": str,
            "last_send_date": date or None,
            "next_batch_offset": int
        }
        """
        today = date.today()
        
        try:
            # Check if we already sent today
            result = self.db.table("daily_email_tracking").select("*").eq("last_send_date", str(today)).execute()
            
            if result.data and len(result.data) > 0:
                # Already sent today
                record = result.data[0]
                return {
                    "can_send": False,
                    "reason": f"Emails already sent today ({record.get('leads_processed', 0)} leads processed, {record.get('emails_sent', 0)} emails sent). Try again tomorrow.",
                    "last_send_date": today,
                    "next_batch_offset": record.get("batch_offset", 0)
                }
            else:
                # Can send today
                # Get the last send record to determine next batch offset
                last_result = self.db.table("daily_email_tracking").select("*").order("last_send_date", desc=True).limit(1).execute()
                
                if last_result.data and len(last_result.data) > 0:
                    last_record = last_result.data[0]
                    next_offset = last_record.get("batch_offset", 0) + 1
                else:
                    next_offset = 0  # First time ever
                
                return {
                    "can_send": True,
                    "reason": "Ready to send",
                    "last_send_date": None,
                    "next_batch_offset": next_offset
                }
                
        except Exception as e:
            logger.error(f"Error checking send status: {e}")
            return {
                "can_send": False,
                "reason": f"Error checking status: {str(e)}",
                "last_send_date": None,
                "next_batch_offset": 0
            }
    
    def get_next_batch_leads(self) -> list:
        """
        Get the next batch of unprocessed leads.
        Returns leads that haven't been processed yet (email_processed = false or null).
        """
        try:
            # Get unprocessed leads with valid emails
            # Query for leads where email_processed is not true AND founder_email is not null/empty
            result = self.db.table("scraped_data").select("*").is_("email_processed", "null").not_.is_("founder_email", "null").neq("founder_email", "").limit(self.batch_size).execute()
            
            # If no null records, try false records
            if not result.data or len(result.data) == 0:
                result = self.db.table("scraped_data").select("*").eq("email_processed", False).not_.is_("founder_email", "null").neq("founder_email", "").limit(self.batch_size).execute()
            
            leads = result.data if result.data else []
            logger.info(f"📋 Found {len(leads)} unprocessed leads for next batch")
            return leads
            
        except Exception as e:
            logger.error(f"Error getting next batch: {e}")
            return []
    
    def mark_leads_processed(self, lead_ids: list) -> bool:
        """Mark leads as processed (won't be selected again)"""
        try:
            self.db.table("scraped_data").update({
                "email_processed": True
            }).in_("id", lead_ids).execute()
            
            logger.info(f"✅ Marked {len(lead_ids)} leads as processed")
            return True
            
        except Exception as e:
            logger.error(f"Error marking leads as processed: {e}")
            return False
    
    def record_send_completion(self, batch_offset: int, leads_processed: int, emails_sent: int) -> bool:
        """
        Record that emails were sent today.
        This prevents sending again until tomorrow.
        """
        today = date.today()
        
        try:
            record = {
                "last_send_date": str(today),
                "batch_offset": batch_offset,
                "leads_processed": leads_processed,
                "emails_sent": emails_sent
            }
            
            # Insert today's record
            self.db.table("daily_email_tracking").insert(record).execute()
            
            logger.info(f"📊 Recorded send completion: Batch {batch_offset}, {leads_processed} leads processed, {emails_sent} emails sent")
            return True
            
        except Exception as e:
            logger.error(f"Error recording send completion: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get overall statistics"""
        try:
            # Total processed leads
            processed_result = self.db.table("scraped_data").select("id", count="exact").eq("email_processed", True).execute()
            total_processed = processed_result.count if processed_result.count else 0
            
            # Total leads
            total_result = self.db.table("scraped_data").select("id", count="exact").execute()
            total_leads = total_result.count if total_result.count else 0
            
            # Remaining
            remaining = total_leads - total_processed
            
            # Last send info
            last_send = self.db.table("daily_email_tracking").select("*").order("last_send_date", desc=True).limit(1).execute()
            
            return {
                "total_leads": total_leads,
                "total_processed": total_processed,
                "remaining_leads": remaining,
                "last_send_date": last_send.data[0].get("last_send_date") if last_send.data else None,
                "last_batch_offset": last_send.data[0].get("batch_offset") if last_send.data else None
            }
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}
