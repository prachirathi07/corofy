"""
Error handling utilities for API services
Provides standardized error detection and user-friendly messages
"""
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class APIError(Exception):
    """Custom exception for API errors with error type"""
    def __init__(self, message: str, error_type: str = "unknown", status_code: Optional[int] = None):
        self.message = message
        self.error_type = error_type
        self.status_code = status_code
        super().__init__(self.message)

def detect_error_type(error: Exception, status_code: Optional[int] = None, error_text: Optional[str] = None) -> Dict[str, Any]:
    """
    Detect error type and return user-friendly message
    
    Args:
        error: Exception object
        status_code: HTTP status code if available
        error_text: Error text/response if available
        
    Returns:
        Dict with error_type, user_message, and technical_message
    """
    error_str = str(error).lower()
    error_text_lower = (error_text or "").lower()
    
    # Check status codes first
    if status_code == 401:
        return {
            "error_type": "authentication",
            "user_message": "API authentication failed. Please check your API key.",
            "technical_message": f"Authentication error (401): {str(error)}",
            "status_code": 401
        }
    
    if status_code == 402:
        return {
            "error_type": "quota",
            "user_message": "Insufficient credits/quota. Please add credits to your account.",
            "technical_message": f"Insufficient credits (402): {str(error)}",
            "status_code": 402
        }
    
    if status_code == 429:
        return {
            "error_type": "rate_limit",
            "user_message": "Rate limit exceeded. Please try again in a few minutes.",
            "technical_message": f"Rate limit exceeded (429): {str(error)}",
            "status_code": 429
        }
    
    if status_code == 403:
        return {
            "error_type": "permission",
            "user_message": "Access forbidden. Please check your API key permissions.",
            "technical_message": f"Permission denied (403): {str(error)}",
            "status_code": 403
        }
    
    if status_code == 404:
        return {
            "error_type": "not_found",
            "user_message": "Resource not found. Please check your request parameters.",
            "technical_message": f"Not found (404): {str(error)}",
            "status_code": 404
        }
    
    # Check error text for quota/rate limit keywords
    if "quota" in error_str or "quota" in error_text_lower or "insufficient_quota" in error_str:
        return {
            "error_type": "quota",
            "user_message": "API quota exceeded. Please upgrade your plan or add credits.",
            "technical_message": f"Quota error: {str(error)}",
            "status_code": status_code
        }
    
    if "rate limit" in error_str or "rate_limit" in error_str or "429" in error_str:
        return {
            "error_type": "rate_limit",
            "user_message": "Rate limit exceeded. Please wait before trying again.",
            "technical_message": f"Rate limit error: {str(error)}",
            "status_code": status_code or 429
        }
    
    if "insufficient credits" in error_str or "insufficient credits" in error_text_lower:
        return {
            "error_type": "quota",
            "user_message": "Insufficient credits. Please add credits to your account.",
            "technical_message": f"Insufficient credits: {str(error)}",
            "status_code": status_code or 402
        }
    
    if "authentication" in error_str or "unauthorized" in error_str or "401" in error_str:
        return {
            "error_type": "authentication",
            "user_message": "Authentication failed. Please check your API key.",
            "technical_message": f"Authentication error: {str(error)}",
            "status_code": status_code or 401
        }
    
    if "timeout" in error_str or "timed out" in error_str:
        return {
            "error_type": "timeout",
            "user_message": "Request timed out. Please try again.",
            "technical_message": f"Timeout error: {str(error)}",
            "status_code": status_code
        }
    
    if "network" in error_str or "connection" in error_str:
        return {
            "error_type": "network",
            "user_message": "Network error. Please check your internet connection and try again.",
            "technical_message": f"Network error: {str(error)}",
            "status_code": status_code
        }
    
    # Default unknown error
    return {
        "error_type": "unknown",
        "user_message": f"An error occurred: {str(error)}",
        "technical_message": str(error),
        "status_code": status_code
    }

def format_error_response(error: Exception, service_name: str, status_code: Optional[int] = None, error_text: Optional[str] = None) -> Dict[str, Any]:
    """
    Format error response for API endpoints
    
    Args:
        error: Exception object
        service_name: Name of the service (e.g., "OpenAI", "Apollo", "Apify")
        status_code: HTTP status code if available
        error_text: Error text/response if available
        
    Returns:
        Dict with error details for API response
    """
    error_info = detect_error_type(error, status_code, error_text)
    
    logger.error(f"❌ {service_name} Error ({error_info['error_type']}): {error_info['technical_message']}")
    
    return {
        "success": False,
        "error": error_info["user_message"],
        "error_type": error_info["error_type"],
        "service": service_name,
        "status_code": error_info["status_code"],
        "technical_details": error_info["technical_message"]
    }

