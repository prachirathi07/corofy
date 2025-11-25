import httpx
import asyncio
from typing import List, Dict, Any, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class ApolloServiceEnriched:
    """
    Enhanced Apollo Service with proper two-step enrichment:
    1. Search for people (/people/search) - Discovery
    2. Enrich each person (/people/match) - Unlock full details
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
        """
        try:
            # Extract identifiers for matching
            payload = {}
            
            # Priority 1: LinkedIn URL (most reliable)
            if person_data.get("linkedin_url"):
                payload["linkedin_url"] = person_data["linkedin_url"]
            
            # Priority 2: Name + Company
            if person_data.get("name"):
                payload["first_name"] = person_data["name"].split()[0] if person_data["name"] else None
                if len(person_data["name"].split()) > 1:
                    payload["last_name"] = " ".join(person_data["name"].split()[1:])
            
            if person_data.get("organization", {}).get("name"):
                payload["organization_name"] = person_data["organization"]["name"]
            
            # Priority 3: Email (if available from search)
            if person_data.get("email"):
                payload["email"] = person_data["email"]
            
            # Must have at least one identifier
            if not payload:
                logger.warning("⚠️ No identifiers available for enrichment")
                return None
            
            headers = {
                "accept": "application/json",
                "Content-Type": "application/json",
                "X-Api-Key": self.api_key
            }
            
            url = f"{self.BASE_URL}/people/match"
            
            logger.info(f"🔍 Enriching person: {person_data.get('name', 'Unknown')}")
            
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
            
            response.raise_for_status()
            
            enriched_data = response.json()
            person = enriched_data.get("person", {})
            
            if person:
                logger.info(f"✅ Successfully enriched: {person.get('name', 'Unknown')}")
                return person
            else:
                logger.warning(f"⚠️ Empty enrichment response for {person_data.get('name', 'Unknown')}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Enrichment error for {person_data.get('name', 'Unknown')}: {e}")
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
        enrich_leads: bool = True  # NEW: Toggle enrichment
    ) -> List[Dict[str, Any]]:
        """
        ENHANCED: Two-step process for getting fully enriched leads
        
        STEP 1: Search for people (/people/search) - Discovery
        STEP 2: Enrich each person (/people/match) - Unlock details
        """
        
        if not c_suites:
            c_suites = ["CEO", "COO", "Director", "Founder", "President", "Owner"]
        
        # STEP 1: SEARCH (Discovery)
        logger.info(f"🔍 STEP 1: Searching for {total_leads_wanted} leads...")
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
            return search_results
        
        # STEP 2: ENRICH (Unlock full details)
        logger.info(f"🔓 STEP 2: Enriching {len(search_results)} leads...")
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
        STEP 1: Basic search using /people/search
        Returns basic person data (NOT enriched)
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

                payload = {
                    "page": page,
                    "per_page": current_per_page,
                    "person_titles": c_suites,
                    "person_locations": countries or [],
                    "organization_sic_codes": sic_codes or [],
                    "organization_num_employees_ranges": self._get_employee_size_ranges(employee_size_min, employee_size_max),
                    # NOTE: These parameters don't actually unlock emails in /people/search
                    # They only filter results to people who HAVE emails
                    "email_status": ["verified", "guessed"],
                }

                headers = {
                    "accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": self.api_key
                }

                url = f"{self.BASE_URL}/people/search"

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
        
        # ENHANCED Phone extraction
        phone = None
        if person.get("phone_numbers") and len(person["phone_numbers"]) > 0:
            phone = person["phone_numbers"][0].get("raw_number") or person["phone_numbers"][0].get("sanitized_number")
        elif person.get("mobile_phone"):
            phone = person["mobile_phone"]
        elif org.get("phone"):
            phone = org["phone"]
            
        return {
            "founder_name": person.get("name"),
            "founder_email": email,
            "founder_linkedin": person.get("linkedin_url"),
            "position": person.get("title"),
            "founder_address": person.get("formatted_address") or org.get("primary_location", {}).get("formatted_address"),
            "company_name": org.get("name"),
            "company_website": org.get("website_url"),
            "company_linkedin": org.get("linkedin_url"),
            "company_industry": org.get("industry") or person.get("industry"),
            "company_country": org.get("primary_location", {}).get("country")
        }
