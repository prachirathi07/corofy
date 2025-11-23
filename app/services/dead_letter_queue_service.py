"""
Dead Letter Queue (DLQ) service for managing failed email attempts.
Automatically retries failed emails with exponential backoff.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from supabase import Client
import logging

logger = logging.getLogger(__name__)

class DeadLetterQueueService:
    """Service for managing failed email attempts and retries"""
    
    def __init__(self, db: Client):
        self.db = db
        self.max_attempts = 3
        self.retry_delays = [3600, 7200, 14400]  # 1h, 2h, 4h in seconds
    
    async def add_failed_email(
        self,
        lead_id: str,
        email_to: str,
        subject: str,
        body: str,
        error: Exception,
        error_type: str = "unknown"
    ) -> Optional[str]:
        """
        Add a failed email to the dead letter queue.
        
        Args:
            lead_id: Lead UUID
            email_to: Recipient email
            subject: Email subject
            body: Email body
            error: Exception that caused the failure
            error_type: Type of error (network, validation, api_error, etc.)
        
        Returns:
            DLQ entry ID or None if failed
        """
        try:
            # Calculate next retry time (1 hour from now for first attempt)
            next_retry = datetime.utcnow() + timedelta(seconds=self.retry_delays[0])
            
            dlq_data = {
                "lead_id": lead_id,
                "email_to": email_to,
                "subject": subject,
                "body": body,
                "error_message": str(error),
                "error_type": error_type,
                "attempt_count": 1,
                "max_attempts": self.max_attempts,
                "status": "pending",
                "next_retry_at": next_retry.isoformat()
            }
            
            result = self.db.table("failed_emails").insert(dlq_data).execute()
            dlq_id = result.data[0]["id"] if result.data else None
            
            logger.info(
                f"📥 Added failed email to DLQ: {email_to} "
                f"(Error: {error_type}, Retry at: {next_retry})"
            )
            
            return dlq_id
            
        except Exception as e:
            logger.error(f"Failed to add email to DLQ: {e}", exc_info=True)
            return None
    
    async def retry_failed_emails(self) -> Dict[str, Any]:
        """
        Retry all pending failed emails that are ready for retry.
        
        Returns:
            Dict with retry statistics
        """
        try:
            logger.info("🔄 Processing dead letter queue...")
            
            # Get emails ready for retry
            result = self.db.table("retry_ready_emails").select("*").execute()
            
            if not result.data:
                logger.info("📭 No emails ready for retry")
                return {
                    "success": True,
                    "processed": 0,
                    "succeeded": 0,
                    "failed": 0
                }
            
            retry_emails = result.data
            logger.info(f"📬 Found {len(retry_emails)} emails ready for retry")
            
            processed = 0
            succeeded = 0
            failed = 0
            
            # Import here to avoid circular dependency
            from app.services.email_sending_service import EmailSendingService
            email_service = EmailSendingService(self.db)
            
            for email_entry in retry_emails:
                try:
                    dlq_id = email_entry["id"]
                    lead_id = email_entry["lead_id"]
                    attempt_count = email_entry["attempt_count"]
                    
                    # Mark as retrying
                    self._update_status(dlq_id, "retrying")
                    
                    # Attempt to send email
                    result = await email_service._send_email_immediately(
                        lead_id=lead_id,
                        lead_email=email_entry["email_to"],
                        subject=email_entry["subject"],
                        body=email_entry["body"],
                        email_type="retry",
                        is_personalized=True,
                        company_website_used=True
                    )
                    
                    processed += 1
                    
                    if result.get("success"):
                        # Success - mark as resolved
                        self._mark_resolved(dlq_id)
                        succeeded += 1
                        logger.info(f"✅ DLQ retry succeeded: {email_entry['email_to']}")
                    else:
                        # Failed - increment attempt and schedule next retry
                        new_attempt_count = attempt_count + 1
                        
                        if new_attempt_count >= self.max_attempts:
                            # Max attempts reached - mark as permanently failed
                            self._mark_permanently_failed(dlq_id, result.get("error"))
                            failed += 1
                            logger.warning(
                                f"❌ DLQ max attempts reached: {email_entry['email_to']} "
                                f"({new_attempt_count}/{self.max_attempts})"
                            )
                        else:
                            # Schedule next retry with exponential backoff
                            delay_index = min(new_attempt_count - 1, len(self.retry_delays) - 1)
                            next_retry = datetime.utcnow() + timedelta(
                                seconds=self.retry_delays[delay_index]
                            )
                            
                            self._schedule_retry(
                                dlq_id,
                                new_attempt_count,
                                next_retry,
                                result.get("error")
                            )
                            failed += 1
                            logger.info(
                                f"⏳ DLQ retry failed, rescheduled: {email_entry['email_to']} "
                                f"(Attempt {new_attempt_count}/{self.max_attempts}, "
                                f"Next retry: {next_retry})"
                            )
                
                except Exception as e:
                    logger.error(f"Error retrying DLQ email {email_entry.get('id')}: {e}")
                    failed += 1
            
            logger.info(
                f"📊 DLQ processing complete: {processed} processed, "
                f"{succeeded} succeeded, {failed} failed"
            )
            
            return {
                "success": True,
                "processed": processed,
                "succeeded": succeeded,
                "failed": failed
            }
            
        except Exception as e:
            logger.error(f"Error processing DLQ: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "processed": 0,
                "succeeded": 0,
                "failed": 0
            }
    
    def _update_status(self, dlq_id: str, status: str):
        """Update DLQ entry status"""
        try:
            self.db.table("failed_emails").update({
                "status": status,
                "last_attempt_at": datetime.utcnow().isoformat()
            }).eq("id", dlq_id).execute()
        except Exception as e:
            logger.error(f"Error updating DLQ status: {e}")
    
    def _mark_resolved(self, dlq_id: str):
        """Mark DLQ entry as successfully resolved"""
        try:
            self.db.table("failed_emails").update({
                "status": "resolved",
                "resolved_at": datetime.utcnow().isoformat()
            }).eq("id", dlq_id).execute()
        except Exception as e:
            logger.error(f"Error marking DLQ as resolved: {e}")
    
    def _mark_permanently_failed(self, dlq_id: str, error_message: Optional[str]):
        """Mark DLQ entry as permanently failed (max attempts reached)"""
        try:
            update_data = {
                "status": "failed",
                "last_attempt_at": datetime.utcnow().isoformat()
            }
            if error_message:
                update_data["error_message"] = error_message
            
            self.db.table("failed_emails").update(update_data).eq("id", dlq_id).execute()
        except Exception as e:
            logger.error(f"Error marking DLQ as permanently failed: {e}")
    
    def _schedule_retry(
        self,
        dlq_id: str,
        attempt_count: int,
        next_retry: datetime,
        error_message: Optional[str]
    ):
        """Schedule next retry attempt"""
        try:
            update_data = {
                "status": "pending",
                "attempt_count": attempt_count,
                "next_retry_at": next_retry.isoformat(),
                "last_attempt_at": datetime.utcnow().isoformat()
            }
            if error_message:
                update_data["error_message"] = error_message
            
            self.db.table("failed_emails").update(update_data).eq("id", dlq_id).execute()
        except Exception as e:
            logger.error(f"Error scheduling DLQ retry: {e}")
    
    def get_dlq_stats(self) -> Dict[str, Any]:
        """Get DLQ statistics"""
        try:
            result = self.db.table("failed_emails_summary").select("*").execute()
            
            stats = {
                "total_failed": 0,
                "pending_retry": 0,
                "permanently_failed": 0,
                "resolved": 0,
                "by_error_type": {}
            }
            
            for row in result.data:
                status = row["status"]
                error_type = row["error_type"]
                count = row["count"]
                
                if status == "pending":
                    stats["pending_retry"] += count
                elif status == "failed":
                    stats["permanently_failed"] += count
                elif status == "resolved":
                    stats["resolved"] += count
                
                stats["total_failed"] += count
                
                if error_type not in stats["by_error_type"]:
                    stats["by_error_type"][error_type] = 0
                stats["by_error_type"][error_type] += count
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting DLQ stats: {e}")
            return {}
