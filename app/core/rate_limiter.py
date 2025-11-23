"""
Centralized Rate Limiter for all external APIs
Prevents hitting rate limits and getting blocked
"""

import asyncio
import time
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Token bucket rate limiter for API calls.
    Supports multiple APIs with different rate limits.
    """
    
    def __init__(self):
        # Track rate limits for each API
        self.limiters: Dict[str, Dict] = {
            # Firecrawl: 10 requests per minute (free tier)
            "firecrawl": {
                "max_requests": 10,
                "time_window": 60,  # seconds
                "requests": [],
                "last_request": None,
                "min_delay": 6.0  # 6 seconds between requests
            },
            
            # OpenAI: 3 requests per minute (tier 1), 200 requests per day
            "openai": {
                "max_requests": 3,
                "time_window": 60,  # seconds
                "requests": [],
                "last_request": None,
                "min_delay": 20.0,  # 20 seconds between requests
                "daily_max": 200,
                "daily_requests": [],
                "daily_window": 86400  # 24 hours
            },
            
            # Gmail/n8n webhook: 250 requests per 100 seconds
            "gmail": {
                "max_requests": 40,  # Conservative: 40 per minute
                "time_window": 60,
                "requests": [],
                "last_request": None,
                "min_delay": 1.5  # 1.5 seconds between emails
            },
            
            # Apollo: 10 requests per minute (conservative)
            "apollo": {
                "max_requests": 10,
                "time_window": 60,
                "requests": [],
                "last_request": None,
                "min_delay": 6.0
            }
        }
        
        # Start periodic cleanup task
        import asyncio
        asyncio.create_task(self._periodic_cleanup())
        logger.info("🧹 Rate limiter initialized with periodic cleanup")
    
    async def _periodic_cleanup(self):
        """
        Periodic cleanup task to prevent memory leaks.
        Runs every 5 minutes to remove old request records.
        """
        while True:
            try:
                await asyncio.sleep(300)  # 5 minutes
                self._cleanup_all()
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
    
    def _cleanup_all(self):
        """Remove old requests from all limiters to prevent memory leaks"""
        current_time = time.time()
        total_cleaned = 0
        
        for api_name, limiter in self.limiters.items():
            # Count before cleanup
            before_count = len(limiter["requests"])
            
            # Clean time window requests
            limiter["requests"] = [
                req for req in limiter["requests"]
                if current_time - req < limiter["time_window"]
            ]
            
            # Clean daily requests if applicable
            if "daily_requests" in limiter:
                before_daily = len(limiter["daily_requests"])
                limiter["daily_requests"] = [
                    req for req in limiter["daily_requests"]
                    if current_time - req < limiter["daily_window"]
                ]
                total_cleaned += (before_daily - len(limiter["daily_requests"]))
            
            total_cleaned += (before_count - len(limiter["requests"]))
        
        if total_cleaned > 0:
            logger.debug(f"🧹 Cleaned up {total_cleaned} old request records")
    
    async def acquire(self, api_name: str) -> bool:
        """
        Acquire permission to make an API call.
        Blocks until rate limit allows the request.
        
        Args:
            api_name: Name of the API (firecrawl, openai, gmail, apollo)
        
        Returns:
            True when ready to proceed
        """
        if api_name not in self.limiters:
            logger.warning(f"Unknown API: {api_name}, allowing request")
            return True
        
        limiter = self.limiters[api_name]
        current_time = time.time()
        
        # Clean up old requests outside the time window
        limiter["requests"] = [
            req_time for req_time in limiter["requests"]
            if current_time - req_time < limiter["time_window"]
        ]
        
        # Check daily limit if applicable (OpenAI)
        if "daily_max" in limiter:
            limiter["daily_requests"] = [
                req_time for req_time in limiter["daily_requests"]
                if current_time - req_time < limiter["daily_window"]
            ]
            
            if len(limiter["daily_requests"]) >= limiter["daily_max"]:
                logger.error(f"🚫 {api_name.upper()} daily limit reached ({limiter['daily_max']} requests/day)")
                raise Exception(f"{api_name} daily rate limit exceeded")
        
        # Check if we need to wait for minimum delay
        if limiter["last_request"]:
            time_since_last = current_time - limiter["last_request"]
            if time_since_last < limiter["min_delay"]:
                wait_time = limiter["min_delay"] - time_since_last
                logger.info(f"⏳ {api_name.upper()} rate limit: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
                current_time = time.time()
        
        # Check if we're at the rate limit
        while len(limiter["requests"]) >= limiter["max_requests"]:
            # Wait until the oldest request expires
            oldest_request = limiter["requests"][0]
            wait_time = limiter["time_window"] - (current_time - oldest_request)
            
            if wait_time > 0:
                logger.warning(
                    f"⚠️ {api_name.upper()} rate limit: {len(limiter['requests'])}/{limiter['max_requests']} "
                    f"requests in {limiter['time_window']}s window. Waiting {wait_time:.1f}s..."
                )
                await asyncio.sleep(wait_time + 0.1)  # Add small buffer
                current_time = time.time()
            
            # Clean up again
            limiter["requests"] = [
                req_time for req_time in limiter["requests"]
                if current_time - req_time < limiter["time_window"]
            ]
        
        # Record this request
        limiter["requests"].append(current_time)
        limiter["last_request"] = current_time
        
        if "daily_requests" in limiter:
            limiter["daily_requests"].append(current_time)
        
        logger.info(
            f"✅ {api_name.upper()} rate limit OK: "
            f"{len(limiter['requests'])}/{limiter['max_requests']} requests in window"
        )
        
        return True
    
    def get_stats(self, api_name: str) -> Dict:
        """Get current rate limit statistics for an API"""
        if api_name not in self.limiters:
            return {}
        
        limiter = self.limiters[api_name]
        current_time = time.time()
        
        # Clean up old requests
        limiter["requests"] = [
            req_time for req_time in limiter["requests"]
            if current_time - req_time < limiter["time_window"]
        ]
        
        stats = {
            "api": api_name,
            "current_requests": len(limiter["requests"]),
            "max_requests": limiter["max_requests"],
            "time_window": limiter["time_window"],
            "remaining": limiter["max_requests"] - len(limiter["requests"])
        }
        
        if "daily_max" in limiter:
            limiter["daily_requests"] = [
                req_time for req_time in limiter["daily_requests"]
                if current_time - req_time < limiter["daily_window"]
            ]
            stats["daily_requests"] = len(limiter["daily_requests"])
            stats["daily_max"] = limiter["daily_max"]
            stats["daily_remaining"] = limiter["daily_max"] - len(limiter["daily_requests"])
        
        return stats

# Global rate limiter instance
rate_limiter = RateLimiter()
