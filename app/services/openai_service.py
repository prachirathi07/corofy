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

        # Use gpt-4o-mini-2024-07-18 (confirmed available in your account)
        self.model = "gpt-4.1-mini"
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
            error_msg = str(e)
            logger.error(f"❌ OpenAI Error: {error_msg}", exc_info=True)

            # Detailed error diagnostics
            if "429" in error_msg or "quota" in error_msg.lower() or "insufficient_quota" in error_msg.lower():
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

            if "model" in error_msg.lower() and "not found" in error_msg.lower():
                logger.error(f"⚠ MODEL NOT AVAILABLE: {self.model}")

            return {
                "success": False,
                "error": error_msg,
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
        
        # Convert catalogs to string for prompt
        catalogs_str = json.dumps(PRODUCT_CATALOGS, indent=2)

        prompt = f"""
TASK:
1. Analyze the provided company website content to understand their business.
2. Classify the company into ONE of these industries: "Agrochemical", "Oil & Gas", "Lubricant", or "Other".
3. Select 2-3 relevant Corofy products from the PROVIDED PRODUCT CATALOGS below that match their industry.
4. Write a personalized outreach email pitching those specific products.

PROVIDED PRODUCT CATALOGS:
{catalogs_str}

RECIPIENT DETAILS:
Name: {lead_name}
Title: {lead_title}
Company: {company_name}
"""

        if company_industry:
            prompt += f"Hinted Industry: {company_industry}\n"

        if company_website_content:
            preview = company_website_content[:8000]
            prompt += f"""
COMPANY WEBSITE CONTENT:
{'='*80}
{preview}
{'='*80}

CRITICAL REQUIREMENTS:
1. You MUST reference specific details from the website content (products, values, news).
2. You MUST mention "{company_name}" by name in the email body.
3. You MUST mention 2-3 specific Corofy products from the catalog that are relevant to them.
4. FORBIDDEN PHRASES: "I came across your company", "I noticed", "I hope this email finds you well".
5. Tone: Professional, direct, and value-oriented.
"""
        else:
            prompt += "\nNo website content provided. Write a generic but professional email pitching Corofy's chemical solutions.\n"

        if custom_context:
            prompt += f"\nAdditional context: {custom_context}\n"

        prompt += """
OUTPUT FORMAT (JSON):
{
    "industry": "Agrochemical" | "Oil & Gas" | "Lubricant" | "Other",
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

