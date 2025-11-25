import httpx
import asyncio
from typing import List, Dict, Any, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class ApolloService:
    """
    Enhanced Apollo Service with proper two-step enrichment:
    1. Search using /mixed_people/api_search (Discovery)
    2. Enrich using /people/match (Unlock full details)
    """
    BASE_URL = "https://api.apollo.io/api/v1"
    
    def __init__(self):
        self.api_key = settings.APOLLO_API_KEY
        if not self.api_key:
            raise ValueError("APOLLO_API_KEY is required. Add it to .env.")
        if self.api_key.startswith("your_"):
            raise ValueError("Invalid placeholder API key. Add real key.")
    
    def _get_employee_size_ranges(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None
    ) -> List[str]:
        """ Convert min/max employee size to Apollo format """
        default_ranges = ["1,10", "11,20", "21,50", "51,100", "101,200", "201,500"]
        
        if employee_size_min is None and employee_size_max is None:
            return default_ranges

        if employee_size_min and employee_size_max:
            return [f"{employee_size_min},{employee_size_max}"]
        if employee_size_min:
            return [f"{employee_size_min},"] 
        if employee_size_max:
            return [f",{employee_size_max}"]

        return default_ranges
    
    async def enrich_person(self, person_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        STEP 2: Enrich a single person using /people/match endpoint
        This UNLOCKS the full contact details including verified emails and phones
        
        Endpoint: https://api.apollo.io/api/v1/people/match
        """
        try:
            # Extract identifiers for matching
            payload = {}
            
            # Priority 0: Apollo ID (Most reliable if available from search)
            if person_data.get("id"):
                payload["id"] = person_data["id"]
            
            # Priority 1: LinkedIn URL (Very reliable)
            if person_data.get("linkedin_url"):
                payload["linkedin_url"] = person_data["linkedin_url"]
            
            # Priority 2: Email (if available from search)
            if person_data.get("email"):
                payload["email"] = person_data["email"]
            
            # Priority 3: Name + Company
            if person_data.get("name"):
                name_parts = person_data["name"].split()
                if len(name_parts) > 0:
                    payload["first_name"] = name_parts[0]
                if len(name_parts) > 1:
                    payload["last_name"] = " ".join(name_parts[1:])
            
            if person_data.get("organization", {}).get("name"):
                payload["organization_name"] = person_data["organization"]["name"]
            
            # Must have at least one identifier
            if not payload:
                logger.warning(f"⚠️ No identifiers for enrichment: {person_data.get('name', 'Unknown')}")
                return None
            
            # Add reveal flags to unlock data
            payload["reveal_personal_emails"] = True
            # Phone numbers disabled per user request
            # payload["reveal_phone_number"] = True
            
            headers = {
                "accept": "application/json",
                "Content-Type": "application/json",
                "X-Api-Key": self.api_key
            }
            
            url = f"{self.BASE_URL}/people/match"
            
            logger.info(f"🔍 Enriching: {person_data.get('name', 'Unknown')} (ID: {payload.get('id', 'N/A')})")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers
                )
            
            if response.status_code == 404:
                logger.warning(f"⚠️ No match found for {person_data.get('name', 'Unknown')}")
                return None
            
            if response.status_code == 403:
                logger.error("❌ Apollo API 403 - Insufficient enrichment credits")
                return None
            
            if response.status_code == 400:
                logger.error(f"❌ Apollo API 400 Bad Request. Payload: {payload}")
                logger.error(f"Response: {response.text}")
                return None

            response.raise_for_status()
            
            enriched_data = response.json()
            person = enriched_data.get("person", {})
            
            if person:
                logger.info(f"✅ Enriched: {person.get('name', 'Unknown')} - Email: {person.get('email', 'N/A')}")
                return person
            else:
                logger.warning(f"⚠️ Empty enrichment response for {person_data.get('name', 'Unknown')}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Enrichment error for {person_data.get('name', 'Unknown')}: {e}")
            if 'payload' in locals():
                logger.error(f"Payload was: {payload}")
            return None
    
    async def search_people(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None,
        countries: Optional[List[str]] = None,
        sic_codes: Optional[List[str]] = None,
        c_suites: Optional[List[str]] = None,
        industry: Optional[str] = None,
        total_leads_wanted: int = 200,
        enrich_leads: bool = True  # Toggle enrichment
    ) -> List[Dict[str, Any]]:
        """
        ENHANCED: Two-step process for getting fully enriched leads
        
        STEP 1: Search using /mixed_people/api_search (Discovery)
        STEP 2: Enrich each person using /people/match (Unlock details)
        """
        
        if not c_suites:
            c_suites = ["CEO", "COO", "Director", "Founder", "President", "Owner", "Board of Directors"]
        
        # STEP 1: SEARCH (Discovery)
        logger.info(f"🔍 STEP 1: Searching for {total_leads_wanted} leads using /mixed_people/api_search...")
        search_results = await self._search_people_basic(
            employee_size_min=employee_size_min,
            employee_size_max=employee_size_max,
            countries=countries,
            sic_codes=sic_codes,
            c_suites=c_suites,
            industry=industry,
            total_leads_wanted=total_leads_wanted
        )
        
        if not enrich_leads:
            logger.info("⚠️ Enrichment disabled - returning basic search results")
            parsed_leads = [self.parse_apollo_response(p) for p in search_results]
            return parsed_leads
        
        # STEP 2: ENRICH (Unlock full details)
        logger.info(f"🔓 STEP 2: Enriching {len(search_results)} leads using /people/match...")
        enriched_leads = []
        
        for idx, person_data in enumerate(search_results, 1):
            logger.info(f"Processing {idx}/{len(search_results)}: {person_data.get('name', 'Unknown')}")
            
            # Enrich the person
            enriched_person = await self.enrich_person(person_data)
            
            if enriched_person:
                # Parse enriched data
                parsed_lead = self.parse_apollo_response(enriched_person)
                enriched_leads.append(parsed_lead)
            else:
                # Fallback to basic data if enrichment fails
                logger.warning(f"⚠️ Using basic data for {person_data.get('name', 'Unknown')}")
                parsed_lead = self.parse_apollo_response(person_data)
                enriched_leads.append(parsed_lead)
            
            # Rate limiting: Apollo recommends 1 request per second
            await asyncio.sleep(1.2)
        
        logger.info(f"✅ Enrichment complete: {len(enriched_leads)} leads processed")
        return enriched_leads
    
    async def _search_people_basic(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None,
        countries: Optional[List[str]] = None,
        sic_codes: Optional[List[str]] = None,
        c_suites: Optional[List[str]] = None,
        industry: Optional[str] = None,
        total_leads_wanted: int = 200
    ) -> List[Dict[str, Any]]:
        """
        STEP 1: Basic search using /mixed_people/api_search
        Returns basic person data (NOT fully enriched)
        
        Endpoint: https://api.apollo.io/api/v1/mixed_people/api_search
        """
        
        leads_per_page = 100
        total_pages = (total_leads_wanted + leads_per_page - 1) // leads_per_page
        
        logger.info(f"Apollo Search: Fetching {total_leads_wanted} leads across {total_pages} pages")
        
        all_people = []

        for page in range(1, total_pages + 1):
            try:
                leads_needed = total_leads_wanted - len(all_people)
                current_per_page = min(leads_needed, 100)
                
                logger.info(f"Apollo Search: Page {page}/{total_pages} (Requesting {current_per_page} leads)")

                # Build payload - SIC codes are PRIMARY filter
                payload = {
                    "page": page,
                    "per_page": current_per_page,
                    "person_titles": c_suites,
                    "person_locations": countries or [],
                    "organization_num_employees_ranges": self._get_employee_size_ranges(employee_size_min, employee_size_max),
                    "email_status": ["verified"], # User requested ONLY verified emails
                    "reveal_personal_emails": True, # Added per n8n config
                }
                
                # CRITICAL: Only add organization_sic_codes if provided - this is the PRIMARY filter
                if sic_codes and len(sic_codes) > 0:
                    payload["organization_sic_codes"] = sic_codes
                    logger.info(f"🔍 Apollo Search Page {page}: Filtering by SIC codes: {sic_codes}")
                else:
                    logger.warning(f"⚠️ Apollo Search Page {page}: No SIC codes provided! Results may not be filtered correctly.")
                
                # Remove _industry_filter - it's not a valid Apollo API parameter and may interfere with SIC code filtering
                # Industry filtering should be done via SIC codes only

                headers = {
                    "accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": self.api_key
                }

                # CORRECT ENDPOINT: /mixed_people/api_search
                url = f"{self.BASE_URL}/mixed_people/api_search"
                
                logger.debug(f"📤 Apollo API Payload Page {page}: {payload}")

                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers=headers
                    )

                if response.status_code == 403:
                    error_msg = "Apollo API 403 Forbidden — Likely insufficient credits or free plan limit reached."
                    logger.error(f"❌ {error_msg}")
                    raise Exception(error_msg)

                response.raise_for_status()
                
                data = response.json()
                people = data.get("people", [])
                logger.info(f"Apollo Search: Page {page} returned {len(people)} leads")
                
                # VALIDATION: Filter results to ensure they match SIC codes
                if sic_codes and len(sic_codes) > 0:
                    filtered_people = []
                    for person in people:
                        org = person.get("organization", {})
                        org_sic_codes = org.get("sic_codes", [])
                        # Check if organization has any of the requested SIC codes
                        if org_sic_codes and any(str(sic) in [str(s) for s in org_sic_codes] for sic in sic_codes):
                            filtered_people.append(person)
                        else:
                            logger.warning(f"⚠️ Filtered out lead {person.get('name', 'Unknown')} - Organization SIC codes {org_sic_codes} don't match requested {sic_codes}")
                    people = filtered_people
                    logger.info(f"✅ After SIC code validation: {len(people)} leads match SIC codes {sic_codes}")

                all_people.extend(people)

                if len(all_people) >= total_leads_wanted:
                    break
            
            except Exception as e:
                logger.error(f"❌ Apollo Search Error Page {page}: {e}")
                continue
        
        logger.info(f"Apollo Search: Total leads collected: {len(all_people)}")
        return all_people[:total_leads_wanted]

    def parse_apollo_response(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """ Parse Apollo person data into scraped_data format """
        org = person.get("organization") or {}
        
        # ENHANCED Email extraction logic
        email = None
        
        # Priority 1: Direct email field (from enrichment)
        if person.get("email"):
            email = person["email"]
        
        # Priority 2: Personal emails list
        elif person.get("personal_emails") and len(person["personal_emails"]) > 0:
            email = person["personal_emails"][0]
        
        # Priority 3: Corporate email
        elif person.get("corporate_email"):
            email = person["corporate_email"]
        
        # Priority 4: Fallback to personal_email field
        elif person.get("personal_email"):
            email = person["personal_email"]
        
        # Phone extraction DISABLED per user request
        phone = None
        
        # Extract company_domain from company_website
        company_website = org.get("website_url")
        company_domain = None
        if company_website:
            # Remove protocol and path to get domain
            import re
            domain = re.sub(r'^https?://', '', company_website)
            domain = re.sub(r'/.*$', '', domain)
            company_domain = domain
            
        return {
            "founder_name": person.get("name"),
            "founder_email": email,
            "founder_linkedin": person.get("linkedin_url"),
            "position": person.get("title"),
            "founder_address": person.get("formatted_address") or org.get("primary_location", {}).get("formatted_address"),
            "company_name": org.get("name"),
            "company_website": company_website,
            "company_domain": company_domain,
            "company_linkedin": org.get("linkedin_url"),
            "company_industry": org.get("industry") or person.get("industry"),
            "company_country": org.get("primary_location", {}).get("country"),
            "mail_status": "pending", # Default status for new leads
            "is_verified": True # We filter for verified emails only
        }
    
    async def search_people(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None,
        countries: Optional[List[str]] = None,
        sic_codes: Optional[List[str]] = None,
        c_suites: Optional[List[str]] = None,
        industry: Optional[str] = None,
        total_leads_wanted: int = 200,
        enrich_leads: bool = True  # Toggle enrichment
    ) -> List[Dict[str, Any]]:
        """
        ENHANCED: Two-step process for getting fully enriched leads
        
        STEP 1: Search using /mixed_people/api_search (Discovery)
        STEP 2: Enrich each person using /people/match (Unlock details)
        """
        
        if not c_suites:
            c_suites = ["CEO", "COO", "Director", "Founder", "President", "Owner", "Board of Directors"]
        
        # STEP 1: SEARCH (Discovery)
        logger.info(f"🔍 STEP 1: Searching for {total_leads_wanted} leads using /mixed_people/api_search...")
        search_results = await self._search_people_basic(
            employee_size_min=employee_size_min,
            employee_size_max=employee_size_max,
            countries=countries,
            sic_codes=sic_codes,
            c_suites=c_suites,
            industry=industry,
            total_leads_wanted=total_leads_wanted
        )
        
        if not enrich_leads:
            logger.info("⚠️ Enrichment disabled - returning basic search results")
            parsed_leads = [self.parse_apollo_response(p) for p in search_results]
            return parsed_leads
        
        # STEP 2: ENRICH (Unlock full details)
        logger.info(f"🔓 STEP 2: Enriching {len(search_results)} leads using /people/match...")
        enriched_leads = []
        
        for idx, person_data in enumerate(search_results, 1):
            logger.info(f"Processing {idx}/{len(search_results)}: {person_data.get('name', 'Unknown')}")
            
            # Enrich the person
            enriched_person = await self.enrich_person(person_data)
            
            if enriched_person:
                # Parse enriched data
                parsed_lead = self.parse_apollo_response(enriched_person)
                enriched_leads.append(parsed_lead)
            else:
                # Fallback to basic data if enrichment fails
                logger.warning(f"⚠️ Using basic data for {person_data.get('name', 'Unknown')}")
                parsed_lead = self.parse_apollo_response(person_data)
                enriched_leads.append(parsed_lead)
            
            # Rate limiting: Apollo recommends 1 request per second
            await asyncio.sleep(1.2)
        
        logger.info(f"✅ Enrichment complete: {len(enriched_leads)} leads processed")
        return enriched_leads
    
    async def _search_people_basic(
        self,
        employee_size_min: Optional[int] = None,
        employee_size_max: Optional[int] = None,
        countries: Optional[List[str]] = None,
        sic_codes: Optional[List[str]] = None,
        c_suites: Optional[List[str]] = None,
        industry: Optional[str] = None,
        total_leads_wanted: int = 200
    ) -> List[Dict[str, Any]]:
        """
        STEP 1: Basic search using /mixed_people/api_search
        Returns basic person data (NOT fully enriched)
        
        Endpoint: https://api.apollo.io/api/v1/mixed_people/api_search
        """
        
        leads_per_page = 100
        total_pages = (total_leads_wanted + leads_per_page - 1) // leads_per_page
        
        logger.info(f"Apollo Search: Fetching {total_leads_wanted} leads across {total_pages} pages")
        
        all_people = []

        for page in range(1, total_pages + 1):
            try:
                leads_needed = total_leads_wanted - len(all_people)
                current_per_page = min(leads_needed, 100)
                
                logger.info(f"Apollo Search: Page {page}/{total_pages} (Requesting {current_per_page} leads)")

                # Build payload - SIC codes are PRIMARY filter
                payload = {
                    "page": page,
                    "per_page": current_per_page,
                    "person_titles": c_suites,
                    "person_locations": countries or [],
                    "organization_num_employees_ranges": self._get_employee_size_ranges(employee_size_min, employee_size_max),
                    "email_status": ["verified"], # User requested ONLY verified emails
                    "reveal_personal_emails": True, # Added per n8n config
                }
                
                # CRITICAL: Only add organization_sic_codes if provided - this is the PRIMARY filter
                if sic_codes and len(sic_codes) > 0:
                    payload["organization_sic_codes"] = sic_codes
                    logger.info(f"🔍 Apollo Search Page {page}: Filtering by SIC codes: {sic_codes}")
                else:
                    logger.warning(f"⚠️ Apollo Search Page {page}: No SIC codes provided! Results may not be filtered correctly.")
                
                # Remove _industry_filter - it's not a valid Apollo API parameter and may interfere with SIC code filtering
                # Industry filtering should be done via SIC codes only

                headers = {
                    "accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": self.api_key
                }

                # CORRECT ENDPOINT: /mixed_people/api_search
                url = f"{self.BASE_URL}/mixed_people/api_search"
                
                logger.debug(f"📤 Apollo API Payload Page {page}: {payload}")

                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers=headers
                    )

                if response.status_code == 403:
                    error_msg = "Apollo API 403 Forbidden — Likely insufficient credits or free plan limit reached."
                    logger.error(f"❌ {error_msg}")
                    raise Exception(error_msg)

                response.raise_for_status()
                
                data = response.json()
                people = data.get("people", [])
                logger.info(f"Apollo Search: Page {page} returned {len(people)} leads")
                
                # VALIDATION: Filter results to ensure they match SIC codes
                if sic_codes and len(sic_codes) > 0:
                    filtered_people = []
                    for person in people:
                        org = person.get("organization", {})
                        org_sic_codes = org.get("sic_codes", [])
                        # Check if organization has any of the requested SIC codes
                        if org_sic_codes and any(str(sic) in [str(s) for s in org_sic_codes] for sic in sic_codes):
                            filtered_people.append(person)
                        else:
                            logger.warning(f"⚠️ Filtered out lead {person.get('name', 'Unknown')} - Organization SIC codes {org_sic_codes} don't match requested {sic_codes}")
                    people = filtered_people
                    logger.info(f"✅ After SIC code validation: {len(people)} leads match SIC codes {sic_codes}")

                all_people.extend(people)

                if len(all_people) >= total_leads_wanted:
                    break
            
            except Exception as e:
                logger.error(f"❌ Apollo Search Error Page {page}: {e}")
                continue
        
        logger.info(f"Apollo Search: Total leads collected: {len(all_people)}")
        return all_people[:total_leads_wanted]

    def parse_apollo_response(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """ Parse Apollo person data into scraped_data format """
        org = person.get("organization") or {}
        
        # ENHANCED Email extraction logic
        email = None
        
        # Priority 1: Direct email field (from enrichment)
        if person.get("email"):
            email = person["email"]
        
        # Priority 2: Personal emails list
        elif person.get("personal_emails") and len(person["personal_emails"]) > 0:
            email = person["personal_emails"][0]
        
        # Priority 3: Corporate email
        elif person.get("corporate_email"):
            email = person["corporate_email"]
        
        # Priority 4: Fallback to personal_email field
        elif person.get("personal_email"):
            email = person["personal_email"]
        
        # Phone extraction DISABLED per user request
        phone = None
        
        # Extract company_domain from company_website
        company_website = org.get("website_url")
        company_domain = None
        if company_website:
            # Remove protocol and path to get domain
            import re
            domain = re.sub(r'^https?://', '', company_website)
            domain = re.sub(r'/.*$', '', domain)
            company_domain = domain
            
        return {
            "founder_name": person.get("name"),
            "founder_email": email,
            "founder_linkedin": person.get("linkedin_url"),
            "position": person.get("title"),
            "founder_address": person.get("formatted_address") or org.get("primary_location", {}).get("formatted_address"),
            "company_name": org.get("name"),
            "company_website": company_website,
            "company_domain": company_domain,
            "company_linkedin": org.get("linkedin_url"),
            "company_industry": org.get("industry") or person.get("industry"),
            "company_country": org.get("primary_location", {}).get("country"),
            "mail_status": "pending", # Default status for new leads
            "is_verified": True # We filter for verified emails only
        }
