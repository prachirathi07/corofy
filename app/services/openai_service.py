from openai import OpenAI
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.email_data import PRODUCT_CATALOGS
import logging
import asyncio
import json

logger = logging.getLogger(__name__)

class OpenAIService:
    """
    Service for generating personalized emails using OpenAI (SYNC client in async context)
    """

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY missing. Add it to your .env file.")

        # Log which key is being used (first 20 and last 10 chars for security)
        key_preview = f"{self.api_key[:20]}...{self.api_key[-10:]}" if len(self.api_key) > 30 else "***"
        logger.info(f"🔑 OpenAI Service initialized with API key: {key_preview}")

        # Use SYNC client (same as working test script) - this is the correct pattern
        self.client = OpenAI(api_key=self.api_key)

        # Use gpt-4o-mini (correct model name)
        self.model = "gpt-4o-mini"
        logger.info(f"🤖 Using model: {self.model}")

    async def generate_personalized_email(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        company_website_content: Optional[str] = None,
        company_industry: Optional[str] = None,
        email_type: str = "initial",
        custom_context: Optional[str] = None
    ) -> Dict[str, Any]:

        try:
            # Log what we're working with
            logger.info(f"🤖 OpenAI.generate_personalized_email called:")
            logger.info(f"   - Lead: {lead_name} ({lead_title})")
            logger.info(f"   - Company: {company_name}")
            logger.info(f"   - Has website content: {bool(company_website_content)}")
            
            # Select prompt
            if email_type in ["followup_5day", "followup_10day"]:
                days = 5 if email_type == "followup_5day" else 10
                prompt = self._build_followup_prompt(lead_name, lead_title, company_name, days)
                system_msg = "You are an expert B2B outreach email writer. Return JSON."
            else:
                prompt = self._build_initial_email_prompt(
                    lead_name, lead_title, company_name,
                    company_website_content, company_industry, custom_context
                )
                system_msg = (
                    "You are an expert B2B outreach email writer specializing in highly personalized cold emails. "
                    "You MUST analyze the provided company data and classify them into the correct industry. "
                    "You MUST return your response in valid JSON format."
                )
            
            logger.info(f"   - Prompt length: {len(prompt)} chars")

            # Use sync client in thread pool (matches working test script exactly)
            def _call_openai():
                return self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1500,
                    temperature=0.7
                )
            
            # Centralized rate limiting
            from app.core.rate_limiter import rate_limiter
            await rate_limiter.acquire("openai")
            
            # Run sync call in thread pool to avoid blocking
            logger.info(f"🔄 Calling OpenAI API with model: {self.model}")
            response = await asyncio.to_thread(_call_openai)
            logger.info(f"✅ OpenAI API call successful")

            generated_text = response.choices[0].message.content.strip()
            logger.info(f"📝 Generated JSON length: {len(generated_text)} chars")
            
            # Parse JSON response
            try:
                result = json.loads(generated_text)
            except json.JSONDecodeError:
                logger.error(f"❌ Failed to parse OpenAI JSON response: {generated_text}")
                return {
                    "success": False,
                    "error": "Failed to parse AI response",
                    "raw_response": generated_text
                }

            subject = result.get("subject")
            body = result.get("body")
            industry = result.get("industry", "Other")
            
            logger.info(f"📧 Parsed subject: {subject}")
            logger.info(f"🏭 Classified Industry: {industry}")
            
            # Validate personalization
            is_personalized = False
            if company_website_content and company_website_content.strip():
                body_lower = body.lower()
                company_lower = company_name.lower()
                has_company_name = company_lower in body_lower
                is_personalized = has_company_name and len(body) > 100

            return {
                "success": True,
                "subject": subject,
                "body": body,
                "industry": industry,
                "email_type": email_type,
                "is_personalized": is_personalized
            }

        except Exception as e:
            from app.utils.error_handler import format_error_response
            
            # Get status code if available
            status_code = None
            error_text = str(e)
            if hasattr(e, 'status_code'):
                status_code = e.status_code
            elif hasattr(e, 'response') and hasattr(e.response, 'status_code'):
                status_code = e.response.status_code
                if hasattr(e.response, 'text'):
                    error_text = e.response.text
            
            # Format error response
            error_response = format_error_response(e, "OpenAI", status_code, error_text)
            
            # Additional diagnostics for quota errors
            if error_response["error_type"] == "quota":
                key_preview = f"{self.api_key[:20]}...{self.api_key[-10:]}" if len(self.api_key) > 30 else "***"
                logger.error("=" * 80)
                logger.error("⚠️ QUOTA/BILLING ERROR DETECTED")
                logger.error(f"   API Key being used: {key_preview}")
                logger.error(f"   Model: {self.model}")
                logger.error("   Possible causes:")
                logger.error("   1. API key was created when account had $0 balance")
                logger.error("   2. Account has insufficient credits")
                logger.error("   3. API key doesn't have access to this model")
                logger.error("   Solution: Create a NEW API key after adding funds to your account")
                logger.error("=" * 80)
            
            if "model" in error_text.lower() and "not found" in error_text.lower():
                logger.error(f"⚠ MODEL NOT AVAILABLE: {self.model}")

            return {
                "success": False,
                "error": error_response["error"],
                "error_type": error_response["error_type"],
                "subject": None,
                "body": None,
                "industry": None
            }

    # --------------------------------------------------------------------
    # PROMPT HELPERS
    # --------------------------------------------------------------------

    def _build_initial_email_prompt(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        company_website_content: Optional[str],
        company_industry: Optional[str],
        custom_context: Optional[str]
    ) -> str:

        company_name = company_name or "the company"
        
        # Define the specific product catalogs for core industries
        product_catalogs = {
            "Lubricant Industry": [
                "Monoethylene Glycol", "Diethylene Glycol", "Urea Solution / Diesel Exhaust Fluid / AdBlue",
                "Total Base Number Improver Calcium based", "Zinc Booster", "Dispersant / Polyisobutylene Succinimide / PIBSI",
                "Additive Packages for Petro and Diesel Engine", "Pour Point Depressant", "Break Flud DOT 3 & DOT 4"
            ],
            "Oil & Gas Industry": [
                "Cloud Point Glycol for Drilling", "Nonionic Polyalkylimide Glycol Blend", "Nonionic foaming agent",
                "Drilling Detergent", "Monoethylene Glycol", "Triethylene Glycol", "PAC - Polyanionic Cellulose",
                "Carboxymethyl Cellulose / CMC", "XC Polymer Xanthan Gum based", "Mono Ethanol Amine",
                "Sulfonated Asphalt", "Calcium Bromide Liquid 52%", "Primary & Secondary Emulsifier",
                "Corrosion Inhibitor Imidazoline Based", "Demulsifier Concentrate", "Pour Point Depressant",
                "Defoamers- Glycol, Silicone and Ethoxylate based", "Organophilic Clay", "N Methyl Aniline",
                "Methyl Diethylene Glycol", "Mud Thinner", "Mud Wetting Agent"
            ],
            "Agrochemical Industry": [
                "Calcium Alkylbenzene Sulfonate / CaDDBS", "Nonylphenol Ethoxylate", "Castor Oil Ethoxylate",
                "Styrenated Phenol Ethoxylate / Tristyrylphenol Ethoxylate", "Blended Emulsifier Pair for EC",
                "Precipitated Silica", "Dispersing Agent for SC", "Wetting Agent for SC",
                "Dispersing Agent for WP & WDG", "Wetting Agent for WP & WDG", "Silicone Based Antifoam or Defoamer",
                "Strong Adjuvant", "Sulfur Wettable Dry Granules", "Chelated Metals as Microneutrients"
            ]
        }
        
        catalogs_str = json.dumps(product_catalogs, indent=2)

        prompt = f"""
You are an AI email writer for Corofy Chemical Specialist (Corofy LLC), a global chemical supplier based in Dubai.

Your task: Generate a professional, personalized cold outreach email.

Input: Scraped data about a target company (its products, services, industry, location, etc.).

RECIPIENT DETAILS:
Name: {lead_name}
Title: {lead_title}
Company: {company_name}

CORE PRODUCT CATALOGS (Use these EXACTLY if applicable):
{catalogs_str}

STEPS:
1. Analyze the scraped data to understand what the company does, its focus industry, and possible needs.

2. Identify the company's industry category:
   - **Core Industries**: Lubricant Industry, Oil & Gas Industry, Agrochemical Industry.
   - **Other Industries**: Water Treatment, Specialty Chemicals, Paints & Coatings, or ANY other chemical-related sector.

3. **Product Selection Strategy**:
   - **IF Core Industry**: You MUST select 3-5 relevant products from the PROVIDED CATALOG above. Do not invent products.
   - **IF Other Industry**: You must DYNAMICALLY suggest relevant chemical solutions that Corofy (as a global supplier) would likely offer for that specific industry. Base this on standard industry needs and the company's website content.

4. Write a customized outreach email:
   - Introduce Corofy Chemical Specialist as a trusted global supplier.
   - Include a short, relevant paragraph (2–3 lines) mentioning the key products/solutions (either from the catalog or dynamically selected).
   - Highlight benefits specific to their business.

5. Keep the email clear, polite, and professional.

EMAIL STYLE:
- Short and to the point (150–200 words).
- Personalize with the company name and relevant context from scraped data.
- Mention location or region naturally if available.
- Maintain a warm yet concise tone.
- Avoid buzzwords or filler phrases.

"""

        if company_website_content:
            preview = company_website_content[:8000]
            prompt += f"""
COMPANY WEBSITE CONTENT:
{'='*80}
{preview}
{'='*80}
"""
        else:
            prompt += "\nNo website content provided. Infer industry from company name or use general chemical supplier pitch.\n"

        prompt += """
OUTPUT FORMAT (JSON):
{
    "industry": "Lubricant Industry" | "Oil & Gas Industry" | "Agrochemical Industry" | "Water Treatment" | "Specialty Chemicals" | "Other",
    "subject": "...",
    "body": "..."
}
"""
        return prompt

    # --------------------------------------------------------------------
    def _build_followup_prompt(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        days: int
    ) -> str:

        return f"""
Write a follow-up email sent {days} days after initial outreach.

Recipient: {lead_name}
Title: {lead_title}
Company: {company_name}

Requirements:
- Short (2 paragraphs)
- Polite
- Soft CTA
- Acknowledge they're busy

OUTPUT FORMAT (JSON):
{{
    "subject": "...",
    "body": "..."
}}
"""

