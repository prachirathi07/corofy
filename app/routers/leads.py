from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.services.apollo_service import ApolloService
from app.services.lead_scraper_factory import LeadScraperFactory
from app.services.website_service import WebsiteService
from app.services.email_personalization_service import EmailPersonalizationService
from app.services.timezone_service import TimezoneService
from app.services.simplified_email_tracking_service import SimplifiedEmailTrackingService
# from app.services.batch_tracking_service import BatchTrackingService # REMOVED
from app.services.dead_letter_queue_service import DeadLetterQueueService
from app.core.database import get_db
from app.models.apollo_search import ApolloSearchCreate
from app.models.lead import Lead, LeadCreate
from supabase import Client
from uuid import UUID
import logging
import asyncio
import json
from pydantic import BaseModel
from typing import Optional as Opt

logger = logging.getLogger(__name__)
router = APIRouter()

async def _send_emails_to_leads(lead_ids: List[str], db: Client):
    """
    Send emails to leads with batch tracking, DLQ, and timezone checks.
    MAX 10 LEADS ENFORCED.
    """
    try:
        # CRITICAL SAFETY CHECK: Enforce maximum 10 leads
        MAX_LEADS = 10
        if len(lead_ids) > MAX_LEADS:
            logger.warning(f"⚠️ CRITICAL: Received {len(lead_ids)} lead_ids, limiting to {MAX_LEADS} for safety")
            lead_ids = lead_ids[:MAX_LEADS]
        
        logger.info("=" * 80)
        logger.info(f"🚀 STARTING EMAIL SENDING PROCESS for {len(lead_ids)} leads")
        logger.info("=" * 80)
        
        # Initialize services
        tracking_service = SimplifiedEmailTrackingService(db, batch_size=10)
        # Initialize services
        tracking_service = SimplifiedEmailTrackingService(db, batch_size=10)
        # batch_tracker = BatchTrackingService(db) # REMOVED
        dlq_service = DeadLetterQueueService(db)
        timezone_service = TimezoneService()
        website_service = WebsiteService(db)
        email_service = EmailPersonalizationService(db)
        
        # Batch tracking removed - using logging only
        logger.info(f"📊 Processing batch of {len(lead_ids)} leads")
        
        # Get batch info
        send_check = tracking_service.can_send_today()
        next_batch_offset = send_check.get("next_batch_offset", 0)
        logger.info(f"📊 Processing Batch #{next_batch_offset}")
        
        processed = 0
        failed = 0
        skipped_timezone = 0
        webhook_called = 0
        emails_sent_count = 0
        processed_lead_ids = []
        skipped = 0
        
        for lead_id in lead_ids:
            try:
                # Get lead data
                lead_result = db.table("scraped_data").select("*").eq("id", lead_id).execute()
                if not lead_result.data:
                    logger.warning(f"Lead {lead_id} not found")
                    skipped += 1
                    continue
                
                lead = lead_result.data[0]
                company_website = lead.get("company_website", "")
                company_domain = None
                if company_website:
                    company_domain = company_website.replace("https://", "").replace("http://", "").split("/")[0]
                company_country = lead.get("company_country")
                
                # Step 1: Check timezone (Mon-Sat, 9 AM - 6 PM)
                timezone_check = timezone_service.check_lead_business_hours(
                    country=company_country,
                    start_hour=9,
                    end_hour=18  # 6 PM
                )
                
                is_business_hours = timezone_check.get("is_business_hours", False)
                should_queue = False
                
                if not is_business_hours:
                    logger.info(f"⏸️ Lead {lead_id} - Not in business hours. Queueing.")
                    skipped_timezone += 1
                    should_queue = True
                
                # Step 2: Scrape website
                if company_domain:
                    try:
                        scrape_result = await website_service.scrape_company_website(
                            company_domain=company_domain,
                            company_website=company_website
                        )
                    except Exception as e:
                        logger.error(f"❌ Failed to scrape website for {company_domain}: {e}")
                
                # Step 3: Generate email
                try:
                    email_result = await email_service.generate_email_for_lead(
                        lead_id=lead_id,
                        email_type="initial"
                    )
                    
                    if email_result.get("success"):
                        # Step 4: Send or Queue
                        try:
                            from app.services.email_sending_service import EmailSendingService
                            email_sending_service = EmailSendingService(db)
                            
                            if should_queue:
                                queue_result = await email_sending_service.queue_email_for_lead(
                                    lead_id=lead_id,
                                    email_type="initial",
                                    company_country=company_country
                                )
                                if not queue_result.get("success"):
                                    logger.warning(f"❌ Failed to queue email: {queue_result.get('error')}")
                            else:
                                send_result = await email_sending_service.send_email_to_lead(
                                    lead_id=lead_id,
                                    email_type="initial"
                                )
                                
                                if send_result.get("success"):
                                    logger.info(f"✅ Email sent for lead {lead_id}")
                                    webhook_called += 1
                                    emails_sent_count += 1
                                else:
                                    logger.warning(f"❌ Failed to send email: {send_result.get('error')}")
                                    # Add to DLQ
                                    await dlq_service.add_failed_email(
                                        lead_id=lead_id,
                                        email_to=lead.get("founder_email"),
                                        subject=email_result.get("subject", ""),
                                        body=email_result.get("body", ""),
                                        error=Exception(send_result.get("error", "Unknown error")),
                                        error_type="email_send_failed"
                                    )
                        except Exception as e:
                            logger.error(f"❌ Error sending/queueing email: {e}")
                            failed += 1
                    else:
                        logger.warning(f"❌ Failed to generate email: {email_result.get('error')}")
                        failed += 1
                except Exception as e:
                    logger.error(f"❌ Error generating email: {e}")
                    failed += 1
                
                processed += 1
                processed_lead_ids.append(lead_id)
                
                # Update batch progress - LOGGING ONLY
                if processed % 5 == 0:
                    logger.info(f"📊 Progress: {processed}/{len(lead_ids)} processed, {emails_sent_count} sent, {failed} failed")
                
                # Rate limiting
                if not should_queue:
                    await asyncio.sleep(1.5)
                else:
                    await asyncio.sleep(0.2)
                
            except Exception as e:
                logger.error(f"❌ Error processing lead {lead_id}: {e}", exc_info=True)
                failed += 1
                processed_lead_ids.append(lead_id)
        
        # Mark processed leads
        if processed_lead_ids:
            tracking_service.mark_leads_processed(processed_lead_ids)
        
        # Record completion
        tracking_service.record_send_completion(
            batch_offset=next_batch_offset,
            leads_processed=processed,
            emails_sent=emails_sent_count
        )
        
        # Mark batch complete - LOGGING ONLY
        logger.info(f"✅ Batch processing complete")
        
        logger.info("=" * 80)
        logger.info(f"📊 Email sending completed: {processed} processed, {emails_sent_count} sent")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR: {e}", exc_info=True)

class ScrapeLeadsRequest(BaseModel):
    employee_size_min: Opt[int] = None
    employee_size_max: Opt[int] = None
    countries: Opt[List[str]] = None
    sic_codes: Opt[List[str]] = None
    c_suites: Opt[List[str]] = None
    industry: Opt[str] = None
    total_leads_wanted: int = 10
    source: str = "apollo"

class SendEmailsRequest(BaseModel):
    lead_ids: Opt[List[str]] = None

@router.post("/scrape", response_model=dict)
async def scrape_leads(request: ScrapeLeadsRequest, db: Client = Depends(get_db)):
    """Scrape leads and store in scraped_data"""
    
    source = request.source.lower() if request.source else "apollo"
    
    # Create search record - only include fields that exist and are not None
    search_data = {
        "source": source,
        "status": "pending"
    }
    if request.total_leads_wanted is not None:
        search_data["total_leads_wanted"] = request.total_leads_wanted
    
    try:
        search_insert = db.table("apollo_searches").insert(search_data).execute()
        search_id = search_insert.data[0]["id"] if search_insert.data else None
        if not search_id:
            raise HTTPException(status_code=500, detail="Failed to create search record")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to insert into apollo_searches: {error_msg}")
        if "556" in error_msg or "Internal server error" in error_msg:
            raise HTTPException(
                status_code=503, 
                detail="Database service error. Please check if the 'apollo_searches' table exists in Supabase and try again."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {error_msg}")
    
    logger.info(f"📥 Received scrape request. Total leads wanted: {request.total_leads_wanted}")
    
    # SAFETY OVERRIDE: Enforce max 10 leads for testing
    if request.total_leads_wanted > 10:
        logger.warning(f"⚠️ Request asked for {request.total_leads_wanted} leads. OVERRIDING to 10 for safety.")
        request.total_leads_wanted = 10

    try:
        scraper = LeadScraperFactory.create_scraper(source)
        
        if source == "apollo":
            apollo_service = ApolloService()
            all_leads = await apollo_service.search_people(
                employee_size_min=request.employee_size_min,
                employee_size_max=request.employee_size_max,
                countries=request.countries or [],
                sic_codes=request.sic_codes or [],
                c_suites=request.c_suites,
                industry=request.industry,
                total_leads_wanted=request.total_leads_wanted,
                enrich_leads=True  # ✅ Enable two-step enrichment
            )
        else:
            raise ValueError(f"Unsupported source: {source}. Only 'apollo' is supported.")
        
        # Store in scraped_data
        # Define allowed fields that exist in scraped_data table
        allowed_fields = {
            "founder_name", "company_name", "position", "founder_email", "founder_linkedin",
            "founder_address", "company_industry", "company_website", "company_linkedin",
            "company_country", "company_domain",
            "is_verified", "followup_5_sent", "followup_10_sent", "mail_status", "reply_priority",
            "gmail_thread_id", "mail_replies", "email_content", "email_subject",
            "apollo_search_id"
        }
        
        leads_to_insert = []
        for lead in all_leads:
            if isinstance(lead, dict):
                lead_dict = lead
            else:
                lead_dict = lead.model_dump(exclude_none=True)
            
            # Filter to only include allowed fields
            filtered_lead = {k: v for k, v in lead_dict.items() if k in allowed_fields}
            filtered_lead["apollo_search_id"] = search_id
            leads_to_insert.append(filtered_lead)
            
        if leads_to_insert:
            # Batch insert
            batch_size = 100
            total_inserted = 0
            for i in range(0, len(leads_to_insert), batch_size):
                batch = leads_to_insert[i:i + batch_size]
                try:
                    insert_result = db.table("scraped_data").insert(batch).execute()
                    inserted_count = len(insert_result.data) if insert_result.data else len(batch)
                    total_inserted += inserted_count
                    logger.info(f"✅ Inserted batch {i//batch_size + 1}: {inserted_count} leads stored in Supabase")
                except Exception as e:
                    logger.error(f"❌ Insert failed for batch {i//batch_size + 1}: {e}")
            
            logger.info(f"✅ Total leads stored in Supabase: {total_inserted}/{len(leads_to_insert)}")
        
        db.table("apollo_searches").update({"status": "completed"}).eq("id", search_id).execute()
        
        return {"success": True, "total_leads_found": len(all_leads)}
        
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        db.table("apollo_searches").update({"status": "failed"}).eq("id", search_id).execute()
        
        error_msg = str(e)
        if "Apollo API 403" in error_msg:
             raise HTTPException(status_code=403, detail=error_msg)
             
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/send-emails", response_model=dict)
async def send_emails_to_leads_endpoint(request: SendEmailsRequest, db: Client = Depends(get_db)):
    """Send emails to leads (manual or automatic batch) - MAX 10 LEADS"""
    try:
        lead_ids = request.lead_ids
        
        if not lead_ids:
            # Get next batch from tracking service
            tracking_service = SimplifiedEmailTrackingService(db, batch_size=10)
            send_check = tracking_service.can_send_today()
            
            if not send_check["can_send"]:
                return {
                    "success": False,
                    "message": send_check["reason"],
                    "next_batch_offset": send_check["next_batch_offset"]
                }
            
            leads = tracking_service.get_next_batch_leads()
            lead_ids = [l["id"] for l in leads]
            
            if not lead_ids:
                return {"success": True, "message": "No unprocessed leads found"}
        
        # SAFETY CHECK: Limit to maximum 10 leads
        MAX_LEADS = 10
        if len(lead_ids) > MAX_LEADS:
            logger.warning(f"⚠️ Received {len(lead_ids)} lead_ids, limiting to {MAX_LEADS} for safety")
            lead_ids = lead_ids[:MAX_LEADS]
        
        # Start background task
        task = asyncio.create_task(_send_emails_to_leads(lead_ids, db))
        
        return {
            "success": True,
            "message": f"Started processing {len(lead_ids)} leads",
            "count": len(lead_ids)
        }
    except Exception as e:
        logger.error(f"Error starting email send: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/send-status")
async def get_send_status(db: Client = Depends(get_db)):
    """Check if emails can be sent today"""
    try:
        tracking_service = SimplifiedEmailTrackingService(db, batch_size=10)
        send_check = tracking_service.can_send_today()
        stats = tracking_service.get_stats()
        
        return {
            "can_send_today": send_check["can_send"],
            "reason": send_check["reason"],
            "next_batch_offset": send_check["next_batch_offset"],
            "total_leads": stats.get("total_leads", 0),
            "total_processed": stats.get("total_processed", 0),
            "remaining_leads": stats.get("remaining_leads", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Batch Tracking Endpoints
# Batch Tracking Endpoints - REMOVED/DISABLED
# @router.get("/batch/{batch_id}") ...
# @router.get("/batches/active") ...
# @router.get("/batches/recent") ...
# @router.post("/batch/{batch_id}/cancel") ...

@router.get("/", response_model=List[dict])
async def get_leads(skip: int = 0, limit: int = 50, db: Client = Depends(get_db)):
    try:
        result = db.table("scraped_data").select("*").order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}", response_model=dict)
async def get_lead(lead_id: str, db: Client = Depends(get_db)):
    try:
        result = db.table("scraped_data").select("*").eq("id", lead_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
