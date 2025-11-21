"""
Global exception handlers for FastAPI
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.exceptions import BaseAPIException
import logging

logger = logging.getLogger(__name__)

async def base_api_exception_handler(request: Request, exc: BaseAPIException):
    """Handle custom API exceptions"""
    logger.error(f"API Exception: {exc.error_code} - {exc.message}", extra=exc.details)
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "details": {"error_type": type(exc).__name__}
            }
        }
    )
