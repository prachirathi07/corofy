import logging
from datetime import date, datetime, timedelta
from typing import Dict, Optional
from supabase import Client

logger = logging.getLogger(__name__)

class DailyEmailQuotaService:
    """Service to manage daily email sending quota (400 emails/day)"""
    
    def __init__(self, db: Client, daily_limit: int = 400):
        self.db = db
        self.daily_limit = daily_limit
    
    def get_today_quota(self) -> Dict:
        """Get today's quota information"""
        today = date.today()
        
        try:
            # Try to get today's quota record
            result = self.db.table("daily_email_quota").select("*").eq("date", str(today)).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                # Create today's quota record
                new_quota = {
                    "date": str(today),
                    "emails_sent": 0,
                    "quota_limit": self.daily_limit
                }
                result = self.db.table("daily_email_quota").insert(new_quota).execute()
                return result.data[0] if result.data else new_quota
                
        except Exception as e:
            logger.error(f"Error getting today's quota: {e}")
            return {
                "date": str(today),
                "emails_sent": 0,
                "quota_limit": self.daily_limit
            }
    
    def get_remaining_quota(self) -> int:
        """Get remaining emails that can be sent today"""
        quota = self.get_today_quota()
        remaining = quota.get("quota_limit", self.daily_limit) - quota.get("emails_sent", 0)
        return max(0, remaining)
    
    def can_send_emails(self, count: int = 1) -> bool:
        """Check if we can send 'count' emails today"""
        remaining = self.get_remaining_quota()
        return remaining >= count
    
    def increment_sent_count(self, count: int = 1) -> bool:
        """Increment the sent email count for today"""
        today = date.today()
        
        try:
            quota = self.get_today_quota()
            new_count = quota.get("emails_sent", 0) + count
            
            self.db.table("daily_email_quota").update({
                "emails_sent": new_count
            }).eq("date", str(today)).execute()
            
            logger.info(f"📊 Daily quota updated: {new_count}/{self.daily_limit} emails sent today")
            return True
            
        except Exception as e:
            logger.error(f"Error incrementing sent count: {e}")
            return False
    
    def reset_if_needed(self) -> bool:
        """Reset quota if it's a new day (cleanup old records)"""
        try:
            # Delete records older than 7 days
            seven_days_ago = date.today() - timedelta(days=7)
            self.db.table("daily_email_quota").delete().lt("date", str(seven_days_ago)).execute()
            return True
        except Exception as e:
            logger.error(f"Error resetting quota: {e}")
            return False
    
    def get_next_batch_leads(self, batch_size: int = 400) -> list:
        """
        Get the next batch of leads that haven't been processed today.
        Returns up to batch_size leads that have valid emails and haven't been processed in today's batch.
        """
        today = date.today()
        
        try:
            # Get leads that:
            # 1. Have founder_email (not null/empty)
            # 2. Haven't been processed in today's batch OR were processed on a different day
            result = self.db.table("scraped_data").select("*").or_(
                f"email_batch_processed.is.null,email_batch_processed.eq.false,email_batch_date.neq.{today}"
            ).not_.is_("founder_email", "null").neq("founder_email", "").limit(batch_size).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error getting next batch leads: {e}")
            return []
    
    def mark_leads_as_processed(self, lead_ids: list) -> bool:
        """Mark leads as processed for today's batch"""
        today = date.today()
        
        try:
            self.db.table("scraped_data").update({
                "email_batch_processed": True,
                "email_batch_date": str(today)
            }).in_("id", lead_ids).execute()
            
            logger.info(f"✅ Marked {len(lead_ids)} leads as processed for {today}")
            return True
            
        except Exception as e:
            logger.error(f"Error marking leads as processed: {e}")
            return False
    
    def reset_daily_batch_flags(self) -> bool:
        """Reset all batch flags for a new day (call this at midnight or start of day)"""
        yesterday = date.today() - timedelta(days=1)
        
        try:
            # Reset flags for leads processed yesterday or earlier
            self.db.table("scraped_data").update({
                "email_batch_processed": False,
                "email_batch_date": None
            }).lte("email_batch_date", str(yesterday)).execute()
            
            logger.info(f"🔄 Reset batch flags for leads processed before {date.today()}")
            return True
            
        except Exception as e:
            logger.error(f"Error resetting batch flags: {e}")
            return False
