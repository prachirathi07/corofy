"""
Custom exception classes for better error handling
"""
from typing import Optional

class BaseAPIException(Exception):
    """Base exception for all API errors"""
    def __init__(self, message: str, error_code: str, details: Optional[dict] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class OpenAIQuotaExceeded(BaseAPIException):
    """Raised when OpenAI API quota is exceeded"""
    def __init__(self, details: Optional[dict] = None):
        super().__init__(
            message="OpenAI API quota exceeded. Please check your billing and add credits.",
            error_code="OPENAI_QUOTA_EXCEEDED",
            details=details
        )

class OpenAIRateLimitError(BaseAPIException):
    """Raised when OpenAI rate limit is hit"""
    def __init__(self, details: Optional[dict] = None):
        super().__init__(
            message="OpenAI API rate limit reached. Please wait and try again.",
            error_code="OPENAI_RATE_LIMIT",
            details=details
        )

class FirecrawlQuotaExceeded(BaseAPIException):
    """Raised when Firecrawl API quota is exceeded"""
    def __init__(self, details: Optional[dict] = None):
        super().__init__(
            message="Firecrawl API quota exceeded. Please check your subscription.",
            error_code="FIRECRAWL_QUOTA_EXCEEDED",
            details=details
        )

class FirecrawlRateLimitError(BaseAPIException):
    """Raised when Firecrawl rate limit is hit"""
    def __init__(self, details: Optional[dict] = None):
        super().__init__(
            message="Firecrawl API rate limit reached. Requests are being queued.",
            error_code="FIRECRAWL_RATE_LIMIT",
            details=details
        )

class SupabaseConnectionError(BaseAPIException):
    """Raised when Supabase connection fails"""
    def __init__(self, details: Optional[dict] = None):
        super().__init__(
            message="Database connection failed. Please check your Supabase configuration.",
            error_code="SUPABASE_CONNECTION_ERROR",
            details=details
        )

class LeadNotFoundError(BaseAPIException):
    """Raised when a lead is not found"""
    def __init__(self, lead_id: str):
        super().__init__(
            message=f"Lead with ID {lead_id} not found.",
            error_code="LEAD_NOT_FOUND",
            details={"lead_id": lead_id}
        )

class EmailGenerationError(BaseAPIException):
    """Raised when email generation fails"""
    def __init__(self, reason: str, details: Optional[dict] = None):
        super().__init__(
            message=f"Email generation failed: {reason}",
            error_code="EMAIL_GENERATION_ERROR",
            details=details
        )

class WebsiteScrapingError(BaseAPIException):
    """Raised when website scraping fails"""
    def __init__(self, url: str, reason: str):
        super().__init__(
            message=f"Failed to scrape {url}: {reason}",
            error_code="WEBSITE_SCRAPING_ERROR",
            details={"url": url, "reason": reason}
        )
