from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from app.services.apollo_service import ApolloService
from app.services.apify_service import ApifyService
from app.services.lead_scraper_factory import LeadScraperFactory
from app.services.website_service import WebsiteService
from app.services.email_personalization_service import EmailPersonalizationService
from app.services.timezone_service import TimezoneService
from app.core.database import get_db
from app.models.apollo_search import ApolloSearchCreate
from app.models.lead import Lead, LeadCreate
from supabase import Client
from uuid import UUID
import logging
import asyncio
import json

logger = logging.getLogger(__name__)
router = APIRouter()


async def _send_emails_to_leads(lead_ids: List[str], db: Client):
    """
    Send emails to leads: Check timezone, scrape websites, generate and send emails
    Only proceeds if it's Mon-Fri 9-7 in the lead's timezone
    For each lead: Scrape website -> Generate email -> Send email automatically
    Runs in background without blocking the response
    """
    try:
        logger.info("=" * 80)
        logger.info(f"🚀 STARTING EMAIL SENDING PROCESS for {len(lead_ids)} leads")
        logger.info(f"📋 Lead IDs (first 5): {lead_ids[:5]}{'...' if len(lead_ids) > 5 else ''}")
        logger.info("=" * 80)
        
        timezone_service = TimezoneService()
        website_service = WebsiteService(db)
        email_service = EmailPersonalizationService(db)
        
        processed = 0
        failed = 0
        skipped_timezone = 0
        webhook_called = 0
        
        for lead_id in lead_ids:
            try:
                # Get lead data
                lead_result = db.table("leads").select("*").eq("id", lead_id).execute()
                if not lead_result.data:
                    continue
                
                lead = lead_result.data[0]
                company_domain = lead.get("company_domain")
                company_website = lead.get("company_website")
                company_country = lead.get("company_country")
                
                # Step 1: Check timezone - only proceed if it's Mon-Fri 9-7 in lead's timezone
                logger.info(f"🕐 Checking timezone for lead {lead_id} (country: {company_country})")
                timezone_check = timezone_service.check_lead_business_hours(
                    country=company_country,
                    start_hour=9,
                    end_hour=19  # 7 PM
                )
                
                is_business_hours = timezone_check.get("is_business_hours", False)
                
                if not is_business_hours:
                    reason = timezone_check.get("reason", "Unknown reason")
                    logger.info(f"⏸️ Lead {lead_id} - Not in business hours: {reason} ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                    logger.info(f"📅 Email will be queued for lead {lead_id} (will be sent when business hours)")
                    skipped_timezone += 1
                    # Continue processing but mark for queueing - don't skip the lead entirely
                    should_queue = True
                else:
                    logger.info(f"✅ Lead {lead_id} is in business hours ({timezone_check.get('day_name')} {timezone_check.get('current_hour')}:00 in {timezone_check.get('timezone')})")
                    should_queue = False
                
                # Step 2: Scrape website FIRST (using Firecrawl) - REQUIRED before sending email
                if company_domain:
                    try:
                        logger.info(f"🌐 STEP 2: Scraping website for lead {lead_id}")
                        logger.info(f"🌐 Company domain: {company_domain}, Company website: {company_website}")
                        scrape_result = await website_service.scrape_company_website(
                            company_domain=company_domain,
                            company_website=company_website
                        )
                        if scrape_result.get("success"):
                            markdown_length = len(scrape_result.get("markdown", ""))
                            logger.info(f"✅ STEP 2 SUCCESS: Website scraped successfully for {company_domain} ({markdown_length} chars)")
                        else:
                            error_msg = scrape_result.get('error', 'Unknown error')
                            logger.warning(f"⚠️ STEP 2 FAILED: Website scraping failed for {company_domain}: {error_msg}")
                    except Exception as e:
                        logger.error(f"❌ STEP 2 EXCEPTION: Failed to scrape website for {company_domain}: {e}", exc_info=True)
                else:
                    logger.warning(f"⚠️ STEP 2 SKIPPED: No company domain for lead {lead_id}, skipping website scrape")
                
                # Step 3: Generate personalized email (based on scraped website content)
                try:
                    logger.info(f"✉️ Generating email for lead {lead_id}")
                    email_result = await email_service.generate_email_for_lead(
                        lead_id=lead_id,
                        email_type="initial"
                    )
                    if email_result.get("success"):
                        # Email content generated - will be stored in emails_sent table only when actually sent
                        logger.info(f"✅ Email content generated for lead {lead_id}")
                        
                        # Step 4: Automatically send or queue the email based on timezone
                        try:
                            logger.info(f"📧 STEP 4: Processing email for lead {lead_id} (should_queue: {should_queue})")
                            from app.services.email_sending_service import EmailSendingService
                            email_sending_service = EmailSendingService(db)
                            
                            if should_queue:
                                # Queue the email for later (outside business hours)
                                logger.info(f"📅 Queueing email for lead {lead_id} (outside business hours)")
                                queue_result = await email_sending_service.queue_email_for_lead(
                                    lead_id=lead_id,
                                    email_type="initial",
                                    company_country=company_country
                                )
                                
                                if queue_result.get("success"):
                                    logger.info(f"✅ Email queued successfully for lead {lead_id}")
                                else:
                                    logger.warning(f"❌ Failed to queue email for lead {lead_id}: {queue_result.get('error')}")
                            else:
                                # Send email immediately (in business hours)
                                logger.info(f"📧 Sending email immediately for lead {lead_id} (in business hours)")
                                send_result = await email_sending_service.send_email_to_lead(
                                    lead_id=lead_id,
                                    email_type="initial"
                                )
                                
                                logger.info(f"📧 Send result for lead {lead_id}: {send_result}")
                                
                                if send_result.get("success"):
                                    logger.info(f"✅ Email sent immediately for lead {lead_id}")
                                    webhook_called += 1
                                else:
                                    logger.warning(f"❌ Failed to send email for lead {lead_id}: {send_result.get('error')}")
                                    logger.warning(f"❌ Full send_result: {send_result}")
                        except ValueError as e:
                            logger.warning(f"⚠️ Email service error for lead {lead_id}: {e}")
                        except Exception as e:
                            logger.error(f"❌ Error processing email for lead {lead_id}: {e}", exc_info=True)
                    else:
                        logger.warning(f"❌ Failed to generate email for lead {lead_id}: {email_result.get('error')}")
                        failed += 1
                except Exception as e:
                    logger.error(f"❌ Error generating email for lead {lead_id}: {e}", exc_info=True)
                    failed += 1
                
                processed += 1
                
                # Small delay to avoid overwhelming APIs
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"❌ Error processing lead {lead_id}: {e}", exc_info=True)
                failed += 1
                
        logger.info("=" * 80)
        logger.info(f"📊 Email sending completed: {processed} processed, {webhook_called} webhooks called, {skipped_timezone} skipped (timezone), {failed} failed")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"❌ CRITICAL ERROR in email sending background task: {e}", exc_info=True)
        logger.error(f"❌ This error will cause the entire email sending process to fail silently!")
        logger.error("=" * 80)
        import traceback
        logger.error(traceback.format_exc())

from pydantic import BaseModel
from typing import Optional as Opt

class ScrapeLeadsRequest(BaseModel):
    employee_size_min: Opt[int] = None
    employee_size_max: Opt[int] = None
    countries: Opt[List[str]] = None
    sic_codes: Opt[List[str]] = None
    c_suites: Opt[List[str]] = None
    industry: Opt[str] = None
    total_leads_wanted: int = 625
    source: str = "apify"  # "apollo" or "apify"

class SendEmailsRequest(BaseModel):
    lead_ids: Opt[List[str]] = None  # If None, sends to all leads

@router.post("/scrape", response_model=dict)
async def scrape_leads(
    request: ScrapeLeadsRequest,
    db: Client = Depends(get_db)
):
    """
    Scrape leads from Apollo or Apify API based on filters
    
    Args:
        request: ScrapeLeadsRequest with filters
        
    Returns:
        Dict with search results and lead count
    """
    employee_size_min = request.employee_size_min
    employee_size_max = request.employee_size_max
    countries = request.countries
    sic_codes = request.sic_codes
    c_suites = request.c_suites or ["CEO", "COO", "Director", "President", "Owner", "Founder", "Board of Directors"]
    industry = request.industry
    total_leads_wanted = request.total_leads_wanted
    source = request.source.lower() if request.source else "apify"
    
    # Create search record
    search_data = ApolloSearchCreate(
        employee_size_min=employee_size_min,
        employee_size_max=employee_size_max,
        countries=countries or [],
        sic_codes=sic_codes or [],
        c_suites=c_suites,
        industry=industry,
        total_leads_wanted=total_leads_wanted,
        source=source
    )
    
    search_insert = db.table("apollo_searches").insert(search_data.model_dump()).execute()
    search_id = search_insert.data[0]["id"]
    
    logger.info(f"Starting lead scraping (source: {source}, search_id: {search_id})")
    
    try:
        # Get appropriate scraper
        scraper = LeadScraperFactory.get_scraper(source)
        
        all_leads = []
        
        if source == "apollo":
            # Apollo scraping
            apollo_service = ApolloService()
            apollo_leads = await apollo_service.search_people(
                employee_size_min=employee_size_min,
                employee_size_max=employee_size_max,
                countries=countries or [],
                sic_codes=sic_codes or [],
                c_suites=c_suites,
                total_leads_wanted=total_leads_wanted
            )
            all_leads = apollo_leads[:total_leads_wanted] if total_leads_wanted else apollo_leads
            
        elif source == "apify":
            # Apify scraping
            try:
                apify_response = await scraper.search_leads(
                    employee_size_min=employee_size_min,
                    employee_size_max=employee_size_max,
                    countries=countries,
                    sic_codes=sic_codes,  # Optional, not used in Apify input
                    c_suites=c_suites,
                    industry=industry,
                    total_leads_wanted=total_leads_wanted
                )
                
                # Apify search_leads returns a dict with "leads" (parsed as dicts) and "items" (raw)
                apify_leads_dicts = apify_response.get("leads", [])
                raw_items = apify_response.get("items", [])
                
                logger.info(f"Apify response - Parsed leads (dicts): {len(apify_leads_dicts)}, Raw items: {len(raw_items)}")
                
                # Convert dict leads to LeadCreate objects, or parse raw items if needed
                apify_leads = []
                
                if apify_leads_dicts:
                    # Leads are already parsed as dictionaries, convert to LeadCreate objects
                    logger.info(f"Converting {len(apify_leads_dicts)} dict leads to LeadCreate objects")
                    for lead_dict in apify_leads_dicts:
                        try:
                            # If it's already a dict, create LeadCreate from it
                            if isinstance(lead_dict, dict):
                                lead = LeadCreate(**lead_dict)
                                apify_leads.append(lead)
                            else:
                                # If it's already a LeadCreate object, use it directly
                                apify_leads.append(lead_dict)
                        except Exception as e:
                            logger.warning(f"Failed to convert lead dict to LeadCreate: {e}. Dict: {lead_dict}")
                            continue
                    logger.info(f"Converted {len(apify_leads)} leads to LeadCreate objects")
                elif raw_items:
                    # No parsed leads, try parsing raw items
                    logger.info(f"Parsing {len(raw_items)} raw items from Apify")
                    apify_leads = scraper.parse_apify_response(raw_items)
                    logger.info(f"After parsing: {len(apify_leads)} leads")
                else:
                    logger.warning("Apify returned no leads and no raw items. Response structure:")
                    logger.warning(f"Response keys: {list(apify_response.keys())}")
                    logger.warning(f"Full response: {json.dumps(apify_response, indent=2, default=str)[:2000]}")
                
                # Log sample of what we got
                if raw_items and len(raw_items) > 0:
                    logger.info(f"Sample raw item (first): {json.dumps(raw_items[0], indent=2, default=str)[:1000]}")
                
                all_leads = apify_leads[:total_leads_wanted] if total_leads_wanted else apify_leads
                
                logger.info(f"Final: Apify returned {len(all_leads)} leads to store")
            except Exception as apify_error:
                error_msg = str(apify_error) if apify_error else "Unknown Apify error"
                logger.error(f"Apify scraping failed: {error_msg}", exc_info=True)
                raise Exception(f"Apify scraping error: {error_msg}") from apify_error
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown source: {source}. Use 'apollo' or 'apify'")
        
        # Store leads in database
        leads_to_insert = []
        stored_lead_ids = []
        
        logger.info(f"Preparing to store {len(all_leads)} leads in Supabase")
        
        for lead in all_leads:
            try:
                lead_dict = lead.model_dump(exclude_none=True)
                lead_dict["apollo_search_id"] = search_id
                leads_to_insert.append(lead_dict)
            except Exception as e:
                logger.error(f"Failed to convert lead to dict: {e}. Lead: {lead}")
                continue
        
        if leads_to_insert:
            logger.info(f"Inserting {len(leads_to_insert)} leads into Supabase in batches")
            # Insert in batches to avoid overwhelming the database
            batch_size = 100
            for i in range(0, len(leads_to_insert), batch_size):
                batch = leads_to_insert[i:i + batch_size]
                try:
                    result = db.table("leads").insert(batch).execute()
                    # Collect inserted lead IDs
                    for inserted_lead in result.data:
                        stored_lead_ids.append(inserted_lead["id"])
                    logger.info(f"✅ Inserted batch {i//batch_size + 1} ({len(batch)} leads) into Supabase")
                except Exception as e:
                    logger.error(f"❌ Failed to insert batch {i//batch_size + 1}: {e}")
                    # Try inserting one by one to see which one fails
                    for single_lead in batch:
                        try:
                            single_result = db.table("leads").insert(single_lead).execute()
                            stored_lead_ids.append(single_result.data[0]["id"])
                        except Exception as single_error:
                            logger.error(f"Failed to insert single lead: {single_error}. Lead data: {json.dumps(single_lead, default=str)[:500]}")
        else:
            logger.warning("⚠️ No leads to insert into Supabase. Check parsing logic.")
        
        # Note: Email sending is now manual - user clicks "Send Emails" button
        # No automatic email generation after scraping - removed automatic trigger
        
        # Update search status
        db.table("apollo_searches").update({
            "status": "completed",
            "total_leads_found": len(all_leads),
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", search_id).execute()
        
        return {
            "success": True,
            "search_id": str(search_id),
            "total_leads_found": len(all_leads),
            "total_leads_stored": len(stored_lead_ids),
            "target_leads": total_leads_wanted,
            "leads": [lead.model_dump() for lead in all_leads[:10]]  # Return first 10 as sample
        }
    
    except HTTPException as http_error:
        # Re-raise HTTPExceptions as-is (they already have proper status codes and messages)
        logger.error(f"HTTPException in scrape_leads: {http_error.status_code} - {http_error.detail}")
        raise http_error
    except Exception as e:
        error_msg = str(e) if e else "Unknown error"
        error_type = type(e).__name__
        logger.error(f"Error scraping leads ({error_type}): {error_msg}", exc_info=True)
        
        # Update search status to failed
        if 'search_id' in locals():
            try:
                db.table("apollo_searches").update({
                    "status": "failed"
                }).eq("id", search_id).execute()
            except Exception as db_error:
                logger.error(f"Failed to update search status: {db_error}")
        
        # Provide more detailed error message
        detail_msg = f"Failed to scrape leads: {error_msg}"
        if not error_msg or error_msg == "Unknown error":
            detail_msg = f"Failed to scrape leads: {error_type} - Check server logs for details"
        
        # If it's an Apify error, include more context
        if "Apify" in error_type or "apify" in error_msg.lower():
            detail_msg = f"Apify scraping failed: {error_msg}. Check server logs for full details."
        
        raise HTTPException(status_code=500, detail=detail_msg)

@router.post("/send-emails", response_model=dict)
async def send_emails_to_leads(
    request: SendEmailsRequest,
    db: Client = Depends(get_db)
):
    """
    Send emails to leads automatically
    For each lead: Check timezone -> Scrape website (Firecrawl) -> Generate email -> Send email
    No user interaction required - fully automatic
    
    Args:
        request: SendEmailsRequest with optional lead_ids (if None, sends to all leads)
    
    Returns:
        Dict with status and counts
    """
    try:
        lead_ids = request.lead_ids
        
        # If no lead_ids provided, get all leads
        if not lead_ids:
            logger.info("No lead_ids provided, fetching all leads")
            leads_result = db.table("leads").select("id").execute()
            lead_ids = [str(lead["id"]) for lead in leads_result.data]
            logger.info(f"Found {len(lead_ids)} leads to process")
        else:
            logger.info(f"Processing {len(lead_ids)} specified leads")
        
        if not lead_ids:
            return {
                "success": True,
                "message": "No leads to process",
                "total_leads": 0,
                "status": "completed"
            }
        
        # Run email sending in background
        logger.info(f"🚀 Creating background task for email sending with {len(lead_ids)} leads")
        logger.info(f"📋 Lead IDs (first 5): {lead_ids[:5]}{'...' if len(lead_ids) > 5 else ''}")
        
        # Create background task with proper error handling
        async def run_with_error_handling():
            try:
                await _send_emails_to_leads(lead_ids, db)
            except Exception as e:
                logger.error(f"❌ Background task failed: {e}", exc_info=True)
        
        task = asyncio.create_task(run_with_error_handling())
        logger.info(f"✅ Background task created: {task}")
        logger.info(f"📝 Task will run in background. Watch logs for progress...")
        
        return {
            "success": True,
            "message": f"Email sending started for {len(lead_ids)} leads. Check server logs for progress.",
            "total_leads": len(lead_ids),
            "status": "processing"
        }
    
    except Exception as e:
        logger.error(f"Error starting email sending: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start email sending: {str(e)}")

@router.get("/", response_model=List[dict])
async def get_leads(
    skip: int = 0,
    limit: int = 50,
    db: Client = Depends(get_db)
):
    """Get all leads with pagination"""
    try:
        result = db.table("leads").select("*").order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        return result.data
    except Exception as e:
        logger.error(f"Error fetching leads: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")

@router.get("/{lead_id}", response_model=dict)
async def get_lead(lead_id: UUID, db: Client = Depends(get_db)):
    """Get a specific lead by ID"""
    try:
        result = db.table("leads").select("*").eq("id", str(lead_id)).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching lead: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch lead: {str(e)}")
