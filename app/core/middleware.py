"""
FastAPI middleware for request ID tracking and logging.
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import logging
from app.core.logging_config import set_request_id, clear_request_id

logger = logging.getLogger(__name__)

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add request ID to all requests and responses.
    Tracks request duration and logs request/response information.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = set_request_id()
        else:
            set_request_id(request_id)
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        # Log incoming request
        start_time = time.time()
        logger.info(
            f"→ {request.method} {request.url.path} "
            f"(Client: {request.client.host if request.client else 'unknown'})"
        )
        
        try:
            # Process request
            response: Response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            # Log response
            logger.info(
                f"← {request.method} {request.url.path} "
                f"[{response.status_code}] ({duration:.3f}s)"
            )
            
            return response
            
        except Exception as e:
            # Log error
            duration = time.time() - start_time
            logger.error(
                f"✗ {request.method} {request.url.path} "
                f"ERROR ({duration:.3f}s): {str(e)}",
                exc_info=True
            )
            raise
        
        finally:
            # Clear request ID from context
            clear_request_id()


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for detailed request/response logging.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Log request details (DEBUG level)
        logger.debug(
            f"Request details: "
            f"method={request.method}, "
            f"path={request.url.path}, "
            f"query={request.url.query}, "
            f"headers={dict(request.headers)}"
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response details (DEBUG level)
        logger.debug(
            f"Response details: "
            f"status={response.status_code}, "
            f"headers={dict(response.headers)}"
        )
        
        return response
