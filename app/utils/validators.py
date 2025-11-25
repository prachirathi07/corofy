"""
Data validation utilities for lead and email data.
Ensures data quality and catches errors early.
"""

from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional
import re
import logging

logger = logging.getLogger(__name__)

class LeadValidator(BaseModel):
    """Validate lead data before processing"""
    
    founder_email: Optional[EmailStr] = None
    founder_name: Optional[str] = None
    company_name: Optional[str] = None
    position: Optional[str] = None
    founder_linkedin: Optional[str] = None
    founder_address: Optional[str] = None
    company_industry: Optional[str] = None
    company_website: Optional[str] = None
    company_linkedin: Optional[str] = None
    
    @validator('founder_email')
    def validate_email(cls, v):
        """Validate and normalize email"""
        if v:
            v = v.strip().lower()
            # Additional check for common invalid patterns
            if v.endswith('.con') or v.endswith('.cm'):
                raise ValueError(f'Invalid email domain: {v}')
        return v
    
    @validator('founder_name')
    def validate_name(cls, v):
        """Validate founder name"""
        if v:
            v = v.strip()
            if len(v) < 2:
                raise ValueError('Name must be at least 2 characters')
            # Check for obviously fake names
            if v.lower() in ['test', 'na', 'n/a', 'none', 'null']:
                raise ValueError(f'Invalid name: {v}')
        return v
    
    @validator('company_name')
    def validate_company(cls, v):
        """Validate company name"""
        if v:
            v = v.strip()
            if len(v) < 2:
                raise ValueError('Company name must be at least 2 characters')
        return v
    
    @validator('company_website')
    def validate_website(cls, v):
        """Validate and normalize website URL"""
        if v:
            v = v.strip().lower()
            # Remove trailing slashes
            v = v.rstrip('/')
            # Ensure has protocol
            if not v.startswith(('http://', 'https://')):
                v = f'https://{v}'
        return v
    
            if not re.match(r'^\+?[\d]{7,15}$', cleaned):
                logger.warning(f'Potentially invalid phone number: {v}')
        return v
    
    @validator('*', pre=True)
    def empty_str_to_none(cls, v):
        """Convert empty strings to None"""
        if isinstance(v, str) and v.strip() == '':
            return None
        return v
    
    def validate_required_fields(self) -> bool:
        """Check if at least one key field is present"""
        return bool(
            self.founder_email or 
            self.founder_name or 
            self.company_name
        )
    
    class Config:
        # Allow extra fields
        extra = 'allow'
        # Validate on assignment
        validate_assignment = True


class EmailContentValidator(BaseModel):
    """Validate email content before sending"""
    
    email_to: EmailStr
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=10, max_length=50000)
    
    @validator('subject')
    def validate_subject(cls, v):
        """Validate email subject"""
        v = v.strip()
        if len(v) < 1:
            raise ValueError('Subject cannot be empty')
        # Check for spam-like subjects
        spam_words = ['click here', 'buy now', 'limited time', 'act now']
        if any(word in v.lower() for word in spam_words):
            logger.warning(f'Potentially spammy subject: {v}')
        return v
    
    @validator('body')
    def validate_body(cls, v):
        """Validate email body"""
        v = v.strip()
        if len(v) < 10:
            raise ValueError('Email body too short (min 10 characters)')
        if len(v) > 50000:
            raise ValueError('Email body too long (max 50,000 characters)')
        return v
    
    class Config:
        validate_assignment = True


def validate_lead_data(lead_data: dict) -> tuple[bool, Optional[str], Optional[dict]]:
    """
    Validate lead data and return validation result.
    
    Args:
        lead_data: Dictionary containing lead information
    
    Returns:
        Tuple of (is_valid, error_message, validated_data)
    """
    try:
        # Validate using Pydantic model
        validated = LeadValidator(**lead_data)
        
        # Check required fields
        if not validated.validate_required_fields():
            return False, "Missing required fields (need email, name, or company)", None
        
        # Return validated data as dict
        return True, None, validated.dict(exclude_none=True)
        
    except Exception as e:
        logger.error(f"Lead validation failed: {e}")
        return False, str(e), None


def validate_email_content(email_to: str, subject: str, body: str) -> tuple[bool, Optional[str]]:
    """
    Validate email content before sending.
    
    Args:
        email_to: Recipient email address
        subject: Email subject
        body: Email body
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Validate using Pydantic model
        EmailContentValidator(
            email_to=email_to,
            subject=subject,
            body=body
        )
        return True, None
        
    except Exception as e:
        logger.error(f"Email content validation failed: {e}")
        return False, str(e)


def sanitize_string(value: str, max_length: int = 255) -> str:
    """
    Sanitize string input by removing dangerous characters and limiting length.
    
    Args:
        value: String to sanitize
        max_length: Maximum allowed length
    
    Returns:
        Sanitized string
    """
    if not value:
        return ""
    
    # Strip whitespace
    value = value.strip()
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    # Limit length
    if len(value) > max_length:
        value = value[:max_length]
        logger.warning(f"String truncated to {max_length} characters")
    
    return value


def is_valid_timezone(timezone: str) -> bool:
    """
    Check if timezone string is valid.
    
    Args:
        timezone: Timezone string (e.g., "America/New_York")
    
    Returns:
        True if valid, False otherwise
    """
    try:
        import pytz
        pytz.timezone(timezone)
        return True
    except:
        return False
