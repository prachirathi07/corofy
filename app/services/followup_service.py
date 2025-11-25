"""
Service for managing follow-up emails (5-day and 10-day)
Simplified to work with scraped_data table
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.services.email_sending_service import EmailSendingService
from app.services.timezone_service import TimezoneService
from app.core.database import SupabaseClient
import logging
import pytz

logger = logging.getLogger(__name__)

class FollowUpService:
    """
    Service for scheduling and managing follow-up emails
    Uses scraped_data table - stores follow-up dates directly in the lead record
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
    
    def schedule_followups_for_lead(self, lead_id: str, sent_at: datetime) -> Dict[str, Any]:
        """
        Schedule 5-day and 10-day follow-ups for a lead after initial email is sent
        Stores follow-up dates directly in scraped_data table
        
        Args:
            lead_id: Lead UUID
            sent_at: Datetime when initial email was sent
        
        Returns:
            Dict with follow-up scheduling status
        """
        try:
            # Calculate follow-up dates (5 and 10 days from sent_at)
            followup_5day_date = (sent_at + timedelta(days=5)).date()
            followup_10day_date = (sent_at + timedelta(days=10)).date()
            
            # Update scraped_data with follow-up dates
            # Note: followup_5_sent and followup_10_sent are TEXT columns, not boolean
            update_data = {
                "followup_5_scheduled_date": followup_5day_date.isoformat(),
                "followup_10_scheduled_date": followup_10day_date.isoformat(),
                "followup_5_sent": "false",  # TEXT field
                "followup_10_sent": "false"  # TEXT field
            }
            
            self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
            
            logger.info(f"📅 Scheduled follow-ups for lead {lead_id}: 5-day on {followup_5day_date}, 10-day on {followup_10day_date}")
            
            return {
                "success": True,
                "lead_id": lead_id,
                "followup_5day_date": followup_5day_date.isoformat(),
                "followup_10day_date": followup_10day_date.isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error scheduling follow-ups for lead {lead_id}: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_due_followups(self) -> Dict[str, Any]:
        """
        Process follow-ups that are due today and haven't been sent
        Checks timezone before sending - only sends during business hours (Mon-Sat, 9 AM-6 PM) in lead's timezone
        Uses scraped_data table directly
        
        Returns:
            Dict with processing results
        """
        try:
            today = datetime.utcnow().date().isoformat()
            
            # Get leads with due follow-ups:
            # - mail_status is "email_sent" (initial email sent, no reply yet)
            # - followup_5_scheduled_date <= today AND followup_5_sent = false
            # OR followup_10_scheduled_date <= today AND followup_10_sent = false
            # - mail_status is NOT "reply_received" (no reply yet)
            
            # Query for 5-day follow-ups due
            # Look for leads where initial email was sent but 5-day follow-up hasn't been sent yet
            # mail_status should be 'email_sent' (not 'followup_5day_sent' or 'followup_10day_sent')
            leads_5day = (
                self.db.table("scraped_data")
                .select("*")
                .eq("mail_status", "email_sent")  # Initial email sent, 5-day not sent yet
                .or_("followup_5_sent.is.null,followup_5_sent.eq.false")  # Backward compatibility check
                .not_.is_("followup_5_scheduled_date", "null")
                .lte("followup_5_scheduled_date", today)
                .execute()
            )
            
            # Query for 10-day follow-ups due
            # Look for leads where 5-day follow-up was sent but 10-day follow-up hasn't been sent yet
            # mail_status should be 'followup_5day_sent' (not 'followup_10day_sent')
            leads_10day = (
                self.db.table("scraped_data")
                .select("*")
                .eq("mail_status", "followup_5day_sent")  # 5-day sent, 10-day not sent yet
                .or_("followup_10_sent.is.null,followup_10_sent.eq.false")  # Backward compatibility check
                .not_.is_("followup_10_scheduled_date", "null")
                .lte("followup_10_scheduled_date", today)
                .execute()
            )
            
            all_due_leads = []
            
            # Process 5-day follow-ups
            for lead in leads_5day.data:
                if lead.get("mail_status") != "reply_received":  # Double check no reply
                    all_due_leads.append({
                        "lead": lead,
                        "followup_type": "5day"
                    })
            
            # Process 10-day follow-ups
            for lead in leads_10day.data:
                if lead.get("mail_status") != "reply_received":  # Double check no reply
                    all_due_leads.append({
                        "lead": lead,
                        "followup_type": "10day"
                    })
            
            if not all_due_leads:
                return {
                    "success": True,
                    "processed": 0,
                    "failed": 0,
                    "skipped_timezone": 0,
                    "skipped_replied": 0,
                    "message": "No follow-ups due"
                }
            
            processed = 0
            failed = 0
            skipped_timezone = 0
            skipped_replied = 0
            
            for item in all_due_leads:
                lead = item["lead"]
                lead_id = lead["id"]
                followup_type = item["followup_type"]
                
                # Check if lead has replied (mail_status changed)
                mail_status = lead.get("mail_status", "")
                if mail_status == "reply_received":
                    logger.info(f"⏭️ Skipping follow-up for lead {lead_id} - lead has replied (mail_status: {mail_status})")
                    # Mark follow-up as cancelled (mail_status already set to reply_received, just update sent flags)
                    if followup_type == "5day":
                        self.db.table("scraped_data").update({"followup_5_sent": "cancelled"}).eq("id", lead_id).execute()
                    else:
                        self.db.table("scraped_data").update({"followup_10_sent": "cancelled"}).eq("id", lead_id).execute()
                    skipped_replied += 1
                    continue
                
                # Get company country for timezone check
                company_country = lead.get("company_country")
                
                # Check timezone - only proceed if it's Mon-Sat 9-6 in lead's timezone
                logger.info(f"🕐 Checking timezone for follow-up (type: {followup_type}, lead: {lead_id}, country: {company_country})")
                timezone_check = self.timezone_service.check_lead_business_hours(
                    country=company_country,
                    start_hour=9,
                    end_hour=18  # 6 PM
                )
                
                is_business_hours = timezone_check.get("is_business_hours", False)
                
                if not is_business_hours:
                    reason = timezone_check.get("reason", "Unknown reason")
                    logger.info(f"⏸️ Follow-up {followup_type} for lead {lead_id} - Not in business hours: {reason} ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                    logger.info(f"📅 Will be checked again in next scheduler run")
                    skipped_timezone += 1
                    # Don't update status - keep as pending so it will be checked again
                    continue
                
                logger.info(f"✅ Follow-up {followup_type} for lead {lead_id} is in business hours ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                
                # Check if email sending service is available
                if not self.email_sending_service:
                    logger.warning("Email sending service not available. Skipping follow-up processing.")
                    return {
                        "success": False,
                        "error": "Email sending service not configured"
                    }
                
                try:
                    # Send follow-up email
                    email_type = f"followup_{followup_type}"
                    result = await self.email_sending_service.send_email_to_lead(
                        lead_id=lead_id,
                        email_type=email_type
                    )
                    
                    if result.get("success"):
                        # Update mail_status and follow-up tracking
                        update_data = {}
                        if followup_type == "5day":
                            update_data["mail_status"] = "followup_5day_sent"
                            update_data["followup_5_sent"] = "true"  # Keep for backward compatibility
                            logger.info(f"✅ 5-day follow-up sent successfully for lead {lead_id}")
                        elif followup_type == "10day":
                            update_data["mail_status"] = "followup_10day_sent"
                            update_data["followup_10_sent"] = "true"  # Keep for backward compatibility
                            logger.info(f"✅ 10-day follow-up sent successfully for lead {lead_id}")
                        
                        # Update gmail_thread_id if returned from webhook
                        webhook_response = result.get("webhook_response", {})
                        if webhook_response:
                            if webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id"):
                                update_data["gmail_thread_id"] = webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id")
                            if webhook_response.get("message_id"):
                                update_data["gmail_message_id"] = webhook_response.get("message_id")
                        
                        self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
                        
                        processed += 1
                        logger.info(f"✅ Follow-up {followup_type} sent successfully for lead {lead_id} - Status: {update_data.get('mail_status')}")
                    else:
                        failed += 1
                        logger.error(f"❌ Failed to send follow-up {followup_type} for lead {lead_id}: {result.get('error')}")
                
                except Exception as e:
                    logger.error(f"Error processing follow-up {followup_type} for lead {lead_id}: {e}", exc_info=True)
                    failed += 1
            
            logger.info(f"📊 Follow-up processing completed: {processed} sent, {failed} failed, {skipped_timezone} skipped (timezone), {skipped_replied} skipped (replied)")
            
            return {
                "success": True,
                "processed": processed,
                "failed": failed,
                "skipped_timezone": skipped_timezone,
                "skipped_replied": skipped_replied,
                "total": len(all_due_leads)
            }
        
        except Exception as e:
            logger.error(f"Error processing follow-ups: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_followups_for_lead(self, lead_id: str) -> Dict[str, Any]:
        """
        Get follow-up information for a lead
        
        Args:
            lead_id: Lead UUID
        
        Returns:
            Dict with follow-up dates and status
        """
        try:
            result = self.db.table("scraped_data").select(
                "id, followup_5_scheduled_date, followup_10_scheduled_date, followup_5_sent, followup_10_sent, mail_status, sent_at"
            ).eq("id", lead_id).execute()
            
            if not result.data:
                return {}
            
            lead = result.data[0]
            return {
                "lead_id": lead_id,
                "followup_5day": {
                    "scheduled_date": lead.get("followup_5_scheduled_date"),
                    "sent": lead.get("followup_5_sent") == "true" or lead.get("followup_5_sent") is True
                },
                "followup_10day": {
                    "scheduled_date": lead.get("followup_10_scheduled_date"),
                    "sent": lead.get("followup_10_sent") == "true" or lead.get("followup_10_sent") is True
                },
                "mail_status": lead.get("mail_status"),
                "sent_at": lead.get("sent_at")
            }
        except Exception as e:
            logger.error(f"Error getting follow-ups for lead {lead_id}: {e}")
            return {}
    
    def cancel_followups_for_lead(self, lead_id: str) -> Dict[str, Any]:
        """
        Cancel all follow-ups for a lead (e.g., when they reply)
        
        Args:
            lead_id: Lead UUID
        
        Returns:
            Dict with cancellation status
        """
        try:
            # Mark both follow-ups as cancelled
            # Note: These are TEXT fields, use "cancelled"
            # mail_status should already be "reply_received" if called from reply service
            self.db.table("scraped_data").update({
                "followup_5_sent": "cancelled",  # TEXT field
                "followup_10_sent": "cancelled"  # TEXT field
            }).eq("id", lead_id).execute()
            
            logger.info(f"✅ Cancelled all follow-ups for lead {lead_id}")
            
            return {
                "success": True,
                "message": "Follow-ups cancelled"
            }
        except Exception as e:
            logger.error(f"Error cancelling follow-ups for lead {lead_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
