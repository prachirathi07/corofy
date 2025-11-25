"""
Service for sending emails and managing email queue
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.services.webhook_service import WebhookService
from app.services.email_personalization_service import EmailPersonalizationService
from app.services.timezone_service import TimezoneService
from app.services.dead_letter_queue_service import DeadLetterQueueService
from supabase import Client
import logging
import pytz
import asyncio

logger = logging.getLogger(__name__)

class EmailSendingService:
    """
    Service for sending emails via n8n webhook and managing the email queue
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.webhook_service = WebhookService()
        self.email_personalization_service = EmailPersonalizationService(db)
        self.timezone_service = TimezoneService()
        self.dlq_service = DeadLetterQueueService(db)
    
    async def send_email_to_lead(
        self,
        lead_id: str,
        email_type: str = "initial",
        schedule_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        try:
            # Fetch lead
            lead_result = self.db.table("scraped_data").select("*").eq("id", lead_id).execute()
            if not lead_result.data:
                return {"success": False, "error": "Lead not found"}

            lead = lead_result.data[0]

            # TEST EMAIL OVERRIDE
            lead_email = "prachirathi0712@gmail.com"

            # Get gmail_thread_id and gmail_message_id for follow-ups (to reply in same thread)
            gmail_thread_id = None
            gmail_message_id = None
            if email_type.startswith("followup_"):
                gmail_thread_id = lead.get("gmail_thread_id")
                gmail_message_id = lead.get("gmail_message_id")
                logger.info(f"🔍 Follow-up email: Checking for gmail_thread_id and message_id for lead {lead_id}")
                logger.info(f"   Email type: {email_type}")
                logger.info(f"   Retrieved gmail_thread_id: {gmail_thread_id}")
                logger.info(f"   Retrieved gmail_message_id: {gmail_message_id}")
                if not gmail_thread_id:
                    logger.warning(f"⚠️ Follow-up email requested for lead {lead_id} but no gmail_thread_id found. Will create new thread.")
                else:
                    logger.info(f"✅ Found gmail_thread_id {gmail_thread_id} for follow-up email")
                if not gmail_message_id:
                    logger.warning(f"⚠️ Follow-up email requested for lead {lead_id} but no gmail_message_id found.")
                else:
                    logger.info(f"✅ Found gmail_message_id {gmail_message_id} for follow-up email")

            # Generate email content
            email_content = await self.email_personalization_service.generate_email_for_lead(
                lead_id=lead_id,
                email_type=email_type
            )

            if not email_content.get("success"):
                return {"success": False, "error": email_content.get("error")}

            subject = email_content.get("subject")
            body = email_content.get("body")
            is_personalized = email_content.get("is_personalized", False)
            company_website_used = email_content.get("company_website_used", False)

            # Send immediately
            return await self._send_email_immediately(
                lead_id=lead_id,
                lead_email=lead_email,
                subject=subject,
                body=body,
                email_type=email_type,
                is_personalized=is_personalized,
                company_website_used=company_website_used,
                gmail_thread_id=gmail_thread_id,  # Pass gmail_thread_id for follow-ups
                gmail_message_id=gmail_message_id  # Pass gmail_message_id for follow-ups
            )

        except Exception as e:
            logger.error(f"Error sending email to lead {lead_id}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    

    async def _send_email_immediately(
        self,
        lead_id: str,
        lead_email: str,
        subject: str,
        body: str,
        email_type: str,
        is_personalized: bool = False,
        company_website_used: bool = False,
        gmail_thread_id: Optional[str] = None,
        gmail_message_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email via n8n webhook
        Sends email_id, subject, and body to webhook and receives confirmation
        """
        try:
            logger.info(f"📤 _send_email_immediately called for lead {lead_id}")
            logger.info(f"📧 Email to: {lead_email}")
            logger.info(f"📝 Subject: {subject[:100] if subject else 'None'}...")
            logger.info(f"📄 Body length: {len(body) if body else 0} characters")
            
            # Send email data to n8n webhook
            logger.info(f"🔄 About to call webhook_service.send_email_via_webhook...")
            webhook_result = await self.webhook_service.send_email_via_webhook(
                email_to=lead_email,
                subject=subject,
                body=body,
                lead_id=lead_id,
                email_type=email_type,
                gmail_thread_id=gmail_thread_id,  # Pass gmail_thread_id for follow-ups
                gmail_message_id=gmail_message_id  # Pass gmail_message_id for follow-ups
            )
            logger.info(f"🔄 Webhook service returned: {webhook_result}")

            # Safety check: ensure webhook_result is not None
            if webhook_result is None:
                logger.error(f"Webhook service returned None for {lead_email}")
                webhook_result = {"success": False, "error": "Webhook service returned None", "webhook_response": {}}

            # Check webhook response to confirm if email was sent
            email_sent = webhook_result.get("success", False) if webhook_result else False
            webhook_response = webhook_result.get("webhook_response") or {} if webhook_result else {}  # Ensure it's a dict, not None
            
            sent_at_time = datetime.utcnow().replace(tzinfo=pytz.UTC).isoformat()

            # Update lead status only if email was successfully sent
            if email_sent:
                # Set mail_status based on email_type
                if email_type == "initial":
                    status_value = "email_sent"
                elif email_type == "followup_5day":
                    status_value = "followup_5day_sent"
                elif email_type == "followup_10day":
                    status_value = "followup_10day_sent"
                else:
                    status_value = "email_sent"  # Default fallback
                
                update_data = {
                    "mail_status": status_value,
                    "sent_at": sent_at_time,
                    "is_personalized": is_personalized,
                    "company_website_used": company_website_used
                }
                
                # Add webhook response fields if they exist
                if webhook_response and isinstance(webhook_response, dict):
                    if webhook_response.get("message_id"):
                        update_data["gmail_message_id"] = webhook_response.get("message_id")
                    if webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id"):
                        update_data["gmail_thread_id"] = webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id")
                
                self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
                logger.info(f"✅ Email sent successfully via webhook to {lead_email} (Lead: {lead_id}) - Status: {status_value}")
                
                # Schedule follow-ups for initial emails only (not for follow-ups themselves)
                if email_type == "initial":
                    try:
                        from app.services.followup_service import FollowUpService
                        followup_service = FollowUpService()
                        sent_at_dt = datetime.fromisoformat(sent_at_time.replace('Z', '+00:00'))
                        followup_result = followup_service.schedule_followups_for_lead(lead_id, sent_at_dt)
                        if followup_result.get("success"):
                            logger.info(f"📅 Follow-ups scheduled for lead {lead_id}: 5-day and 10-day")
                        else:
                            logger.warning(f"⚠️ Failed to schedule follow-ups for lead {lead_id}: {followup_result.get('error')}")
                    except Exception as e:
                        logger.error(f"Error scheduling follow-ups for lead {lead_id}: {e}", exc_info=True)
            else:
                logger.warning(f"❌ Email sending failed via webhook for {lead_email} (Lead: {lead_id}): {webhook_result.get('error')} - No record created")
                # Add to DLQ if failed
                await self.dlq_service.add_failed_email(
                    lead_id=lead_id,
                    email_to=lead_email,
                    subject=subject,
                    body=body,
                    error=Exception(webhook_result.get("error", "Unknown error")),
                    error_type="webhook_error"
                )

            return {
                "success": email_sent,
                "webhook_response": webhook_response,
                "sent_at": sent_at_time if email_sent else None,
                "scheduled": False,
                "email_sent_id": None, # No separate ID anymore
                "message": webhook_result.get("message", "Email sent via webhook" if email_sent else "Email sending failed"),
                "error": webhook_result.get("error") if not email_sent else None
            }

        except Exception as e:
            logger.error(f"Error in _send_email_immediately: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def queue_email_for_lead(
        self,
        lead_id: str,
        email_type: str = "initial",
        company_country: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Queue an email for later sending when it's business hours in the lead's timezone
        Updates scraped_data with scheduled status
        """
        try:
            # Fetch lead
            lead_result = self.db.table("scraped_data").select("*").eq("id", lead_id).execute()
            if not lead_result.data:
                return {"success": False, "error": "Lead not found"}

            lead = lead_result.data[0]
            
            # Calculate next business hours time (Mon-Sat, 9 AM - 6 PM in lead's timezone)
            timezone = self.timezone_service.get_timezone_for_country(company_country)
            tz = pytz.timezone(timezone)
            now = datetime.now(tz)
            
            # Business hours: Mon-Sat (0-5), 9 AM - 6 PM
            # Find next available business hours slot
            days_ahead = 0
            scheduled_time = now.replace(second=0, microsecond=0)
            
            # If it's Sunday (6), move to Monday
            if now.weekday() == 6:  # Sunday
                days_ahead = 1
                scheduled_time = (now + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
            # If it's Saturday (5) and after 6 PM, move to Monday
            elif now.weekday() == 5 and now.hour >= 18:  # Saturday after 6 PM
                days_ahead = 2  # Skip Sunday, go to Monday
                scheduled_time = (now + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
            # If it's a weekday (Mon-Fri) and after 6 PM, schedule for next day at 9 AM
            elif now.weekday() < 5 and now.hour >= 18:  # Weekday after 6 PM
                days_ahead = 1
                scheduled_time = (now + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
            # If it's before 9 AM on a business day, schedule for 9 AM today
            elif now.weekday() < 6 and now.hour < 9:  # Business day before 9 AM
                scheduled_time = now.replace(hour=9, minute=0, second=0, microsecond=0)
            # If it's currently in business hours, schedule for next hour (or could send immediately, but we're queueing)
            else:
                # Schedule for next hour to give some buffer
                scheduled_time = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
                # If next hour is after 6 PM, schedule for next day at 9 AM
                if scheduled_time.hour >= 18:
                    days_ahead = 1
                    scheduled_time = (now + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
            
            # Ensure we don't schedule on Sunday
            if scheduled_time.weekday() == 6:  # Sunday
                days_until_monday = 1
                scheduled_time = (scheduled_time + timedelta(days=days_until_monday)).replace(hour=9, minute=0, second=0, microsecond=0)
            
            # Ensure timezone is preserved
            if scheduled_time.tzinfo is None:
                scheduled_time = tz.localize(scheduled_time)
            
            # Update scraped_data with scheduled info
            update_data = {
                "mail_status": "scheduled",
                "scheduled_time": scheduled_time.isoformat(),
                "email_timezone": timezone,
                "email_priority": 0
            }
            
            self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
            
            logger.info(f"✅ Email queued for lead {lead_id} - Scheduled for {scheduled_time} ({timezone})")
            
            return {
                "success": True,
                "queue_id": lead_id, # Using lead_id as queue_id since it's 1:1 now
                "scheduled_time": scheduled_time.isoformat(),
                "timezone": timezone,
                "message": f"Email queued for {scheduled_time.strftime('%Y-%m-%d %H:%M')} ({timezone})"
            }
            
        except Exception as e:
            logger.error(f"Error queueing email for lead {lead_id}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def process_email_queue(self) -> Dict[str, Any]:
        """
        Process pending emails in the queue (scraped_data with mail_status='scheduled')
        Checks if it's business hours in each lead's timezone and sends if ready
        """
        try:
            logger.info("🔄 Processing email queue...")
            
            # Get all scheduled emails
            # Using scraped_data directly
            queue_result = (
                self.db.table("scraped_data")
                .select("*")
                .eq("mail_status", "scheduled")
                .execute()
            )
            
            if not queue_result.data:
                logger.info("📭 No scheduled emails found")
                return {
                    "success": True,
                    "processed": 0,
                    "sent": 0,
                    "skipped": 0,
                    "failed": 0
                }
            
            pending_emails = queue_result.data
            logger.info(f"📬 Found {len(pending_emails)} scheduled emails")
            
            processed = 0
            sent = 0
            skipped = 0
            failed = 0
            
            for lead in pending_emails:
                try:
                    lead_id = lead["id"]
                    scheduled_time_str = lead.get("scheduled_time")
                    timezone = lead.get("email_timezone", "UTC")
                    
                    if not scheduled_time_str:
                        logger.warning(f"⚠️ Lead {lead_id} has scheduled status but no time. Skipping.")
                        skipped += 1
                        continue

                    # Parse scheduled time
                    scheduled_time = datetime.fromisoformat(scheduled_time_str.replace('Z', '+00:00'))
                    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
                    
                    # Check if scheduled time has passed
                    if scheduled_time.replace(tzinfo=pytz.UTC) > now_utc:
                        logger.info(f"⏰ Email for {lead_id} not ready yet (scheduled: {scheduled_time})")
                        skipped += 1
                        continue
                    
                    # Check if it's business hours in the lead's timezone
                    tz = pytz.timezone(timezone)
                    now_local = datetime.now(tz)
                    day_of_week = now_local.weekday()
                    current_hour = now_local.hour
                    
                    # Mon-Sat (0-5), exclude Sunday (6)
                    is_business_day = day_of_week < 6
                    # Business hours: 9 AM to 6 PM
                    is_business_hours = is_business_day and 9 <= current_hour < 18
                    
                    if not is_business_hours:
                        reason = "Sunday" if day_of_week == 6 else f"outside hours ({current_hour}:00)"
                        logger.info(f"⏸️ Email for {lead_id} - Not in business hours: {reason} ({timezone})")
                        skipped += 1
                        continue
                    
                    # It's business hours - send the email
                    logger.info(f"📧 Sending scheduled email for lead {lead_id}")
                    
                    # Update status to "sending"
                    self.db.table("scraped_data").update({"mail_status": "sending"}).eq("id", lead_id).execute()
                    
                    # Rate limiting: Wait 1.5 seconds before sending
                    await asyncio.sleep(1.5)
                    
                    # Generate email content (if not already stored - assuming dynamic generation for now)
                    # For scheduled emails, we might need to regenerate or store content. 
                    # Assuming we regenerate for freshness or use stored if available.
                    # For simplicity, let's regenerate or use what's available.
                    # The original code passed subject/body from queue. 
                    # Here we need to generate it.
                    
                    email_content = await self.email_personalization_service.generate_email_for_lead(
                        lead_id=lead_id,
                        email_type="initial" # Defaulting to initial for now
                    )
                    
                    if not email_content.get("success"):
                        raise Exception(f"Failed to generate email content: {email_content.get('error')}")

                    # Send email via webhook
                    # TEST EMAIL OVERRIDE
                    test_email = "prachirathi0712@gmail.com"
                    
                    webhook_result = await self.webhook_service.send_email_via_webhook(
                        email_to=test_email, # Using test email
                        subject=email_content.get("subject"),
                        body=email_content.get("body"),
                        lead_id=str(lead_id),
                        email_type="initial"
                    )
                    
                    email_sent = webhook_result.get("success", False) if webhook_result else False
                    webhook_response = webhook_result.get("webhook_response") or {} if webhook_result else {}
                    
                    if email_sent:
                        sent_at = datetime.utcnow().isoformat()
                        
                        update_data = {
                            "mail_status": "email_sent",
                            "sent_at": sent_at,
                            "is_personalized": email_content.get("is_personalized", False),
                            "company_website_used": email_content.get("company_website_used", False)
                        }
                        
                        if webhook_response.get("message_id"):
                            update_data["gmail_message_id"] = webhook_response.get("message_id")
                        if webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id"):
                            update_data["gmail_thread_id"] = webhook_response.get("gmail_thread_id") or webhook_response.get("thread_id")
                            
                        self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
                        
                        logger.info(f"✅ Scheduled email for {lead_id} sent successfully - Status: SENT")
                        sent += 1
                    else:
                        # Failed to send
                        error_msg = webhook_result.get("error", "Unknown error") if webhook_result else "Webhook returned None"
                        
                        # Update status to failed
                        self.db.table("scraped_data").update({
                            "mail_status": "failed",
                            "error_message": error_msg
                        }).eq("id", lead_id).execute()
                        
                        # Add to DLQ
                        await self.dlq_service.add_failed_email(
                            lead_id=lead_id,
                            email_to=test_email,
                            subject=email_content.get("subject"),
                            body=email_content.get("body"),
                            error=Exception(error_msg),
                            error_type="webhook_error"
                        )
                        
                        logger.warning(f"❌ Failed to send scheduled email for {lead_id}: {error_msg}")
                        failed += 1
                    
                    processed += 1
                    
                except Exception as e:
                    logger.error(f"❌ Error processing scheduled lead {lead.get('id')}: {e}", exc_info=True)
                    failed += 1
                    # Mark as failed
                    try:
                        self.db.table("scraped_data").update({
                            "mail_status": "failed",
                            "error_message": str(e)
                        }).eq("id", lead.get("id")).execute()
                    except:
                        pass
            
            logger.info(f"📊 Queue processing complete: {processed} processed, {sent} sent, {skipped} skipped, {failed} failed")
            
            return {
                "success": True,
                "processed": processed,
                "sent": sent,
                "skipped": skipped,
                "failed": failed
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error("=" * 80)
            logger.error(f"❌ CRITICAL ERROR processing email queue: {error_msg}", exc_info=True)
            logger.error("=" * 80)
            return {
                "success": False,
                "error": error_msg,
                "processed": 0,
                "sent": 0,
                "skipped": 0,
                "failed": 0
            }
