from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv

# Force reload .env file to get latest values
load_dotenv(override=True)

class Settings(BaseSettings):
    # Supabase (Required)
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Apollo API (Required for lead scraping)
    APOLLO_API_KEY: Optional[str] = None
    
    # Apify API (Alternative lead scraping source)
    APIFY_API_TOKEN: Optional[str] = None
    APIFY_ACTOR_ID: Optional[str] = None  # Format: "username~actor-name"
    
    # OpenAI (Required for email personalization)
    OPENAI_API_KEY: Optional[str] = None
    
    # Firecrawl API (Required for website scraping)
    FIRECRAWL_API_KEY: Optional[str] = None
    
    # Gmail API
    GMAIL_CLIENT_ID: Optional[str] = None
    GMAIL_CLIENT_SECRET: Optional[str] = None
    GMAIL_REFRESH_TOKEN: Optional[str] = None
    GMAIL_USER_EMAIL: Optional[str] = None
    
    # App Config
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_BASE_URL: Optional[str] = None  # For OAuth redirects (e.g., http://localhost:8000)
    
    # Business Hours
    BUSINESS_HOUR_START: int = 9
    BUSINESS_HOUR_END: int = 18  # 6 PM
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

