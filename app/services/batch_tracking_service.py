"""
Batch tracking service for monitoring email sending progress.
Allows tracking, resuming, and monitoring batch operations.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from supabase import Client
import logging
import uuid

logger = logging.getLogger(__name__)

class BatchTrackingService:
    """Service for tracking email batch progress"""
    
    def __init__(self, db: Client):
        self.db = db
    
    def create_batch(
        self,
        total_leads: int,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Create a new batch tracking record.
        
        Args:
            total_leads: Total number of leads in batch
            metadata: Optional metadata (batch type, filters, etc.)
        
        Returns:
            Batch ID (UUID string)
        """
        try:
            batch_data = {
                "total_leads": total_leads,
                "processed_count": 0,
                "success_count": 0,
                "failed_count": 0,
                "skipped_count": 0,
                "status": "running",
                "batch_metadata": metadata or {}
            }
            
            result = self.db.table("email_batches").insert(batch_data).execute()
            batch_id = result.data[0]["id"]
            
            logger.info(f"📊 Created batch {batch_id} with {total_leads} leads")
            return batch_id
            
        except Exception as e:
            logger.error(f"Error creating batch: {e}")
            raise
    
    def update_progress(
        self,
        batch_id: str,
        processed: int,
        success: int,
        failed: int,
        skipped: int = 0
    ) -> bool:
        """
        Update batch progress.
        
        Args:
            batch_id: Batch UUID
            processed: Total processed count
            success: Successful sends
            failed: Failed sends
            skipped: Skipped leads
        
        Returns:
            True if updated successfully
        """
        try:
            update_data = {
                "processed_count": processed,
                "success_count": success,
                "failed_count": failed,
                "skipped_count": skipped
            }
            
            self.db.table("email_batches").update(update_data).eq("id", batch_id).execute()
            
            # Log progress every 10 leads
            if processed % 10 == 0:
                logger.info(
                    f"📊 Batch {batch_id}: {processed} processed "
                    f"({success} success, {failed} failed, {skipped} skipped)"
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating batch progress: {e}")
            return False
    
    def mark_complete(
        self,
        batch_id: str,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Mark batch as complete or failed.
        
        Args:
            batch_id: Batch UUID
            success: True if completed successfully
            error_message: Error message if failed
        
        Returns:
            True if updated successfully
        """
        try:
            update_data = {
                "status": "completed" if success else "failed",
                "completed_at": datetime.utcnow().isoformat()
            }
            
            if error_message:
                update_data["error_message"] = error_message
            
            self.db.table("email_batches").update(update_data).eq("id", batch_id).execute()
            
            status_emoji = "✅" if success else "❌"
            logger.info(f"{status_emoji} Batch {batch_id} marked as {update_data['status']}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error marking batch complete: {e}")
            return False
    
    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current batch status.
        
        Args:
            batch_id: Batch UUID
        
        Returns:
            Dict with batch information or None
        """
        try:
            result = self.db.table("email_batches").select("*").eq("id", batch_id).execute()
            
            if not result.data:
                return None
            
            batch = result.data[0]
            
            # Calculate progress percentage
            total = batch.get("total_leads", 0)
            processed = batch.get("processed_count", 0)
            progress = (processed / total * 100) if total > 0 else 0
            
            return {
                "id": batch["id"],
                "total_leads": total,
                "processed_count": processed,
                "success_count": batch.get("success_count", 0),
                "failed_count": batch.get("failed_count", 0),
                "skipped_count": batch.get("skipped_count", 0),
                "status": batch.get("status"),
                "progress_percentage": round(progress, 2),
                "started_at": batch.get("started_at"),
                "completed_at": batch.get("completed_at"),
                "error_message": batch.get("error_message"),
                "metadata": batch.get("batch_metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Error getting batch status: {e}")
            return None
    
    def get_active_batches(self) -> List[Dict[str, Any]]:
        """
        Get all currently active (running or failed) batches.
        
        Returns:
            List of batch dictionaries
        """
        try:
            result = self.db.table("active_email_batches").select("*").execute()
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error getting active batches: {e}")
            return []
    
    def get_recent_batches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent batches (all statuses).
        
        Args:
            limit: Number of batches to return
        
        Returns:
            List of batch dictionaries
        """
        try:
            result = (
                self.db.table("email_batches")
                .select("*")
                .order("started_at", desc=True)
                .limit(limit)
                .execute()
            )
            
            batches = []
            for batch in result.data:
                total = batch.get("total_leads", 0)
                processed = batch.get("processed_count", 0)
                progress = (processed / total * 100) if total > 0 else 0
                
                batches.append({
                    "id": batch["id"],
                    "total_leads": total,
                    "processed_count": processed,
                    "success_count": batch.get("success_count", 0),
                    "failed_count": batch.get("failed_count", 0),
                    "status": batch.get("status"),
                    "progress_percentage": round(progress, 2),
                    "started_at": batch.get("started_at"),
                    "completed_at": batch.get("completed_at")
                })
            
            return batches
            
        except Exception as e:
            logger.error(f"Error getting recent batches: {e}")
            return []
    
    def cancel_batch(self, batch_id: str) -> bool:
        """
        Cancel a running batch.
        
        Args:
            batch_id: Batch UUID
        
        Returns:
            True if cancelled successfully
        """
        try:
            update_data = {
                "status": "cancelled",
                "completed_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("email_batches").update(update_data).eq("id", batch_id).execute()
            
            logger.info(f"🛑 Batch {batch_id} cancelled")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling batch: {e}")
            return False
