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
            # Check if we already sent today by looking at sent_at in scraped_data
            # We check if any email was sent today
            # Note: Supabase/PostgREST doesn't support date casting easily in select, 
            # so we check for sent_at >= today's start
            today_start = f"{today}T00:00:00"
            
            result = self.db.table("scraped_data") \
                .select("id", count="exact") \
                .gte("sent_at", today_start) \
                .limit(1) \
                .execute()
            
            sent_today_count = result.count if result.count else 0
            
            if sent_today_count > 0:
                # Already sent today
                return {
                    "can_send": False,
                    "reason": f"Emails already sent today ({sent_today_count} emails sent). Try again tomorrow.",
                    "last_send_date": today,
                    "next_batch_offset": 0 # Not used anymore
                }
            else:
                return {
                    "can_send": True,
                    "reason": "Ready to send",
                    "last_send_date": None,
                    "next_batch_offset": 0
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
        Returns leads that:
        - Are verified (is_verified = true)
        - Haven't been sent yet (mail_status not in ['sent', 'email_sent'])
        - Have valid email addresses
        - Haven't been processed yet (email_processed = false/null)
        """
        try:
            # Get unprocessed, verified leads with valid emails that haven't been sent
            result = self.db.table("scraped_data") \
                .select("*") \
                .eq("is_verified", True) \
                .is_("email_processed", "null") \
                .neq("mail_status", "processing") \
                .not_.is_("founder_email", "null") \
                .neq("founder_email", "") \
                .not_.in_("mail_status", ["email_sent", "reply_received", "followup_10day_sent", "processing"]) \
                .limit(self.batch_size) \
                .execute()
            
            # If no null records, try false records
            if not result.data or len(result.data) == 0:
                result = self.db.table("scraped_data") \
                    .select("*") \
                    .eq("is_verified", True) \
                    .eq("email_processed", False) \
                    .neq("mail_status", "processing") \
                    .not_.is_("founder_email", "null") \
                    .neq("founder_email", "") \
                    .not_.in_("mail_status", ["email_sent", "reply_received", "followup_10day_sent", "processing"]) \
                    .limit(self.batch_size) \
                    .execute()
            
            leads = result.data if result.data else []
            
            if leads:
                # LOCK LEADS IMMEDIATELY - Use mail_status instead of status
                lead_ids = [l["id"] for l in leads]
                self.db.table("scraped_data").update({"mail_status": "processing"}).in_("id", lead_ids).execute()
                logger.info(f"🔒 Locked {len(leads)} verified, unsent leads for processing")
            else:
                logger.info("📭 No verified, unsent leads found")
                
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
        No longer uses daily_email_tracking table.
        Just logs the completion as scraped_data is updated individually.
        """
        logger.info(f"📊 Batch completion: {leads_processed} leads processed, {emails_sent} emails sent")
        return True
    
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
            
            # Last send info - get max sent_at
            last_send_result = self.db.table("scraped_data") \
                .select("sent_at") \
                .not_.is_("sent_at", "null") \
                .order("sent_at", desc=True) \
                .limit(1) \
                .execute()
            
            last_send_date = None
            if last_send_result.data:
                last_send_date = last_send_result.data[0].get("sent_at")
            
            return {
                "total_leads": total_leads,
                "total_processed": total_processed,
                "remaining_leads": remaining,
                "last_send_date": last_send_date,
                "last_batch_offset": 0
            }
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}
