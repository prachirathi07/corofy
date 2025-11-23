"""
Email personalization service that integrates OpenAI with website scraping
"""
from typing import Dict, Any, Optional
from app.services.openai_service import OpenAIService
from app.services.website_service import WebsiteService
from app.core.database import get_db
from app.core.email_data import EMAIL_TEMPLATES, DEFAULT_TEMPLATE
from supabase import Client
import logging

logger = logging.getLogger(__name__)

class EmailPersonalizationService:
    """
    Service for generating personalized emails using OpenAI and website content
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.openai_service = OpenAIService()
        self.website_service = WebsiteService(db)
    
    async def generate_email_for_lead(
        self,
        lead_id: str,
        email_type: str = "initial",
        force_regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Generate personalized email for a lead
        
        Args:
            lead_id: Lead UUID
            email_type: Type of email (initial, followup_5day, followup_10day)
            force_regenerate: Force regeneration even if email exists
        
        Returns:
            Dict with email subject, body, and metadata
        """
        try:
            # Get lead data
            lead_result = self.db.table("scraped_data").select("*").eq("id", lead_id).execute()
            
            if not lead_result.data or len(lead_result.data) == 0:
                return {
                    "success": False,
                    "error": "Lead not found"
                }
            
            lead = lead_result.data[0]
            
            # Get website content FIRST - we need to check if it's available before deciding to use existing email
            company_website = lead.get("company_website", "")
            company_domain = None
            if company_website:
                # Extract domain from website URL
                company_domain = company_website.replace("https://", "").replace("http://", "").split("/")[0]
            
            company_website_content = None
            website_scraped = False
            
            logger.info(f"🎯 PERSONALIZATION: Getting website content for domain: {company_domain}")
            
            if company_domain:
                # Try to get cached website content
                website_content = await self.website_service.get_website_content(company_domain)
                
                if website_content:
                    company_website_content = website_content.get("markdown", "")
                    if company_website_content and len(company_website_content.strip()) > 0:
                        website_scraped = True
                        logger.info(f"✅ PERSONALIZATION: Using cached website content for {company_domain} (length: {len(company_website_content)} chars)")
                    else:
                        logger.warning(f"⚠️ PERSONALIZATION: Cached content exists but is empty for {company_domain}")
                else:
                    # Try to scrape if we have website URL
                    if company_website:
                        logger.info(f"🌐 PERSONALIZATION: No cache found, scraping website for {company_domain}")
                        scrape_result = await self.website_service.scrape_company_website(
                            company_domain=company_domain,
                            company_website=company_website
                        )
                        
                        if scrape_result.get("success"):
                            company_website_content = scrape_result.get("markdown", "")
                            if company_website_content and len(company_website_content.strip()) > 0:
                                website_scraped = True
                                logger.info(f"✅ PERSONALIZATION: Successfully scraped website for {company_domain} (length: {len(company_website_content)} chars)")
                            else:
                                # Scrape succeeded but content is empty - treat as no content
                                company_website_content = None
                                logger.warning(f"⚠️ PERSONALIZATION: Scrape succeeded but content is empty for {company_domain}. Will use industry template.")
                        else:
                            # Scraping failed (invalid domain/website) - treat as no content
                            company_website_content = None
                            error_reason = scrape_result.get('error', 'Unknown error')
                            logger.warning(f"⚠️ PERSONALIZATION: Failed to scrape website for {company_domain}: {error_reason}. Will use industry template.")
                    else:
                        logger.warning(f"⚠️ PERSONALIZATION: No website URL to scrape for {company_domain}")
            else:
                logger.warning(f"⚠️ PERSONALIZATION: No company website for lead {lead_id}, cannot personalize")
            
            # Check if email already generated (unless force_regenerate OR we have website content that wasn't used)
            should_regenerate = force_regenerate
            if not force_regenerate:
                existing_email = self.db.table("emails_sent").select("*").eq("lead_id", lead_id).eq("email_type", email_type).execute()
                if existing_email.data and len(existing_email.data) > 0:
                    existing_record = existing_email.data[0]
                    existing_website_used = existing_record.get("company_website_used", False)
                    existing_personalized = existing_record.get("is_personalized", False)
                    
                    # If we have website content but the existing email wasn't personalized with it, regenerate
                    if company_website_content and len(company_website_content.strip()) > 0:
                        if not existing_website_used or not existing_personalized:
                            logger.info(f"🔄 PERSONALIZATION: Website content available but existing email not personalized. Regenerating...")
                            should_regenerate = True
                        else:
                            logger.info(f"✅ PERSONALIZATION: Using existing personalized email for lead {lead_id}")
                            return {
                                "success": True,
                                "subject": existing_record.get("email_subject"),
                                "body": existing_record.get("email_body"),
                                "from_cache": True,
                                "is_personalized": existing_personalized,
                                "company_website_used": existing_website_used
                            }
                    else:
                        # No website content available, use existing email if it exists
                        logger.info(f"📧 PERSONALIZATION: Using existing email for lead {lead_id} (no website content available)")
                        return {
                            "success": True,
                            "subject": existing_record.get("email_subject"),
                            "body": existing_record.get("email_body"),
                            "from_cache": True,
                            "is_personalized": existing_personalized,
                            "company_website_used": existing_website_used
                        }
            
            # Generate email using OpenAI
            company_name = lead.get("company_name") or "their company"
            lead_name = lead.get("founder_name", "") or lead.get("founder_email", "").split('@')[0] if lead.get("founder_email") else "there"
            
            logger.info(f"🤖 PERSONALIZATION: Generating email with OpenAI")
            logger.info(f"   - Lead: {lead_name}")
            logger.info(f"   - Company: {company_name}")
            logger.info(f"   - Has website content: {bool(company_website_content)}")
            
            email_result = await self.openai_service.generate_personalized_email(
                lead_name=lead_name,
                lead_title=lead.get("position", ""),
                company_name=company_name,
                company_website_content=company_website_content,
                company_industry=lead.get("company_industry"),
                email_type=email_type
            )
            
            logger.info(f"🤖 PERSONALIZATION: OpenAI result - Success: {email_result.get('success')}, Industry: {email_result.get('industry')}")
            
            if email_result.get("success"):
                # Select Template based on Industry
                # RULE: If we have website content, use AI-detected industry.
                # If no website content, use industry from frontend (stored in company_industry).
                if company_website_content and len(company_website_content.strip()) > 0:
                    industry = email_result.get("industry", "Other")
                    logger.info(f"✅ Using AI-detected industry from website content: {industry}")
                else:
                    # No website content - use industry from frontend
                    frontend_industry = lead.get("company_industry", "").strip()
                    if frontend_industry:
                        # Map frontend industry to template industry
                        industry_mapping = {
                            "agrochemical": "Agrochemical",
                            "oil & gas": "Oil & Gas",
                            "oil and gas": "Oil & Gas",
                            "lubricant": "Lubricant",
                            "lubricants": "Lubricant"
                        }
                        industry = industry_mapping.get(frontend_industry.lower(), "Other")
                        if industry != "Other":
                            logger.info(f"ℹ️ No website content available. Using industry from frontend: {frontend_industry} -> {industry}")
                        else:
                            logger.info(f"ℹ️ No website content available. Frontend industry '{frontend_industry}' doesn't match template industries. Using DEFAULT_TEMPLATE.")
                            industry = "Other"
                    else:
                        industry = "Other"
                        logger.info(f"ℹ️ No website content and no industry from frontend. Using DEFAULT_TEMPLATE.")

                template = EMAIL_TEMPLATES.get(industry, DEFAULT_TEMPLATE)
                
                # Inject Content into Template
                # Note: The AI generates the "BodyContent" which is the pitch. 
                # The template handles the greeting, signature, and company info.
                
                # Clean up lead name for greeting
                greeting_name = lead_name.split()[0] if lead_name else "there"
                
                # Replace placeholders
                final_html_body = template.replace("{{LeadName}}", greeting_name)
                final_html_body = final_html_body.replace("{{BodyContent}}", email_result.get("body"))
                
                return {
                    "success": True,
                    "subject": email_result.get("subject"),
                    "body": final_html_body, # Return full HTML
                    "industry": industry,
                    "is_personalized": email_result.get("is_personalized", website_scraped),
                    "company_website_used": website_scraped,
                    "from_cache": False,
                    "email_type": email_type
                }
            else:
                # Fallback to default template when OpenAI fails
                logger.warning(f"OpenAI generation failed, using industry template: {email_result.get('error')}")
                
                lead_name = lead.get("founder_name", "") or (lead.get("founder_email", "").split('@')[0] if lead.get("founder_email") else "there")
                greeting_name = lead_name.split()[0] if lead_name else "there"
                company_name = lead.get("company_name", "their company")
                
                # Try to use industry template from frontend
                frontend_industry = lead.get("company_industry", "").strip()
                industry_mapping = {
                    "agrochemical": "Agrochemical",
                    "oil & gas": "Oil & Gas",
                    "oil and gas": "Oil & Gas",
                    "lubricant": "Lubricant",
                    "lubricants": "Lubricant"
                }
                industry = industry_mapping.get(frontend_industry.lower(), "Other") if frontend_industry else "Other"
                template = EMAIL_TEMPLATES.get(industry, DEFAULT_TEMPLATE)
                
                # Simple default content
                default_subject = f"Potential collaboration with {company_name}"
                default_pitch = f"I hope this email finds you well. I came across {company_name} and was impressed by your work. I'd love to explore potential collaboration opportunities."
                
                # Use industry-specific or default HTML template
                final_html_body = template.replace("{{LeadName}}", greeting_name)
                # Industry templates don't have {{BodyContent}}, so only replace if it exists
                if "{{BodyContent}}" in final_html_body:
                    final_html_body = final_html_body.replace("{{BodyContent}}", default_pitch)
                
                return {
                    "success": True,
                    "subject": default_subject,
                    "body": final_html_body,
                    "industry": industry,
                    "is_personalized": False,
                    "company_website_used": False,
                    "from_cache": False,
                    "email_type": email_type,
                    "used_default_template": True
                }
        
        except Exception as e:
            logger.error(f"Error generating email for lead {lead_id}: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
