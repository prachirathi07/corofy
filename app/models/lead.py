from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class LeadBase(BaseModel):
    """Base model matching scraped_data table schema"""
    founder_name: Optional[str] = None
    company_name: Optional[str] = None
    position: Optional[str] = None
    founder_email: Optional[EmailStr] = None
    founder_linkedin: Optional[str] = None
    founder_address: Optional[str] = None
    company_industry: Optional[str] = None
    company_website: Optional[str] = None
    company_linkedin: Optional[str] = None
    company_blogpost: Optional[str] = None
    company_angellist: Optional[str] = None
    company_phone: Optional[str] = None
    is_verified: Optional[bool] = False
    followup_5_sent: Optional[bool] = False
    followup_10_sent: Optional[bool] = False
    mail_status: Optional[str] = "new"  # new, email_sent, replied, bounced, unsubscribed
    reply_priority: Optional[str] = None
    thread_id: Optional[str] = None
    mail_replies: Optional[str] = None
    email_content: Optional[str] = None
    email_subject: Optional[str] = None
    wait_initial_email: Optional[bool] = False
    wait_followup_5: Optional[bool] = False
    wait_followup_10: Optional[bool] = False

class LeadCreate(LeadBase):
    """Model for creating a new lead in scraped_data table"""
    pass

class LeadUpdate(BaseModel):
    """Model for updating a lead"""
    founder_name: Optional[str] = None
    company_name: Optional[str] = None
    position: Optional[str] = None
    founder_email: Optional[EmailStr] = None
    mail_status: Optional[str] = None
    email_content: Optional[str] = None
    email_subject: Optional[str] = None
    thread_id: Optional[str] = None
    followup_5_sent: Optional[bool] = None
    followup_10_sent: Optional[bool] = None

class Lead(LeadBase):
    """Full lead model with ID and timestamps"""
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

def map_apollo_to_scraped_data(apollo_data: Dict[str, Any], person_details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Map Apollo API response to scraped_data table format
    """
    # Use detailed data if available, otherwise use original
    if person_details and person_details.get("person"):
        person = person_details.get("person")
    else:
        person = apollo_data
    
    organization = person.get("organization", {})
    
    # Extract name
    name = person.get("name", "")
    if not name:
        first_name = person.get("first_name", "")
        last_name = person.get("last_name", "")
        name = f"{first_name} {last_name}".strip()
    
    # Extract email
    email = None
    if person.get("email"):
        email = person.get("email")
    elif person.get("person", {}).get("email"):
        email = person.get("person", {}).get("email")
    elif isinstance(person.get("emails"), list) and len(person.get("emails", [])) > 0:
        email = person.get("emails")[0]
    elif person.get("personal_email"):
        email = person.get("personal_email")
    
    # Extract company domain from website
    company_website = organization.get("website_url", "")
    company_domain = None
    if company_website:
        company_domain = company_website.replace("https://", "").replace("http://", "").split("/")[0]
    elif organization.get("primary_domain"):
        company_domain = organization.get("primary_domain")
    
    return {
        "founder_name": name,
        "company_name": organization.get("name", ""),
        "position": person.get("title", ""),
        "founder_email": email,
        "founder_linkedin": person.get("linkedin_url", ""),
        "founder_address": person.get("formatted_address", ""),
        "company_industry": organization.get("industry", ""),
        "company_website": company_website,
        "company_linkedin": organization.get("linkedin_url", ""),
        "company_blogpost": organization.get("blog_url", ""),
        "company_angellist": organization.get("angellist_url", ""),
        "company_phone": organization.get("phone", ""),
        "mail_status": "new",
        "is_verified": False,
        "followup_5_sent": False,
        "followup_10_sent": False
    }
