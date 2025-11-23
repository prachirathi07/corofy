"""
Retry helper utilities for API calls
Provides decorators for automatic retry with exponential backoff
"""

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    after_log
)
import httpx
import logging

logger = logging.getLogger(__name__)

def api_retry(max_attempts=3, min_wait=2, max_wait=10):
    """
    Retry decorator for API calls with exponential backoff.
    Only retries on transient network errors, not on client errors (4xx).
    
    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 2)
        max_wait: Maximum wait time between retries in seconds (default: 10)
    
    Usage:
        @api_retry()
        async def call_external_api():
            response = await client.post(url, json=data)
            return response
    
    Returns:
        Tenacity retry decorator configured for API calls
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((
            httpx.TimeoutException,
            httpx.NetworkError,
            httpx.ConnectError,
            httpx.RemoteProtocolError
        )),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        after=after_log(logger, logging.INFO),
        reraise=True
    )

def database_retry(max_attempts=3, min_wait=1, max_wait=5):
    """
    Retry decorator for database operations.
    Retries on connection errors and timeouts.
    
    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 1)
        max_wait: Maximum wait time between retries in seconds (default: 5)
    
    Usage:
        @database_retry()
        def query_database():
            return db.table("users").select("*").execute()
    
    Returns:
        Tenacity retry decorator configured for database operations
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((
            ConnectionError,
            TimeoutError,
            Exception  # Catch Supabase-specific errors
        )),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )
