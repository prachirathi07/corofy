from fastapi import APIRouter, HTTPException, Depends
from app.services.followup_service import FollowUpService
from app.core.database import get_db
from supabase import Client
from uuid import UUID
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/schedule/{lead_id}")
async def schedule_followups(
    lead_id: UUID,
    db: Client = Depends(get_db)
):
    """
    Schedule 5-day and 10-day follow-ups for a lead (after initial email sent)
    
    Args:
        lead_id: UUID of the lead
    
    Returns:
        Dict with follow-up scheduling status
    """
    try:
        from datetime import datetime
        import pytz
        
        # Get the lead to find sent_at
        lead_result = db.table("scraped_data").select("sent_at").eq("id", str(lead_id)).execute()
        if not lead_result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead = lead_result.data[0]
        sent_at_str = lead.get("sent_at")
        if not sent_at_str:
            raise HTTPException(status_code=400, detail="Lead has no sent_at date. Email must be sent first.")
        
        sent_at = datetime.fromisoformat(sent_at_str.replace('Z', '+00:00'))
        
        followup_service = FollowUpService()
        result = await followup_service.schedule_followups_for_lead(str(lead_id), sent_at)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to schedule follow-ups"))
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling follow-ups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to schedule follow-ups: {str(e)}")

@router.post("/process")
async def process_due_followups(db: Client = Depends(get_db)):
    """
    Process follow-ups that are due today
    This should be called daily (can be added to scheduler)
    """
    try:
        followup_service = FollowUpService()
        result = await followup_service.process_due_followups()
        
        return result
    
    except Exception as e:
        logger.error(f"Error processing follow-ups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process follow-ups: {str(e)}")

@router.get("/lead/{lead_id}")
async def get_lead_followups(lead_id: UUID, db: Client = Depends(get_db)):
    """Get all follow-ups for a lead"""
    try:
        followup_service = FollowUpService()
        followups = followup_service.get_followups_for_lead(str(lead_id))
        
        return {
            "lead_id": str(lead_id),
            "followups": followups,
            "count": len(followups)
        }
    
    except Exception as e:
        logger.error(f"Error getting follow-ups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get follow-ups: {str(e)}")

@router.post("/cancel/{lead_id}")
async def cancel_followup(lead_id: UUID, db: Client = Depends(get_db)):
    """Cancel all follow-ups for a lead"""
    try:
        followup_service = FollowUpService()
        result = followup_service.cancel_followups_for_lead(str(lead_id))
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to cancel follow-ups"))
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling follow-ups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel follow-ups: {str(e)}")

@router.get("/")
async def get_all_followups(
    status: str = None,
    db: Client = Depends(get_db)
):
    """Get all follow-ups from scraped_data, optionally filtered by mail_status"""
    try:
        # Query scraped_data for leads with follow-ups scheduled or sent
        query = db.table("scraped_data").select(
            "id, founder_name, founder_email, company_name, "
            "mail_status, followup_5_scheduled_date, followup_10_scheduled_date, "
            "followup_5_sent, followup_10_sent, sent_at"
        )
        
        # Filter by mail_status if provided, otherwise get all with follow-ups
        if status:
            query = query.eq("mail_status", status)
        else:
            # Get leads that have follow-ups scheduled or sent
            query = query.or_(
                "followup_5_scheduled_date.not.is.null,"
                "followup_10_scheduled_date.not.is.null"
            )
        
        query = query.order("sent_at", desc=True)
        result = query.execute()
        
        return {
            "followups": result.data,
            "count": len(result.data)
        }
    
    except Exception as e:
        logger.error(f"Error getting follow-ups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get follow-ups: {str(e)}")

