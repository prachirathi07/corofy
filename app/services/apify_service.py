"""
Apify service for lead scraping
Supports Apify Actors for lead data extraction
"""
import httpx
import json
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.models.lead import map_apollo_to_scraped_data
import logging
import asyncio

logger = logging.getLogger(__name__)

class ApifyService:
    """
    Service for scraping leads using Apify Actors
    """
    BASE_URL = "https://api.apify.com/v2"
    
    def __init__(self):
        self.api_token = settings.APIFY_API_TOKEN
        if not self.api_token:
            raise ValueError("APIFY_API_TOKEN is required. Please add it to your .env file.")
        if self.api_token == "your_apify_api_token_here" or (self.api_token and self.api_token.startswith("your_")):
            raise ValueError("APIFY_API_TOKEN is not set. Please add your actual Apify API token to the .env file.")
        
        self.actor_id = settings.APIFY_ACTOR_ID  # Can be "username~actor-name" or just actor ID like "VYRyEF4ygTTkaIghe"
        if not self.actor_id:
            raise ValueError("APIFY_ACTOR_ID is required. Please add it to your .env file.")
        if self.actor_id == "your_apify_actor_id_here" or self.actor_id.startswith("your_"):
            raise ValueError("APIFY_ACTOR_ID is not set. Please add your actual Apify actor ID to the .env file.")
    
    async def get_run_status(self, run_id: str) -> Dict[str, Any]:
        """
        Get the status of an actor run
        
        Args:
            run_id: The run ID to check
        
        Returns:
            Dict containing run status information
        """
        url = f"{self.BASE_URL}/actor-runs/{run_id}"
        
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Accept": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            raise Exception(f"Failed to get run status ({e.response.status_code}): {e.response.text}")
        except httpx.HTTPError as e:
            raise Exception(f"Failed to get run status: {str(e)}")
    
    async def run_actor(
        self,
        input_data: Dict[str, Any],
        wait_for_finish: bool = True,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Run an Apify Actor with given input
        
        Args:
            input_data: Input data for the actor
            wait_for_finish: Whether to wait for actor to finish
            timeout: Maximum time to wait in seconds
        
        Returns:
            Dict containing run information and dataset items
        """
        if not self.actor_id:
            raise ValueError("APIFY_ACTOR_ID is required. Please specify which actor to run.")
        
        url = f"{self.BASE_URL}/acts/{self.actor_id}/runs"
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Apify API: Use token and waitForFinish as query parameters (matching test_scrape.py)
        params = {
            "token": self.api_token
        }
        
        # Add waitForFinish as query parameter (number in seconds, matching test_scrape.py)
        # test_scrape.py uses: params={"token": TOKEN, "waitForFinish": 60}
        if wait_for_finish:
            params["waitForFinish"] = timeout if timeout else 60  # Use timeout value or default to 60 seconds
        
        # Apify API structure: send input data directly in JSON body (not wrapped in "input")
        # This matches your test_scrape.py format
        if input_data:
            if not isinstance(input_data, dict):
                raise ValueError(f"Input data must be a dictionary, got {type(input_data)}")
            payload = input_data
        else:
            # Even if empty, provide an empty object
            payload = {}
        
        logger.info(f"POST {url}")
        logger.info(f"Query params: {params}")
        logger.info(f"Request body: {json.dumps(payload, indent=2)}")
        
        try:
            async with httpx.AsyncClient(timeout=timeout + 10) as client:
                response = await client.post(
                    url, 
                    json=payload,  # Input data goes directly in body (matching test_scrape.py)
                    params=params,  # Token and waitForFinish as query params
                    headers=headers
                )
                
                if response.status_code == 401:
                    from app.utils.error_handler import APIError
                    error_detail = response.text
                    logger.error(f"Apify API authentication failed (401): {error_detail}")
                    raise APIError("Apify API authentication failed. Please verify your APIFY_API_TOKEN.", "authentication", 401)
                
                if response.status_code == 402:
                    from app.utils.error_handler import APIError
                    error_detail = response.text
                    logger.error(f"Apify API insufficient credits (402): {error_detail}")
                    raise APIError("Apify API: Insufficient credits. Please add credits to your Apify account.", "quota", 402)
                
                if response.status_code == 400:
                    error_detail = response.text
                    logger.error(f"Apify API bad request (400): {error_detail}")
                    logger.error(f"Request URL: {url}")
                    logger.error(f"Request params: {params}")
                    logger.error(f"Request body: {json.dumps(payload, indent=2)}")
                    # Try to parse error message from response
                    try:
                        error_json = response.json()
                        error_message = error_json.get("error", {}).get("message", error_detail)
                        raise Exception(f"Apify API: Bad request (400). {error_message}. Check your input data format.")
                    except:
                        raise Exception(f"Apify API: Bad request (400). {error_detail}. Check your input data format and actor requirements.")
                
                # Check for 201 (Created) status like in test_scrape.py
                if response.status_code == 201:
                    result = response.json()
                    logger.info(f"✅ Actor run started/completed (201). Response keys: {list(result.keys())}")
                    return result
                
                response.raise_for_status()
                result = response.json()
                logger.info(f"Apify API response status: {response.status_code}")
                return result
        
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else "No response details"
            logger.error(f"Apify API HTTP error ({e.response.status_code}): {error_detail}")
            raise Exception(f"Apify API error ({e.response.status_code}): {error_detail}")
        except httpx.TimeoutException:
            logger.error(f"Apify API request timed out after {timeout + 10} seconds")
            raise Exception(f"Apify API request timed out. The actor may still be running. Check your Apify dashboard.")
        except httpx.HTTPError as e:
            logger.error(f"Apify API HTTP error: {str(e)}")
            raise Exception(f"Failed to run Apify actor: {str(e)}")
    
    async def get_dataset_items(
        self,
        dataset_id: str,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get items from an Apify dataset
        
        Args:
            dataset_id: Dataset ID
            limit: Maximum number of items to return
            offset: Offset for pagination
        
        Returns:
            List of dataset items
        """
        url = f"{self.BASE_URL}/datasets/{dataset_id}/items"
        
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Accept": "application/json"
        }
        
        # Use token as query parameter (alternative to Bearer header)
        params = {
            "token": self.api_token,
            "offset": offset
        }
        
        if limit:
            params["limit"] = limit
        
        logger.info(f"GET {url} (dataset: {dataset_id}, limit: {limit}, offset: {offset})")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url, headers=headers, params=params)
                
                if response.status_code == 404:
                    raise Exception(f"Dataset not found (404). Dataset ID: {dataset_id}. The dataset may not be available yet.")
                
                response.raise_for_status()
                items = response.json()
                logger.info(f"Retrieved {len(items)} items from dataset {dataset_id}")
                return items
        
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else "No response details"
            logger.error(f"Failed to get dataset items ({e.response.status_code}): {error_detail}")
            raise Exception(f"Failed to get dataset items ({e.response.status_code}): {error_detail}")
        except httpx.TimeoutException:
            logger.error("Request to get dataset items timed out")
            raise Exception("Request to get dataset items timed out. The dataset may be large.")
        except httpx.HTTPError as e:
            logger.error(f"Failed to get dataset items: {str(e)}")
            raise Exception(f"Failed to get dataset items: {str(e)}")
    
    async def run_actor_sync_get_items(
        self,
        input_data: Dict[str, Any],
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Run actor synchronously and get dataset items directly
        
        Uses the standard Apify flow: start run -> wait for finish -> get dataset items
        
        Args:
            input_data: Input data for the actor (must be a dict/object)
            limit: Maximum number of items to return
        
        Returns:
            List of dataset items
        """
        if not self.actor_id:
            raise ValueError("APIFY_ACTOR_ID is required.")
        
        # Ensure input_data is a dict/object (Apify requirement)
        if not isinstance(input_data, dict):
            raise ValueError(f"Input data must be a dictionary/object, got {type(input_data)}")
        
        logger.info(f"Running Apify actor {self.actor_id} with input: {input_data}")
        
        try:
            # Step 1: Start the actor run
            run_result = await self.run_actor(
                input_data=input_data,
                wait_for_finish=True,
                timeout=600
            )
            
            logger.info(f"Actor run completed. Response keys: {list(run_result.keys())}")
            
            # Step 2: Extract run ID and dataset ID (matching test_scrape.py format)
            # Your test script shows: result.get('data', {}).get('id') and result.get('data', {}).get('defaultDatasetId')
            run_id = None
            dataset_id = None
            status = None
            
            # Extract from data object (matching test_scrape.py)
            if "data" in run_result:
                data = run_result["data"]
                run_id = data.get("id")
                dataset_id = data.get("defaultDatasetId")
                status = data.get("status")
                logger.info(f"Run ID: {run_id}, Dataset ID: {dataset_id}, Status: {status}")
            
            # If not in data, try top-level
            if not run_id:
                run_id = run_result.get("id")
            if not dataset_id:
                dataset_id = run_result.get("defaultDatasetId")
            if not status:
                status = run_result.get("status")
            
            # Check status
            if status:
                status_upper = status.upper()
                logger.info(f"Run status: {status_upper}")
                if status_upper in ["FAILED", "ABORTED"]:
                    error_message = run_result.get("data", {}).get("statusMessage", "Unknown error")
                    raise Exception(f"Apify actor run {status_upper.lower()}: {error_message}")
            
            # If we have run_id but no dataset_id, check run status
            if run_id and not dataset_id:
                logger.info(f"Dataset ID not in initial response, checking run status for run {run_id}")
                try:
                    run_status = await self.get_run_status(run_id)
                    status_data = run_status.get("data", {})
                    
                    # Get dataset ID from run status
                    dataset_id = status_data.get("defaultDatasetId") or run_status.get("defaultDatasetId")
                    logger.info(f"Got dataset ID from run status: {dataset_id}")
                except Exception as status_error:
                    logger.warning(f"Could not fetch run status: {status_error}")
            
            if not dataset_id:
                logger.error(f"Could not find dataset ID in run result. Full response: {json.dumps(run_result, indent=2, default=str)[:2000]}")
                raise Exception(f"Apify actor run completed but no dataset ID found. Run ID: {run_id}. Check your Apify dashboard.")
            
            logger.info(f"Fetching dataset items from dataset: {dataset_id}")
            
            # Step 3: Get dataset items (matching test_scrape.py format)
            try:
                items = await self.get_dataset_items(
                    dataset_id=dataset_id,
                    limit=limit
                )
                
                logger.info(f"✅ Retrieved {len(items)} items from dataset {dataset_id}")
                
                # Log first item structure for debugging
                if items and len(items) > 0:
                    logger.info(f"Sample item structure (keys): {list(items[0].keys()) if isinstance(items[0], dict) else 'Not a dict'}")
                    logger.info(f"Sample item (first 500 chars): {json.dumps(items[0], indent=2, default=str)[:500]}...")
                else:
                    logger.warning(f"⚠️ No items returned from Apify dataset {dataset_id}")
                
                return items
            except Exception as dataset_error:
                logger.error(f"Failed to get dataset items from {dataset_id}: {dataset_error}", exc_info=True)
                raise Exception(f"Failed to retrieve dataset items: {str(dataset_error)}") from dataset_error
        
        except Exception as e:
            logger.error(f"Error in run_actor_sync_get_items: {e}", exc_info=True)
            raise
    
    def parse_apify_response(
        self,
        items: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Parse Apify dataset items into scraped_data table format
        
        This method handles various Apify actor output formats.
        Tries multiple field name variations to extract lead data.
        
        Args:
            items: List of items from Apify dataset
        
        Returns:
            List of dicts matching scraped_data table format
        """
        leads = []
        
        if not items:
            logger.warning("No items to parse from Apify response")
            return leads
        
        logger.info(f"Parsing {len(items)} items from Apify")
        
        for idx, item in enumerate(items):
            try:
                if not isinstance(item, dict):
                    logger.warning(f"Item {idx} is not a dictionary: {type(item)}")
                    continue
                
                # Try multiple field name variations (camelCase, snake_case, etc.)
                # Name fields
                first_name = (
                    item.get("firstName") or 
                    item.get("first_name") or 
                    item.get("firstName") or
                    (item.get("name", "").split()[0] if item.get("name") and len(item.get("name", "").split()) > 0 else None)
                )
                
                last_name = (
                    item.get("lastName") or 
                    item.get("last_name") or 
                    (item.get("name", "").split()[1] if item.get("name") and len(item.get("name", "").split()) > 1 else None)
                )
                
                # Email fields
                email = (
                    item.get("email") or 
                    item.get("emailAddress") or
                    item.get("email_address") or
                    item.get("workEmail") or
                    item.get("work_email")
                )
                
                # Title fields
                title = (
                    item.get("title") or 
                    item.get("jobTitle") or 
                    item.get("job_title") or
                    item.get("position") or
                    item.get("jobRole") or
                    item.get("job_role")
                )
                
                # Company fields
                company_name = (
                    item.get("companyName") or 
                    item.get("company_name") or
                    item.get("company") or 
                    item.get("organization") or
                    item.get("organizationName") or
                    item.get("organization_name")
                )
                
                company_domain = (
                    item.get("companyDomain") or 
                    item.get("company_domain") or
                    item.get("domain") or 
                    item.get("website") or
                    item.get("companyWebsite") or
                    item.get("company_website")
                )
                
                # Extract domain from URL if needed
                if company_domain and "http" in str(company_domain):
                    from urllib.parse import urlparse
                    try:
                        parsed = urlparse(company_domain)
                        company_domain = parsed.netloc or parsed.path.strip("/")
                    except:
                        pass
                
                company_website = (
                    item.get("companyWebsite") or 
                    item.get("company_website") or
                    item.get("website") or 
                    (f"https://{company_domain}" if company_domain and not company_domain.startswith("http") else None)
                )
                
                # Other fields
                company_employee_size = (
                    item.get("employeeSize") or 
                    item.get("employee_size") or
                    item.get("employees") or 
                    item.get("companySize") or
                    item.get("company_size")
                )
                
                company_country = (
                    item.get("country") or 
                    item.get("location") or
                    item.get("companyCountry") or
                    item.get("company_country")
                )
                
                company_industry = (
                    item.get("industry") or 
                    item.get("sector") or
                    item.get("companyIndustry") or
                    item.get("company_industry")
                )
                
                phone = (
                    item.get("phone") or 
                    item.get("phoneNumber") or
                    item.get("phone_number") or
                    item.get("mobile") or
                    item.get("workPhone") or
                    item.get("work_phone")
                )
                
                location = (
                    item.get("location") or 
                    item.get("city") or
                    item.get("cityName") or
                    item.get("city_name")
                )
                
                linkedin_url = (
                    item.get("linkedIn") or 
                    item.get("linkedInUrl") or 
                    item.get("linkedin_url") or
                    item.get("profileUrl") or
                    item.get("profile_url") or
                    item.get("linkedinProfile") or
                    item.get("linkedin_profile")
                )
                
                # Combine first and last name
                full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else None
                
                # Create lead dict matching scraped_data table format
                lead_data = {
                    "founder_name": full_name,
                    "company_name": company_name,
                    "position": title,
                    "founder_email": email,
                    "founder_linkedin": linkedin_url,
                    "founder_address": location,
                    "company_industry": company_industry,
                    "company_website": company_website,
                    "company_linkedin": item.get("companyLinkedIn") or item.get("company_linkedin"),
                    "company_blogpost": None,  # Not typically in Apify data
                    "company_angellist": None,  # Not typically in Apify data
                    "company_phone": phone,
                    "mail_status": "new",
                    "is_verified": False,
                    "followup_5_sent": False,
                    "followup_10_sent": False
                }
                
                # Only add if we have at least email or name
                if lead_data["founder_email"] or lead_data["founder_name"]:
                    leads.append(lead_data)
                    logger.debug(f"Parsed lead {len(leads)}: {lead_data['founder_name']} - {lead_data['founder_email']} ({lead_data['company_name']})")
                else:
                    logger.warning(f"Skipping item {idx}: No email or name found. Keys: {list(item.keys())}")
            
            except Exception as e:
                logger.error(f"Failed to parse Apify item {idx}: {e}. Item keys: {list(item.keys()) if isinstance(item, dict) else 'Not a dict'}", exc_info=True)
                continue
        
        logger.info(f"Successfully parsed {len(leads)} leads from {len(items)} items")
        return leads
    
    def _is_c_suite(self, title: str) -> bool:
        """Check if title is C-suite"""
        if not title:
            return False
        
        title_lower = title.lower()
        c_suite_keywords = ["ceo", "coo", "cfo", "cto", "president", "founder", "owner", "director", "board"]
        return any(keyword in title_lower for keyword in c_suite_keywords)
    
    def _convert_employee_size_to_ranges(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None
    ) -> List[str]:
        """
        Convert employee size min/max to your Apify actor's range format
        
        Your actor uses: "101-200", "51-100", etc. (no spaces around dash)
        
        Args:
            employee_size_min: Minimum employee size
            employee_size_max: Maximum employee size
        
        Returns:
            List of range strings that match the criteria
        """
        if employee_size_min is None and employee_size_max is None:
            return []
        
        # Define your actor's employee size ranges (no spaces, as in your working example: "101-200")
        apify_ranges = [
            (1, 10, "1-10"),
            (11, 50, "11-50"),
            (51, 100, "51-100"),
            (101, 200, "101-200"),
            (201, 500, "201-500"),
            (501, 1000, "501-1000"),
            (1001, 5000, "1001-5000"),
            (5001, 10000, "5001-10000"),
            (10001, None, "10001+")
        ]
        
        matching_ranges = []
        
        for range_min, range_max, range_str in apify_ranges:
            # Check if this range overlaps with the requested range
            if employee_size_max is None:
                # No max limit, include all ranges >= min
                if range_max is None or range_max >= (employee_size_min or 1):
                    matching_ranges.append(range_str)
            elif employee_size_min is None:
                # No min limit, include all ranges <= max
                if range_min <= employee_size_max:
                    matching_ranges.append(range_str)
            else:
                # Both min and max specified
                # Range overlaps if: range_min <= employee_size_max AND (range_max is None OR range_max >= employee_size_min)
                if range_min <= employee_size_max and (range_max is None or range_max >= employee_size_min):
                    matching_ranges.append(range_str)
        
        return matching_ranges if matching_ranges else ["1-10"]  # Default to smallest range if none match
    
    async def search_leads(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None,
        countries: Optional[List[str]] = None,
        sic_codes: Optional[List[str]] = None,
        c_suites: Optional[List[str]] = None,
        industry: Optional[str] = None,
        total_leads_wanted: Optional[int] = None,
        **actor_specific_params
    ) -> Dict[str, Any]:
        """
        Search for leads using Apify actor
        
        Maps frontend parameters to Apify's expected input format.
        
        Args:
            employee_size_min: Minimum employee size
            employee_size_max: Maximum employee size
            countries: List of country names (e.g., ["India", "United States"])
            sic_codes: List of SIC codes (optional, not in default Apify format)
            c_suites: List of C-suite titles (e.g., ["CEO", "COO", "Founder"])
            industry: Industry name (e.g., "Oil & Energy")
            total_leads_wanted: Target number of leads
            **actor_specific_params: Additional actor-specific parameters
        
        Returns:
            Dict containing leads data
        """
        # Build input data matching your working Apify actor input schema
        input_data = {}
        
        # Employee size - convert to Apify's range format
        # Your actor uses: "101-200", "51-100", etc. (no spaces)
        if employee_size_min is not None or employee_size_max is not None:
            employee_ranges = self._convert_employee_size_to_ranges(
                employee_size_min, employee_size_max
            )
            if employee_ranges:
                input_data["companyEmployeeSizeIncludes"] = employee_ranges
        
        # Countries - map to companyLocationCountryIncludes and personLocationCountryIncludes
        if countries:
            # Apify expects country names as-is (e.g., "India", "United States")
            input_data["companyLocationCountryIncludes"] = countries
            input_data["personLocationCountryIncludes"] = countries
        
        # Industry - your actor uses companyIndustry as a list
        if industry:
            # All allowed industry values from Apify
            allowed_industries = [
                "Accounting", "Agriculture", "Airlines/Aviation", "Alternative Dispute Resolution",
                "Animation", "Apparel & Fashion", "Architecture & Planning", "Arts & Crafts",
                "Automotive", "Aviation & Aerospace", "Banking", "Biotechnology",
                "Broadcast Media", "Building Materials", "Business Supplies & Equipment",
                "Capital Markets", "Chemicals", "Civic & Social Organization", "Civil Engineering",
                "Commercial Real Estate", "Computer & Network Security", "Computer Games",
                "Computer Hardware", "Computer Networking", "Computer Software", "Construction",
                "Consumer Electronics", "Consumer Goods", "Consumer Services", "Cosmetics",
                "Dairy", "Defense & Space", "Design", "E-Learning", "Education Management",
                "Electrical/Electronic Manufacturing", "Entertainment", "Environmental Services",
                "Events Services", "Executive Office", "Facilities Services", "Farming",
                "Financial Services", "Fine Art", "Food & Beverages", "Food Production",
                "Fundraising", "Furniture", "Gambling & Casinos", "Glass, Ceramics & Concrete",
                "Government Administration", "Government Relations", "Graphic Design",
                "Health, Wellness & Fitness", "Higher Education", "Hospital & Health Care",
                "Hospitality", "Human Resources", "Import & Export", "Individual & Family Services",
                "Industrial Automation", "Information Services", "Information Technology & Services",
                "Insurance", "International Affairs", "International Trade & Development",
                "Internet", "Investment Banking", "Investment Management", "Judiciary",
                "Law Enforcement", "Law Practice", "Legal Services", "Legislative Office",
                "Leisure, Travel & Tourism", "Libraries", "Logistics & Supply Chain",
                "Luxury Goods & Jewelry", "Machinery", "Management Consulting", "Maritime",
                "Market Research", "Marketing & Advertising", "Mechanical or Industrial Engineering",
                "Media Production", "Medical Devices", "Medical Practice", "Mental Health Care",
                "Military", "Mining & Metals", "Motion Pictures & Film", "Museums & Institutions",
                "Music", "Nanotechnology", "Newspapers", "Non-Profit Organization Management",
                "Non-Profits & Non-Profit Services", "Oil & Energy", "Online Media",
                "Outsourcing/Offshoring", "Package/Freight Delivery", "Packaging & Containers",
                "Paper & Forest Products", "Performing Arts", "Pharmaceuticals", "Philanthropy",
                "Photography", "Plastics", "Political Organization", "Primary/Secondary Education",
                "Printing", "Professional Training & Coaching", "Program Development",
                "Public Policy", "Public Relations & Communications", "Public Safety", "Publishing",
                "Railroad Manufacture", "Ranching", "Real Estate", "Recreation & Sports",
                "Recreational Facilities & Services", "Religious Institutions",
                "Renewables & Environment", "Research", "Restaurants", "Retail",
                "Security & Investigations", "Semiconductors", "Shipbuilding", "Sporting Goods",
                "Sports", "Staffing & Recruiting", "Supermarkets", "Telecommunications",
                "Textiles", "Think Tanks", "Tobacco", "Translation & Localization",
                "Transportation/Trucking/Railroad", "Utilities", "Venture Capital & Private Equity",
                "Veterinary", "Warehousing", "Wholesale", "Wine & Spirits", "Wireless",
                "Writing & Editing"
            ]
            
            # Common mappings for user convenience
            industry_mappings = {
                "oil & energy": "Oil & Energy",
                "oil and energy": "Oil & Energy",
                "energy": "Oil & Energy",
                "agrochemical": "Agriculture",  # Map agrochemical to Agriculture
                "agrochemicals": "Agriculture",
                "chemical": "Chemicals",
                "technology": "Information Technology & Services",
                "tech": "Information Technology & Services",
                "it": "Information Technology & Services",
                "software": "Computer Software",
                "healthcare": "Hospital & Health Care",
                "health care": "Hospital & Health Care",
                "finance": "Financial Services",
                "banking": "Banking",
                "retail": "Retail",
                "manufacturing": "Electrical/Electronic Manufacturing",
                "education": "Education Management",
                "real estate": "Real Estate",
                "construction": "Construction",
                "automotive": "Automotive",
                "agriculture": "Agriculture",
                "pharmaceuticals": "Pharmaceuticals",
                "telecommunications": "Telecommunications",
                "media": "Broadcast Media",
                "consulting": "Management Consulting",
                "marketing": "Marketing & Advertising",
                "advertising": "Marketing & Advertising",
            }
            
            # Normalize the input (trim)
            industry_normalized = industry.strip()
            industry_lower = industry_normalized.lower()
            
            # First check if it's an exact match (case-insensitive)
            exact_match = None
            for allowed in allowed_industries:
                if allowed.lower() == industry_lower:
                    exact_match = allowed
                    break
            
            if exact_match:
                input_data["companyIndustryIncludes"] = [exact_match]  # Your actor uses list format
                logger.info(f"Using exact industry match: '{exact_match}'")
            elif industry_lower in industry_mappings:
                mapped_industry = industry_mappings[industry_lower]
                input_data["companyIndustryIncludes"] = [mapped_industry]  # Your actor uses list format
                logger.info(f"Mapped industry '{industry}' to '{mapped_industry}'")
            else:
                # Try case-insensitive partial match
                partial_match = None
                for allowed in allowed_industries:
                    if industry_lower in allowed.lower() or allowed.lower() in industry_lower:
                        partial_match = allowed
                        break
                
                if partial_match:
                    input_data["companyIndustryIncludes"] = [partial_match]  # Your actor uses list format
                    logger.warning(f"Using partial match: '{industry}' -> '{partial_match}'. Consider using exact value.")
                else:
                    # Invalid industry - raise error with helpful message
                    error_msg = (
                        f"Invalid industry '{industry}'. Must be one of Apify's allowed values. "
                        f"Common options: Agriculture, Chemicals, Oil & Energy, Information Technology & Services, etc. "
                        f"See server logs for full list of allowed industries."
                    )
                    logger.error(f"Invalid industry: {industry}")
                    logger.error(f"Allowed industries: {', '.join(allowed_industries[:10])}... (see full list in code)")
                    raise ValueError(error_msg)
        
        # C-suites / Titles - map to personTitleIncludes
        if c_suites:
            # Use the titles as provided, or expand common abbreviations
            expanded_titles = []
            title_mapping = {
                "CEO": "Chief Executive Officer",
                "COO": "Chief Operating Officer",
                "CFO": "Chief Financial Officer",
                "CTO": "Chief Technology Officer",
                "CIO": "Chief Information Officer",
                "Director": "Director Of Operations",  # Default director title
                "President": "President",
                "Owner": "Owner",
                "Founder": "Founder & CEO",
                "Co-Founder": "Co-Founder",
                "Co Founder": "Co Founder",
                "Board of Directors": "Board Member"
            }
            
            for title in c_suites:
                title_upper = title.strip().upper()
                # Check if it's an abbreviation
                if title_upper in title_mapping:
                    expanded_titles.append(title_mapping[title_upper])
                else:
                    # Use as-is (preserve original capitalization)
                    expanded_titles.append(title.strip())
            
            # Remove duplicates while preserving order
            seen = set()
            unique_titles = []
            for title in expanded_titles:
                if title not in seen:
                    seen.add(title)
                    unique_titles.append(title)
            
            input_data["personTitleIncludes"] = unique_titles
        
        # Total results
        if total_leads_wanted:
            input_data["totalResults"] = total_leads_wanted
        
        # Default settings matching your working actor schema
        default_settings = {
            "hasEmail": False,  # Your working example uses false
            "hasPhone": False,  # Your working example uses false
            "includeSimilarTitles": False,
            "resetSavedProgress": False,
            "companyNameMatchMode": "phrase",
            "companyDomainMatchMode": "contains",
            "companyNameIncludes": []  # Empty array as in your example
        }
        
        # Merge defaults with any overrides from actor_specific_params
        for key, value in default_settings.items():
            if key not in input_data and key not in actor_specific_params:
                input_data[key] = value
        
        # Add any actor-specific parameters (these override defaults)
        input_data.update(actor_specific_params)
        
        # Note: SIC codes are not included in Apify input format per your JSON structure
        # If needed in the future, they can be added here
        
        logger.info(f"Built Apify input data: {input_data}")
        
        # Run actor and get results
        items = await self.run_actor_sync_get_items(
            input_data=input_data,
            limit=total_leads_wanted
        )
        
        logger.info(f"Apify returned {len(items)} raw items")
        
        # Log sample item if available
        if items and len(items) > 0:
            logger.info(f"Sample raw item keys: {list(items[0].keys()) if isinstance(items[0], dict) else 'Not a dict'}")
            logger.info(f"Sample raw item: {json.dumps(items[0], indent=2, default=str)[:1000]}...")
        
        # Parse results
        leads = self.parse_apify_response(items)
        
        logger.info(f"Parsed {len(leads)} leads from {len(items)} items")
        
        return {
            "leads": leads,  # Already dicts matching scraped_data format
            "total": len(leads),
            "items": items  # Raw items for reference
        }

