"""
Scheduler Service for background tasks
Handles periodic tasks like processing email queue and retrying failed emails
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.core.database import get_db
from app.services.email_sending_service import EmailSendingService
from app.services.dead_letter_queue_service import DeadLetterQueueService
from app.services.reply_service import ReplyService
from app.services.followup_service import FollowUpService
from app.core.rate_limiter import rate_limiter
import logging
import asyncio

logger = logging.getLogger(__name__)

class SchedulerService:
    """
    Manages background scheduled tasks using APScheduler
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._setup_jobs()
        
    def _setup_jobs(self):
        """Define and add jobs to the scheduler"""
        
        # Job 1: Process Email Queue (Every 15 minutes)
        self.scheduler.add_job(
            self._run_process_email_queue,
            trigger=IntervalTrigger(hours=2),
            id="process_email_queue",
            name="Process Email Queue",
            replace_existing=True
        )
        
        # Job 2: Retry Failed Emails / DLQ (Every 1 hour)
        self.scheduler.add_job(
            self._run_retry_failed_emails,
            trigger=IntervalTrigger(hours=1),
            id="retry_failed_emails",
            name="Retry Failed Emails (DLQ)",
            replace_existing=True
        )
        
        # Job 3: Cleanup Rate Limiter (Every 10 minutes)
        self.scheduler.add_job(
            self._run_rate_limiter_cleanup,
            trigger=IntervalTrigger(minutes=10),
            id="cleanup_rate_limiter",
            name="Cleanup Rate Limiter",
            replace_existing=True
        )
        
        # Job 4: Check for Email Replies (Every 2 hours)
        self.scheduler.add_job(
            self._run_check_replies,
            trigger=IntervalTrigger(hours=2),
            id="check_replies",
            name="Check Email Replies",
            replace_existing=True
        )
        
        # Job 5: Process Due Follow-ups (Every 2 hours)
        self.scheduler.add_job(
            self._run_process_followups,
            trigger=IntervalTrigger(hours=2),
            id="process_followups",
            name="Process Due Follow-ups",
            replace_existing=True
        )
        
        logger.info("⏰ Scheduler jobs configured")

    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("🚀 Background Scheduler STARTED")
    
    def stop(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("🛑 Background Scheduler STOPPED")

    # ----------------------------------------------------------------
    # JOB WRAPPERS (Handle dependencies and errors)
    # ----------------------------------------------------------------

    async def _run_process_email_queue(self):
        """Wrapper to run email queue processing"""
        try:
            logger.info("⏰ JOB START: Processing Email Queue")
            # Create fresh service instance with DB connection
            db = get_db()
            email_service = EmailSendingService(db)
            
            # Run the task
            result = await email_service.process_email_queue()
            
            logger.info(f"⏰ JOB END: Process Email Queue - Processed: {result.get('processed')}, Sent: {result.get('sent')}")
            
        except Exception as e:
            logger.error(f"❌ JOB ERROR (Process Email Queue): {e}", exc_info=True)

    async def _run_retry_failed_emails(self):
        """Wrapper to run DLQ retry"""
        try:
            logger.info("⏰ JOB START: Retrying Failed Emails (DLQ)")
            # Create fresh service instance with DB connection
            db = get_db()
            dlq_service = DeadLetterQueueService(db)
            
            # Run the task
            result = await dlq_service.retry_failed_emails()
            
            logger.info(f"⏰ JOB END: Retry Failed Emails - Retried: {result.get('retried_count')}, Success: {result.get('success_count')}")
            
        except Exception as e:
            logger.error(f"❌ JOB ERROR (Retry Failed Emails): {e}", exc_info=True)

    async def _run_rate_limiter_cleanup(self):
        """Wrapper to cleanup rate limiter"""
        try:
            # Rate limiter is a singleton, so we just call its method
            # Note: _periodic_cleanup is internal, but we can call it or expose a public method
            # Ideally we should expose a public method, but for now accessing protected is fine for this service
            if hasattr(rate_limiter, '_periodic_cleanup'):
                await rate_limiter._periodic_cleanup()
                logger.debug("⏰ JOB SUCCESS: Rate Limiter Cleanup")
        except Exception as e:
            logger.error(f"❌ JOB ERROR (Rate Limiter Cleanup): {e}", exc_info=True)

    async def _run_check_replies(self):
        """Wrapper to check for email replies"""
        try:
            logger.info("⏰ JOB START: Checking Email Replies")
            reply_service = ReplyService()
            
            # Run the task
            result = await reply_service.check_and_analyze_replies()
            
            logger.info(f"⏰ JOB END: Check Replies - Checked: {result.get('checked')}, New Replies: {result.get('new_replies')}, Analyzed: {result.get('analyzed')}")
            
        except Exception as e:
            logger.error(f"❌ JOB ERROR (Check Replies): {e}", exc_info=True)

    async def _run_process_followups(self):
        """Wrapper to process due follow-ups"""
        try:
            logger.info("⏰ JOB START: Processing Due Follow-ups")
            followup_service = FollowUpService()
            
            # Run the task
            result = await followup_service.process_due_followups()
            
            logger.info(f"⏰ JOB END: Process Follow-ups - Processed: {result.get('processed')}, Failed: {result.get('failed')}, Skipped: {result.get('skipped_timezone')}")
            
        except Exception as e:
            logger.error(f"❌ JOB ERROR (Process Follow-ups): {e}", exc_info=True)
