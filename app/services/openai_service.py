from openai import OpenAI
from typing import Dict, Any, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class OpenAIService:
    """
    Service for generating personalized emails using OpenAI
    """
    
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required. Please add it to your .env file.")
        if self.api_key == "your_openai_api_key_here" or self.api_key.startswith("your_"):
            raise ValueError("OPENAI_API_KEY is not set. Please add your actual OpenAI API key to the .env file.")
        
        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o-mini"  # Using gpt-4o-mini for cost efficiency, can be changed to gpt-4
    
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
        """
        Generate a personalized email using OpenAI
        
        Args:
            lead_name: Lead's name
            lead_title: Lead's job title
            company_name: Company name
            company_website_content: Scraped website content (markdown)
            company_industry: Company industry
            email_type: Type of email (initial, followup_5day, followup_10day)
            custom_context: Additional context for personalization
        
        Returns:
            Dict with subject and body of the email
        """
        try:
            # Build the prompt based on email type
            if email_type == "followup_5day":
                prompt = self._build_followup_prompt(lead_name, lead_title, company_name, days=5)
            elif email_type == "followup_10day":
                prompt = self._build_followup_prompt(lead_name, lead_title, company_name, days=10)
            else:
                prompt = self._build_initial_email_prompt(
                    lead_name, lead_title, company_name, 
                    company_website_content, company_industry, custom_context
                )
            
            logger.info(f"Generating {email_type} email for {lead_name} at {company_name}")
            
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert email copywriter specializing in personalized B2B outreach emails. Write professional, engaging, and personalized emails that feel authentic and not spammy."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            # Extract the generated email
            generated_text = response.choices[0].message.content.strip()
            
            # Parse subject and body
            email_parts = self._parse_email(generated_text)
            
            logger.info(f"Successfully generated email for {lead_name}")
            
            return {
                "success": True,
                "subject": email_parts.get("subject", "Re: Potential Collaboration"),
                "body": email_parts.get("body", generated_text),
                "email_type": email_type,
                "is_personalized": company_website_content is not None and len(company_website_content) > 0
            }
            
        except Exception as e:
            logger.error(f"Error generating email with OpenAI: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "subject": None,
                "body": None
            }
    
    def _build_initial_email_prompt(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        company_website_content: Optional[str] = None,
        company_industry: Optional[str] = None,
        custom_context: Optional[str] = None
    ) -> str:
        """Build prompt for initial email"""
        
        # Ensure company_name is not None
        company_name = company_name or "their company"
        
        prompt = f"""Write a personalized B2B outreach email with the following details:

Recipient: {lead_name}
Title: {lead_title}
Company: {company_name}"""
        
        if company_industry:
            prompt += f"\nIndustry: {company_industry}"
        
        if company_website_content and len(company_website_content.strip()) > 0:
            # Use first 5000 characters to get more context (increased from 3000)
            content_preview = company_website_content[:5000]
            logger.info(f"📝 OPENAI: Using website content for personalization ({len(content_preview)} chars out of {len(company_website_content)} total)")
            logger.info(f"📝 OPENAI: Content preview (first 300 chars): {content_preview[:300]}...")
            logger.info(f"📝 OPENAI: Company name being used: '{company_name}'")
            prompt += f"""

Company Website Information:
{content_preview}

CRITICAL INSTRUCTIONS:
1. You MUST use the website information above to personalize this email
2. Mention SPECIFIC details from their website (services, products, values, mission, etc.)
3. Show that you've done research on their company
4. Reference the company name "{company_name}" in the email (not "None")
5. Make the email relevant and authentic based on what you learned from their website
6. DO NOT use generic phrases - be specific about what impressed you from their website
7. The subject line should also reference something specific from their website or company

Example good personalization: "I noticed on your website that you specialize in [specific service/product]. Your approach to [specific detail] really caught my attention..."

Example bad (generic): "I came across your company and was impressed" - this is too generic."""
        else:
            logger.warning(f"⚠️ OPENAI: No website content available - email will be generic")
            prompt += "\n\nNote: No website content available. Write a professional but generic email."
        
        if custom_context:
            prompt += f"\n\nAdditional Context: {custom_context}"
        
        prompt += """

Requirements:
- Write a professional, warm, and engaging email
- Keep it concise (3-4 short paragraphs max)
- Include a clear call-to-action
- Don't be pushy or salesy
- Show genuine interest in their business
- Format: Start with "Subject: [subject line]" on first line, then email body

Format your response as:
Subject: [Your subject line here]

[Email body here]"""
        
        return prompt
    
    def _build_followup_prompt(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        days: int = 5
    ) -> str:
        """Build prompt for follow-up email"""
        
        prompt = f"""Write a polite follow-up email for a B2B outreach that was sent {days} days ago.

Recipient: {lead_name}
Title: {lead_title}
Company: {company_name}

Requirements:
- Be polite and respectful
- Acknowledge they're busy
- Briefly remind them of the previous email
- Offer value or ask if they'd like to connect
- Keep it short (2-3 paragraphs)
- Don't be pushy
- Format: Start with "Subject: [subject line]" on first line, then email body

Format your response as:
Subject: [Your subject line here]

[Email body here]"""
        
        return prompt
    
    def _parse_email(self, generated_text: str) -> Dict[str, str]:
        """Parse generated text to extract subject and body"""
        
        lines = generated_text.split('\n')
        subject = None
        body_lines = []
        found_subject = False
        
        for line in lines:
            if line.strip().startswith("Subject:") and not found_subject:
                subject = line.replace("Subject:", "").strip()
                found_subject = True
            elif found_subject:
                body_lines.append(line)
            elif not found_subject and line.strip():
                # If no subject line found, use first line as subject
                if subject is None:
                    subject = line.strip()[:100]  # Limit subject length
                else:
                    body_lines.append(line)
        
        body = '\n'.join(body_lines).strip()
        
        # If no subject found, use default
        if not subject:
            subject = "Re: Potential Collaboration"
        
        # If no body, use the whole text
        if not body:
            body = generated_text
        
        return {
            "subject": subject,
            "body": body
        }
    
    def get_default_template(
        self,
        lead_name: str,
        lead_title: str,
        company_name: str,
        email_type: str = "initial"
    ) -> Dict[str, str]:
        """
        Get default email template (fallback when OpenAI fails or not available)
        
        Args:
            lead_name: Lead's name
            lead_title: Lead's job title
            company_name: Company name
            email_type: Type of email
        
        Returns:
            Dict with subject and body
        """
        if email_type == "followup_5day":
            return {
                "subject": f"Following up - {company_name}",
                "body": f"""Hi {lead_name.split()[0] if lead_name else 'there'},

I wanted to follow up on my previous email about potential collaboration opportunities.

I know you're busy, but I'd love to connect and see if there's a way we can work together.

Would you be open to a quick conversation?

Best regards"""
            }
        elif email_type == "followup_10day":
            return {
                "subject": f"One more follow-up - {company_name}",
                "body": f"""Hi {lead_name.split()[0] if lead_name else 'there'},

I wanted to reach out one more time regarding my previous emails.

I understand you may not be interested right now, but if that changes, I'm here to help.

Thanks for your time.

Best regards"""
            }
        else:
            # Initial email template
            return {
                "subject": f"Potential collaboration with {company_name}",
                "body": f"""Hi {lead_name.split()[0] if lead_name else 'there'},

I hope this email finds you well. I came across {company_name} and was impressed by your work in the industry.

I'd love to explore potential collaboration opportunities that could benefit both our organizations.

Would you be open to a brief conversation to discuss how we might work together?

Looking forward to hearing from you.

Best regards"""
            }

