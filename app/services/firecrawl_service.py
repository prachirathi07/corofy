from typing import Dict, Any, Optional
from app.core.config import settings
import logging
from urllib.parse import urlparse
import httpx
import asyncio

logger = logging.getLogger(__name__)

class FirecrawlService:
    """
    Service for scraping company websites using Firecrawl API v2
    Uses direct HTTP requests to match the v2 API format
    """
    
    def __init__(self):
        self.api_key = settings.FIRECRAWL_API_KEY
        if not self.api_key:
            raise ValueError("FIRECRAWL_API_KEY is required. Please add it to your .env file.")
        if self.api_key == "your_firecrawl_api_key_here" or self.api_key.startswith("your_"):
            raise ValueError("FIRECRAWL_API_KEY is not set. Please add your actual Firecrawl API key to the .env file.")
        
        # Firecrawl v2 API endpoint
        self.api_url = "https://api.firecrawl.dev/v2/scrape"
        
        # Headers for API requests
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Rate limiting: Max 3 concurrent requests to prevent hitting Firecrawl rate limits
        self._semaphore = asyncio.Semaphore(3)
        logger.info("🚦 FIRECRAWL: Rate limiter initialized (max 3 concurrent requests)")
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL to ensure it has proper protocol and format
        """
        if not url:
            return ""
        
        url = url.strip()
        
        # Remove any whitespace
        url = url.strip()
        
        # If already has protocol, validate it
        if url.startswith(("http://", "https://")):
            # Remove any duplicate protocols (e.g., "https://https://example.com")
            while url.startswith("https://https://") or url.startswith("http://http://") or url.startswith("https://http://") or url.startswith("http://https://"):
                if url.startswith("https://https://"):
                    url = url[8:]  # Remove first "https://"
                elif url.startswith("http://http://"):
                    url = url[7:]  # Remove first "http://"
                elif url.startswith("https://http://"):
                    url = "https://" + url[11:]  # Keep https, remove http://
                elif url.startswith("http://https://"):
                    url = "https://" + url[11:]  # Keep https, remove http://
            return url
        
        # If no protocol, add https://
        # But first check if it's a valid domain format
        if "/" in url and not url.startswith("/"):
            # Might be a path, try to extract domain
            parts = url.split("/")
            domain = parts[0]
            url = f"https://{url}"
        else:
            url = f"https://{url}"
        
        return url
    
    def _extract_domain(self, url: str) -> str:
        """
        Extract domain from URL
        """
        if not url:
            return ""
        
        try:
            # If it's already a domain (no protocol), return as is
            if not url.startswith(("http://", "https://")):
                # Remove www. prefix if present
                domain = url.replace("www.", "")
                return domain
            
            # Parse URL to extract domain
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path.split('/')[0]
            
            # Remove www. prefix
            if domain.startswith("www."):
                domain = domain[4:]
            
            return domain
        except Exception as e:
            logger.warning(f"Failed to extract domain from {url}: {e}")
            return url
    
    async def scrape_website(
        self,
        url: str,
        formats: Optional[list] = None,
        include_tags: Optional[list] = None,
        exclude_tags: Optional[list] = None,
        only_main_content: bool = True,
        max_age: Optional[int] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Scrape a website using Firecrawl API v2
        
        Args:
            url: Website URL to scrape
            formats: List of formats to return (e.g., ["markdown", "html"])
            include_tags: List of HTML tags to include
            exclude_tags: List of HTML tags to exclude
            only_main_content: Whether to extract only main content (default: True)
            max_age: Maximum age of cached content in milliseconds
            timeout: Request timeout in seconds
        
        Returns:
            Dict containing scraped content and metadata
        """
        if not url:
            raise ValueError("URL is required for scraping")
        
        # Normalize URL
        url = self._normalize_url(url)
        
        # Validate URL format
        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                error_msg = f"Invalid URL format: {url} - missing domain"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "url": url,
                    "content": None
                }
        except Exception as e:
            error_msg = f"Invalid URL format: {url} - {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "url": url,
                "content": None
            }
        
        # Default formats
        if formats is None:
            formats = ["markdown"]
        
        try:
            # Centralized rate limiting
            from app.core.rate_limiter import rate_limiter
            await rate_limiter.acquire("firecrawl")
            
            # Rate limiting: Acquire semaphore slot (max 3 concurrent requests)
            async with self._semaphore:
                logger.info(f"🌐 FIRECRAWL: Starting scrape for {url}")
                logger.info(f"🌐 FIRECRAWL: API key present: {bool(self.api_key)}")
                logger.info(f"🌐 FIRECRAWL: Formats: {formats}")
            
                # Build payload according to v2 API format
                payload = {
                    "url": url,
                    "formats": formats,
                    "onlyMainContent": only_main_content
                }
                
                # Add optional parameters
                if include_tags:
                    payload["includeTags"] = include_tags
                if exclude_tags:
                    payload["excludeTags"] = exclude_tags
                if max_age is not None:
                    payload["maxAge"] = max_age
                if timeout is not None:
                    payload["timeout"] = timeout
                
                logger.info(f"🌐 FIRECRAWL: Payload: {payload}")
                
                # Make async HTTP request to Firecrawl v2 API
                async with httpx.AsyncClient(timeout=60.0) as client:
                    logger.info(f"🌐 FIRECRAWL: Sending POST request to {self.api_url}")
                    response = await client.post(
                        self.api_url,
                        json=payload,
                        headers=self.headers
                    )
                    
                    logger.info(f"🌐 FIRECRAWL: Response status: {response.status_code}")
                    
                    # Check for HTTP errors
                    if response.status_code != 200:
                        error_msg = f"Firecrawl API error: {response.status_code} - {response.text}"
                        logger.error(f"❌ FIRECRAWL ERROR: {error_msg}")
                        return {
                            "success": False,
                            "error": error_msg,
                            "url": url,
                            "content": None
                        }
                    
                    # Parse response
                    result = response.json()
                    logger.info(f"🌐 FIRECRAWL: Response keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
                    
                    # Check if response has error
                    if "error" in result:
                        error_msg = result.get("error", "Unknown error from Firecrawl")
                        logger.error(f"❌ FIRECRAWL ERROR: {error_msg}")
                        return {
                            "success": False,
                            "error": error_msg,
                            "url": url,
                            "content": None
                        }
                    
                    # Extract data from response
                    # Firecrawl v2 API response structure: {"success": true, "data": {"markdown": "...", "metadata": {...}}}
                    data = result.get("data", {})
                    
                    if not data:
                        # Fallback: maybe response is directly the data
                        data = result if isinstance(result, dict) else {}
                    
                    logger.info(f"🌐 FIRECRAWL: Data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                    
                    # Extract content based on response format
                    markdown_content = ""
                    html_content = ""
                    metadata = {}
                    
                    if isinstance(data, dict):
                        # Check for markdown content (v2 API format)
                        markdown_content = data.get("markdown") or data.get("content", "")
                        html_content = data.get("html", "")
                        metadata = data.get("metadata", {})
                        
                        # If metadata is nested or in different format, try to extract from root
                        if not metadata and "metadata" in result:
                            metadata = result.get("metadata", {})
                        
                        logger.info(f"🌐 FIRECRAWL: Extracted markdown length: {len(markdown_content)}, HTML length: {len(html_content)}")
                    else:
                        # If data is a string, treat as markdown
                        markdown_content = str(data) if data else ""
                        logger.info(f"🌐 FIRECRAWL: Data is string, length: {len(markdown_content)}")
                    
                    # Log if markdown is empty
                    if not markdown_content or len(markdown_content.strip()) == 0:
                        logger.warning(f"⚠️ FIRECRAWL: Markdown content is empty! Response structure: {list(result.keys())}")
                        logger.warning(f"⚠️ FIRECRAWL: Full response data keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
                    
                    logger.info(f"🌐 FIRECRAWL: Final content extracted - Markdown length: {len(markdown_content)}, HTML length: {len(html_content)}")
                    
                    # Ensure metadata is a dict
                    if not isinstance(metadata, dict):
                        metadata = {}
                    
                    logger.info(f"✅ FIRECRAWL SUCCESS: Scraped {url} - Content length: {len(markdown_content)} chars")
                    
                    return {
                        "success": True,
                        "url": url,
                        "domain": self._extract_domain(url),
                        "markdown": markdown_content,
                        "html": html_content,
                        "metadata": metadata,
                        "title": metadata.get("title", "") if isinstance(metadata, dict) else "",
                        "description": metadata.get("description", "") if isinstance(metadata, dict) else "",
                        "content_length": len(markdown_content)
                    }
            
        except httpx.TimeoutException as e:
            error_msg = f"Firecrawl API timeout: {str(e)}"
            logger.error(f"❌ FIRECRAWL TIMEOUT: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "url": url,
                "content": None
            }
        except httpx.RequestError as e:
            error_msg = f"Firecrawl API request error: {str(e)}"
            logger.error(f"❌ FIRECRAWL REQUEST ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "url": url,
                "content": None
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ FIRECRAWL EXCEPTION: Error scraping {url}: {error_msg}", exc_info=True)
            logger.error(f"❌ FIRECRAWL: Exception type: {type(e).__name__}")
            logger.error(f"❌ FIRECRAWL: Exception args: {e.args if hasattr(e, 'args') else 'N/A'}")
            return {
                "success": False,
                "error": error_msg,
                "url": url,
                "content": None
            }
    
    def extract_key_info(self, markdown_content: str) -> Dict[str, Any]:
        """
        Extract key information from scraped content
        This is a simple extraction - can be enhanced with AI later
        
        Args:
            markdown_content: Scraped markdown content
        
        Returns:
            Dict with extracted information (about, services, products, etc.)
        """
        if not markdown_content:
            return {}
        
        # Simple extraction - look for common sections
        content_lower = markdown_content.lower()
        
        extracted = {
            "about": "",
            "services": [],
            "products": [],
            "contact_info": {},
            "key_phrases": []
        }
        
        # Look for "about" section
        about_keywords = ["about us", "about", "who we are", "our story"]
        for keyword in about_keywords:
            idx = content_lower.find(keyword)
            if idx != -1:
                # Extract next 500 characters as about section
                extracted["about"] = markdown_content[idx:idx+500].strip()
                break
        
        # Look for service/product keywords
        service_keywords = ["services", "what we do", "solutions", "offerings"]
        product_keywords = ["products", "our products", "what we offer"]
        
        # Extract key phrases (simple - can be enhanced with NLP)
        lines = markdown_content.split("\n")
        for line in lines[:50]:  # First 50 lines
            if len(line.strip()) > 20 and len(line.strip()) < 200:
                extracted["key_phrases"].append(line.strip())
        
        return extracted

