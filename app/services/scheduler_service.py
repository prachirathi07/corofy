"""
Scheduler service for processing email queue and follow-ups every 3 hours
Checks timezone before sending - if business hours, sends email; if not, keeps in queue
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.services.email_sending_service import EmailSendingService
from app.services.followup_service import FollowUpService
from app.core.database import SupabaseClient
import logging

logger = logging.getLogger(__name__)

class SchedulerService:
    """
    Service for scheduling background tasks
    Runs every 3 hours to check timezone and process emails/follow-ups
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.db = SupabaseClient.get_client()
        self._email_sending_service = None
        self.followup_service = FollowUpService()
    
    @property
    def email_sending_service(self):
        """Lazy load email sending service"""
        if self._email_sending_service is None:
            try:
                self._email_sending_service = EmailSendingService(self.db)
            except Exception as e:
                logger.error(f"Failed to initialize email sending service: {e}")
                return None
        return self._email_sending_service
    
    def start(self):
        """Start the scheduler - runs every 3 hours"""
        # Schedule email queue processing every 3 hours
        # Checks timezone: if business hours → send, if not → keep in queue
        self.scheduler.add_job(
            self._process_email_queue,
            trigger=IntervalTrigger(hours=3),
            id='process_email_queue',
            name='Process Email Queue (Timezone Check)',
            replace_existing=True
        )
        
        # Schedule follow-up processing every 3 hours
        # Checks timezone: if business hours → send, if not → keep as pending
        self.scheduler.add_job(
            self._process_followups,
            trigger=IntervalTrigger(hours=3),
            id='process_followups',
            name='Process Due Follow-ups (Timezone Check)',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("Scheduler started (runs every 3 hours):")
        logger.info("  - Email queue processing: Every 3 hours (checks timezone → send if business hours, else queue)")
        logger.info("  - Follow-up processing: Every 3 hours (checks timezone → send if business hours, else wait)")
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")
    
    async def _process_email_queue(self):
        """Process email queue (called by scheduler every 3 hours)
        Checks timezone for each queued email:
        - If business hours in lead's timezone → send email
        - If not business hours → keep in queue (will check again in 3 hours)
        """
        try:
            if self.email_sending_service is None:
                logger.warning("Email sending service not available. Skipping queue processing.")
                return
            
            logger.info("🔄 Processing email queue (scheduled task - every 3 hours)")
            logger.info("   Checking timezone for each email: if business hours → send, else → keep in queue")
            result = await self.email_sending_service.process_email_queue()
            logger.info(f"✅ Email queue processed: {result}")
        except Exception as e:
            logger.error(f"❌ Error in scheduled email queue processing: {e}", exc_info=True)
    
    async def _process_followups(self):
        """Process due follow-ups (called by scheduler every 3 hours)
        Checks timezone for each follow-up:
        - If business hours in lead's timezone → send follow-up
        - If not business hours → keep as pending (will check again in 3 hours)
        """
        try:
            logger.info("🔄 Processing due follow-ups (scheduled task - every 3 hours)")
            logger.info("   Checking timezone for each follow-up: if business hours → send, else → wait")
            result = await self.followup_service.process_due_followups()
            logger.info(f"✅ Follow-ups processed: {result}")
        except Exception as e:
            logger.error(f"❌ Error in scheduled follow-up processing: {e}", exc_info=True)

