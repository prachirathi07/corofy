"""
Service for sending emails and managing email queue
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.services.webhook_service import WebhookService
from app.services.email_personalization_service import EmailPersonalizationService
from app.services.timezone_service import TimezoneService
from supabase import Client
import logging
import pytz

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
    
    async def send_email_to_lead(
        self,
        lead_id: str,
        email_type: str = "initial",
        schedule_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        try:
            # Fetch lead
            lead_result = self.db.table("leads").select("*").eq("id", lead_id).execute()
            if not lead_result.data:
                return {"success": False, "error": "Lead not found"}

            lead = lead_result.data[0]

            # TEST EMAIL OVERRIDE
            lead_email = "prachirathi0712@gmail.com"

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
                company_website_used=company_website_used
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
        company_website_used: bool = False
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
                email_type=email_type
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

            # Only create email record if email was successfully sent
            email_sent_id = None
            if email_sent:
                # Create email record with status "SENT"
                insert_data = {
                    "lead_id": lead_id,
                    "email_to": lead_email,
                    "email_subject": subject,
                    "email_body": body,
                    "email_type": email_type,
                    "is_personalized": is_personalized,
                    "company_website_used": company_website_used,
                    "sent_at": sent_at_time,
                    "status": "SENT"
                }
                # Only add webhook response fields if they exist
                if webhook_response and isinstance(webhook_response, dict):
                    if webhook_response.get("message_id"):
                        insert_data["gmail_message_id"] = webhook_response.get("message_id")
                    if webhook_response.get("thread_id"):
                        insert_data["gmail_thread_id"] = webhook_response.get("thread_id")
                
                result_insert = self.db.table("emails_sent").insert(insert_data).execute()
                email_sent_id = result_insert.data[0]["id"] if result_insert.data else None

            # Update lead status only if email was successfully sent
            if email_sent:
                self.db.table("leads").update({"status": "email_sent"}).eq("id", lead_id).execute()
                logger.info(f"✅ Email sent successfully via webhook to {lead_email} (Lead: {lead_id}) - Status: SENT")
            else:
                logger.warning(f"❌ Email sending failed via webhook for {lead_email} (Lead: {lead_id}): {webhook_result.get('error')} - No record created")

            return {
                "success": email_sent,
                "webhook_response": webhook_response,
                "sent_at": sent_at_time if email_sent else None,
                "scheduled": False,
                "email_sent_id": email_sent_id,
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
        
        Args:
            lead_id: Lead UUID
            email_type: Type of email
            company_country: Lead's country for timezone calculation
        
        Returns:
            Dict with queue status
        """
        try:
            # Fetch lead
            lead_result = self.db.table("leads").select("*").eq("id", lead_id).execute()
            if not lead_result.data:
                return {"success": False, "error": "Lead not found"}

            lead = lead_result.data[0]
            test_email = "prachirathi0712@gmail.com"
            
            # Generate email content
            email_content = await self.email_personalization_service.generate_email_for_lead(
                lead_id=lead_id,
                email_type=email_type
            )
            
            if not email_content.get("success"):
                return {"success": False, "error": email_content.get("error", "Failed to generate email")}
            
            subject = email_content.get("subject")
            body = email_content.get("body")
            
            # Calculate next business hours time (next weekday 9 AM in lead's timezone)
            timezone = self.timezone_service.get_timezone_for_country(company_country)
            tz = pytz.timezone(timezone)
            now = datetime.now(tz)
            
            # Find next business hours (Mon-Fri 9 AM)
            days_ahead = 0
            if now.weekday() >= 5:  # Saturday or Sunday
                days_ahead = 7 - now.weekday()  # Days until Monday
            elif now.hour >= 19:  # After 7 PM, schedule for next day
                days_ahead = 1
            
            # Calculate scheduled time
            scheduled_time = (now + timedelta(days=days_ahead))
            scheduled_time = scheduled_time.replace(hour=9, minute=0, second=0, microsecond=0)
            
            # If it's a weekend, move to Monday
            if scheduled_time.weekday() >= 5:
                days_until_monday = 7 - scheduled_time.weekday()
                scheduled_time = (scheduled_time + timedelta(days=days_until_monday)).replace(hour=9, minute=0, second=0, microsecond=0)
            
            # Ensure timezone is preserved
            if scheduled_time.tzinfo is None:
                scheduled_time = tz.localize(scheduled_time)
            
            # Insert into email_queue
            queue_data = {
                "lead_id": lead_id,
                "email_to": test_email,
                "email_subject": subject,
                "email_body": body,
                "email_type": email_type,
                "scheduled_time": scheduled_time.isoformat(),
                "timezone": timezone,
                "status": "pending",
                "priority": 0
            }
            
            queue_result = self.db.table("email_queue").insert(queue_data).execute()
            
            logger.info(f"✅ Email queued for lead {lead_id} - Scheduled for {scheduled_time} ({timezone})")
            
            return {
                "success": True,
                "queue_id": queue_result.data[0]["id"] if queue_result.data else None,
                "scheduled_time": scheduled_time.isoformat(),
                "timezone": timezone,
                "message": f"Email queued for {scheduled_time.strftime('%Y-%m-%d %H:%M')} ({timezone})"
            }
            
        except Exception as e:
            logger.error(f"Error queueing email for lead {lead_id}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def process_email_queue(self) -> Dict[str, Any]:
        """
        Process pending emails in the queue that are ready to send
        Checks if it's business hours in each lead's timezone and sends if ready
        
        Returns:
            Dict with processing results
        """
        try:
            logger.info("🔄 Processing email queue...")
            
            # Get all pending emails from queue
            queue_result = (
                self.db.table("email_queue")
                .select("*")
                .eq("status", "pending")
                .execute()
            )
            
            if not queue_result.data:
                logger.info("📭 No pending emails in queue")
                return {
                    "success": True,
                    "processed": 0,
                    "sent": 0,
                    "skipped": 0,
                    "failed": 0
                }
            
            pending_emails = queue_result.data
            logger.info(f"📬 Found {len(pending_emails)} pending emails in queue")
            
            processed = 0
            sent = 0
            skipped = 0
            failed = 0
            
            for queue_item in pending_emails:
                try:
                    queue_id = queue_item["id"]
                    lead_id = queue_item["lead_id"]
                    scheduled_time_str = queue_item["scheduled_time"]
                    timezone = queue_item.get("timezone", "UTC")
                    
                    # Parse scheduled time
                    scheduled_time = datetime.fromisoformat(scheduled_time_str.replace('Z', '+00:00'))
                    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
                    
                    # Check if scheduled time has passed
                    if scheduled_time.replace(tzinfo=pytz.UTC) > now_utc:
                        logger.info(f"⏰ Email {queue_id} not ready yet (scheduled: {scheduled_time})")
                        skipped += 1
                        continue
                    
                    # Check if it's business hours in the lead's timezone
                    tz = pytz.timezone(timezone)
                    now_local = datetime.now(tz)
                    day_of_week = now_local.weekday()
                    current_hour = now_local.hour
                    
                    is_weekday = day_of_week < 5
                    is_business_hours = is_weekday and 9 <= current_hour < 19
                    
                    if not is_business_hours:
                        reason = "weekend" if not is_weekday else f"outside hours ({current_hour}:00)"
                        logger.info(f"⏸️ Email {queue_id} - Not in business hours: {reason} ({timezone})")
                        skipped += 1
                        continue
                    
                    # It's business hours - send the email
                    logger.info(f"📧 Sending queued email {queue_id} for lead {lead_id}")
                    
                    # Update queue status to "sending"
                    self.db.table("email_queue").update({"status": "sending"}).eq("id", queue_id).execute()
                    
                    # Send email via webhook
                    webhook_result = await self.webhook_service.send_email_via_webhook(
                        email_to=queue_item["email_to"],
                        subject=queue_item["email_subject"],
                        body=queue_item["email_body"],
                        lead_id=str(lead_id),
                        email_type=queue_item["email_type"]
                    )
                    
                    email_sent = webhook_result.get("success", False) if webhook_result else False
                    webhook_response = webhook_result.get("webhook_response") or {} if webhook_result else {}
                    
                    if email_sent:
                        # Update queue status to "sent"
                        sent_at = datetime.utcnow().isoformat()
                        self.db.table("email_queue").update({
                            "status": "sent",
                            "sent_at": sent_at
                        }).eq("id", queue_id).execute()
                        
                        # Create email record in emails_sent table with status "SENT"
                        email_insert_data = {
                            "lead_id": lead_id,
                            "email_to": queue_item["email_to"],
                            "email_subject": queue_item["email_subject"],
                            "email_body": queue_item["email_body"],
                            "email_type": queue_item["email_type"],
                            "sent_at": sent_at,
                            "status": "SENT"
                        }
                        # Add Gmail tracking IDs if available
                        if webhook_response and isinstance(webhook_response, dict):
                            if webhook_response.get("message_id"):
                                email_insert_data["gmail_message_id"] = webhook_response.get("message_id")
                            if webhook_response.get("thread_id"):
                                email_insert_data["gmail_thread_id"] = webhook_response.get("thread_id")
                        
                        self.db.table("emails_sent").insert(email_insert_data).execute()
                        
                        # Update lead status
                        self.db.table("leads").update({"status": "email_sent"}).eq("id", lead_id).execute()
                        
                        logger.info(f"✅ Queued email {queue_id} sent successfully - Status: SENT")
                        sent += 1
                    else:
                        # Update queue status to "failed"
                        error_msg = webhook_result.get("error", "Unknown error") if webhook_result else "Webhook returned None"
                        self.db.table("email_queue").update({
                            "status": "failed",
                            "error_message": error_msg
                        }).eq("id", queue_id).execute()
                        
                        logger.warning(f"❌ Failed to send queued email {queue_id}: {error_msg}")
                        failed += 1
                    
                    processed += 1
                    
                except Exception as e:
                    logger.error(f"❌ Error processing queue item {queue_item.get('id')}: {e}", exc_info=True)
                    failed += 1
                    # Mark as failed
                    try:
                        self.db.table("email_queue").update({
                            "status": "failed",
                            "error_message": str(e)
                        }).eq("id", queue_item.get("id")).execute()
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
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": error_msg,
                "processed": 0,
                "sent": 0,
                "skipped": 0,
                "failed": 0
            }
