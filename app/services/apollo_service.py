import httpx
import asyncio
from typing import List, Dict, Any, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class ApolloService:
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
    
    async def search_people(
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
        Main Apollo search function for FREE PLAN
        """
        
        if not c_suites:
            c_suites = ["CEO", "COO", "Director", "Founder", "President", "Owner"]
        
        leads_per_page = 100
        total_pages = (total_leads_wanted + leads_per_page - 1) // leads_per_page
        
        logger.info(f"Apollo: Fetching {total_leads_wanted} leads across {total_pages} pages")
        
        all_people = []

        for page in range(1, total_pages + 1):
            try:
                logger.info(f"Apollo: Fetching page {page}/{total_pages}")

                payload = {
                    "page": page,
                    "per_page": leads_per_page,
                    "person_titles": c_suites,
                    "person_locations": countries or [],
                    "organization_sic_codes": sic_codes or [],
                    "organization_num_employees_ranges": self._get_employee_size_ranges(employee_size_min, employee_size_max),
                    "email_status": ["verified", "guessed"],
                    "reveal_personal_emails": True
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
                    logger.error("❌ Apollo 403 Forbidden — Likely free plan and this search requires credits.")
                    return []

                response.raise_for_status()
                
                data = response.json()
                people = data.get("people", [])
                logger.info(f"Apollo: Page {page} returned {len(people)} leads")

                # Parse and map leads
                parsed_leads = [self.parse_apollo_response(p) for p in people]
                all_people.extend(parsed_leads)

                if len(all_people) >= total_leads_wanted:
                    break
            
            except Exception as e:
                logger.error(f"❌ Apollo Error Page {page}: {e}")
                continue
        
        logger.info(f"Apollo: Total leads collected: {len(all_people)}")
        return all_people

    def parse_apollo_response(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """ Parse Apollo person data into scraped_data format """
        org = person.get("organization") or {}
        
        # Email extraction logic
        email = person.get("email")
        if not email and person.get("personal_emails"):
            # personal_emails is usually a list of strings
            email = person["personal_emails"][0]
        if not email:
            email = person.get("personal_email")
            
        return {
            "founder_name": person.get("name"),
            "founder_email": email,
            "founder_linkedin": person.get("linkedin_url"),
            "position": person.get("title"),
            "location": person.get("formatted_address") or org.get("primary_location", {}).get("formatted_address"),
            "company_name": org.get("name"),
            "company_website": org.get("website_url"),
            "company_linkedin": org.get("linkedin_url"),
            "company_twitter": org.get("twitter_url"),
            "company_phone": org.get("phone"),
            "company_industry": org.get("industry") or person.get("industry"),
            "company_keywords": ", ".join(org.get("keywords", [])) if org.get("keywords") else None,
            "source": "apollo"
        }
