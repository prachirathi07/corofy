"""
Service for managing follow-up emails (5-day and 10-day)
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.services.email_sending_service import EmailSendingService
from app.services.timezone_service import TimezoneService
from app.core.database import SupabaseClient
import logging

logger = logging.getLogger(__name__)

class FollowUpService:
    """
    Service for scheduling and managing follow-up emails
    """
    
    def __init__(self):
        self.db = SupabaseClient.get_client()
        self._email_sending_service = None
        self.timezone_service = TimezoneService()
    
    @property
    def email_sending_service(self):
        """Lazy load email sending service"""
        if self._email_sending_service is None:
            try:
                self._email_sending_service = EmailSendingService(self.db)
            except ValueError:
                # Gmail not configured - will handle gracefully
                pass
        return self._email_sending_service
    
    async def schedule_followups_for_sent_email(self, email_sent_id: str) -> Dict[str, Any]:
        """
        Schedule 5-day and 10-day follow-ups for a sent email
        
        Args:
            email_sent_id: UUID of the sent email
        
        Returns:
            Dict with follow-up scheduling status
        """
        try:
            # Get the sent email
            email_result = self.db.table("emails_sent").select("*").eq("id", email_sent_id).execute()
            
            if not email_result.data or len(email_result.data) == 0:
                return {
                    "success": False,
                    "error": "Email not found"
                }
            
            email_sent = email_result.data[0]
            lead_id = email_sent.get("lead_id")
            sent_at_str = email_sent.get("sent_at")
            
            if not sent_at_str:
                return {
                    "success": False,
                    "error": "Email sent_at timestamp not found"
                }
            
            # Parse sent_at timestamp
            try:
                sent_at = datetime.fromisoformat(sent_at_str.replace('Z', '+00:00'))
            except:
                sent_at = datetime.fromisoformat(sent_at_str)
            
            # Calculate follow-up dates
            followup_5day_date = (sent_at + timedelta(days=5)).date()
            followup_10day_date = (sent_at + timedelta(days=10)).date()
            
            # Check if follow-ups already exist
            existing_followups = self.db.table("follow_ups").select("*").eq("email_sent_id", email_sent_id).execute()
            existing_types = [f.get("followup_type") for f in existing_followups.data]
            
            scheduled = []
            
            # Schedule 5-day follow-up
            if "5day" not in existing_types:
                followup_5day = {
                    "email_sent_id": email_sent_id,
                    "lead_id": lead_id,
                    "followup_type": "5day",
                    "scheduled_date": followup_5day_date.isoformat(),
                    "status": "pending"
                }
                
                result = self.db.table("follow_ups").insert(followup_5day).execute()
                scheduled.append({
                    "type": "5day",
                    "scheduled_date": followup_5day_date.isoformat(),
                    "id": result.data[0]["id"] if result.data else None
                })
                logger.info(f"Scheduled 5-day follow-up for email {email_sent_id}")
            
            # Schedule 10-day follow-up
            if "10day" not in existing_types:
                followup_10day = {
                    "email_sent_id": email_sent_id,
                    "lead_id": lead_id,
                    "followup_type": "10day",
                    "scheduled_date": followup_10day_date.isoformat(),
                    "status": "pending"
                }
                
                result = self.db.table("follow_ups").insert(followup_10day).execute()
                scheduled.append({
                    "type": "10day",
                    "scheduled_date": followup_10day_date.isoformat(),
                    "id": result.data[0]["id"] if result.data else None
                })
                logger.info(f"Scheduled 10-day follow-up for email {email_sent_id}")
            
            return {
                "success": True,
                "email_sent_id": email_sent_id,
                "scheduled_followups": scheduled
            }
        
        except Exception as e:
            logger.error(f"Error scheduling follow-ups: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_due_followups(self) -> Dict[str, Any]:
        """
        Process follow-ups that are due today and haven't been sent
        Checks timezone before sending - only sends during business hours (Mon-Fri, 9 AM-7 PM) in lead's timezone
        
        Returns:
            Dict with processing results
        """
        try:
            today = datetime.utcnow().date().isoformat()
            
            # Get pending follow-ups due today or earlier
            due_followups = self.db.table("follow_ups").select("*").eq("status", "pending").lte("scheduled_date", today).execute()
            
            if not due_followups.data:
                return {
                    "success": True,
                    "processed": 0,
                    "failed": 0,
                    "skipped_timezone": 0,
                    "message": "No follow-ups due"
                }
            
            processed = 0
            failed = 0
            skipped_timezone = 0
            
            for followup in due_followups.data:
                followup_id = followup["id"]
                lead_id = followup["lead_id"]
                followup_type = followup["followup_type"]
                email_sent_id = followup["email_sent_id"]
                
                # Check if lead has already replied
                reply_check = self.db.table("email_replies").select("*").eq("email_sent_id", email_sent_id).execute()
                
                if reply_check.data and len(reply_check.data) > 0:
                    # Lead has replied - cancel follow-up
                    self.db.table("follow_ups").update({
                        "status": "replied",
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", followup_id).execute()
                    logger.info(f"Follow-up {followup_id} cancelled - lead has replied")
                    continue
                
                # Get lead data to check timezone
                lead_result = self.db.table("leads").select("company_country").eq("id", lead_id).execute()
                if not lead_result.data:
                    logger.warning(f"Lead {lead_id} not found for follow-up {followup_id}")
                    failed += 1
                    continue
                
                company_country = lead_result.data[0].get("company_country")
                
                # Step 1: Check timezone - only proceed if it's Mon-Fri 9-7 in lead's timezone
                logger.info(f"🕐 Checking timezone for follow-up {followup_id} (type: {followup_type}, country: {company_country})")
                timezone_check = self.timezone_service.check_lead_business_hours(
                    country=company_country,
                    start_hour=9,
                    end_hour=19  # 7 PM
                )
                
                is_business_hours = timezone_check.get("is_business_hours", False)
                
                if not is_business_hours:
                    reason = timezone_check.get("reason", "Unknown reason")
                    logger.info(f"⏸️ Follow-up {followup_id} ({followup_type}) - Not in business hours: {reason} ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                    logger.info(f"📅 Follow-up {followup_id} will be checked again in next scheduler run (every 3 hours)")
                    skipped_timezone += 1
                    # Don't update status - keep as "pending" so it will be checked again
                    continue
                
                logger.info(f"✅ Follow-up {followup_id} ({followup_type}) is in business hours ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                
                # Check if email sending service is available
                if not self.email_sending_service:
                    logger.warning("Email sending service not available. Skipping follow-up processing.")
                    return {
                        "success": False,
                        "error": "Email sending service not configured (Gmail credentials required)"
                    }
                
                try:
                    # Send follow-up email
                    email_type = f"followup_{followup_type}"
                    result = await self.email_sending_service.send_email_to_lead(
                        lead_id=lead_id,
                        email_type=email_type
                    )
                    
                    if result.get("success"):
                        # Update follow-up status
                        update_data = {
                            "status": "sent",
                            "updated_at": datetime.utcnow().isoformat()
                        }
                        
                        # If email was queued, store queue ID
                        if result.get("scheduled") and result.get("queue_id"):
                            update_data["email_queue_id"] = result.get("queue_id")
                        
                        self.db.table("follow_ups").update(update_data).eq("id", followup_id).execute()
                        processed += 1
                        logger.info(f"✅ Follow-up {followup_id} ({followup_type}) sent successfully")
                    else:
                        # Mark as failed
                        self.db.table("follow_ups").update({
                            "status": "failed",
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", followup_id).execute()
                        failed += 1
                        logger.error(f"❌ Failed to send follow-up {followup_id} ({followup_type}): {result.get('error')}")
                
                except Exception as e:
                    logger.error(f"Error processing follow-up {followup_id}: {e}", exc_info=True)
                    self.db.table("follow_ups").update({
                        "status": "failed",
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", followup_id).execute()
                    failed += 1
            
            logger.info(f"📊 Follow-up processing completed: {processed} sent, {failed} failed, {skipped_timezone} skipped (timezone)")
            
            return {
                "success": True,
                "processed": processed,
                "failed": failed,
                "skipped_timezone": skipped_timezone,
                "total": len(due_followups.data)
            }
        
        except Exception as e:
            logger.error(f"Error processing follow-ups: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_followups_for_lead(self, lead_id: str) -> List[Dict[str, Any]]:
        """
        Get all follow-ups for a lead
        
        Args:
            lead_id: Lead UUID
        
        Returns:
            List of follow-up records
        """
        try:
            result = self.db.table("follow_ups").select("*").eq("lead_id", lead_id).order("scheduled_date").execute()
            return result.data
        except Exception as e:
            logger.error(f"Error getting follow-ups for lead {lead_id}: {e}")
            return []
    
    def cancel_followup(self, followup_id: str) -> Dict[str, Any]:
        """
        Cancel a follow-up
        
        Args:
            followup_id: Follow-up UUID
        
        Returns:
            Dict with cancellation status
        """
        try:
            self.db.table("follow_ups").update({
                "status": "cancelled",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", followup_id).execute()
            
            return {
                "success": True,
                "message": "Follow-up cancelled"
            }
        except Exception as e:
            logger.error(f"Error cancelling follow-up {followup_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

