from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routers import leads, campaigns, emails, websites, followups, auth
from app.core.config import settings
from app.core.exceptions import BaseAPIException
from app.core.error_handlers import base_api_exception_handler, general_exception_handler
from app.services.scheduler_service import SchedulerService
from app.core.database import get_db
from app.core.logging_config import setup_logging
from app.core.middleware import RequestIDMiddleware
import logging
import sys

# Setup comprehensive logging
setup_logging(
    log_level=settings.LOG_LEVEL.upper(),
    enable_file_logging=True,
    enable_json_logging=False
)

logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler_service = SchedulerService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start scheduler
    logger.info("🚀 Starting application...")
    scheduler_service.start()
    logger.info("✅ Scheduler started")
    yield
    # Shutdown: Stop scheduler
    logger.info("🛑 Shutting down application...")
    scheduler_service.stop()
    logger.info("✅ Scheduler stopped")

app = FastAPI(
    title="Lead Scraping & Email Automation API",
    description="Backend API for Apollo lead scraping and automated email campaigns",
    version="1.0.0",
    lifespan=lifespan
)

# Register exception handlers
app.add_exception_handler(BaseAPIException, base_api_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# CORS middleware
# Allow frontend origins (development and production)
allowed_origins = [
    "http://localhost:3000",  # Next.js default dev port
    "http://localhost:3001",  # Alternative dev port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    # Add production frontend URL here when deploying
    # "https://your-frontend-domain.com",
]

# In development, allow all origins for easier testing
# In production, use the specific origins above
import os
if os.getenv("ENVIRONMENT", "development") == "development":
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID tracking middleware
app.add_middleware(RequestIDMiddleware)

# Include routers
# Include routers
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
# app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"]) # Disabled in simplified architecture
app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
app.include_router(websites.router, prefix="/api/websites", tags=["websites"])
# app.include_router(followups.router, prefix="/api/followups", tags=["followups"]) # Disabled in simplified architecture
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"message": "Lead Scraping & Email Automation API", "status": "running"}

@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint
    Returns status of all critical services
    """
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check Supabase connection
    try:
        db = get_db()
        db.table("scraped_data").select("id").limit(1).execute()
        health_status["services"]["supabase"] = {"status": "healthy", "message": "Connected"}
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["supabase"] = {"status": "unhealthy", "message": str(e)}
    
    # Check OpenAI API key
    if settings.OPENAI_API_KEY:
        health_status["services"]["openai"] = {"status": "configured", "message": "API key present"}
    else:
        health_status["status"] = "degraded"
        health_status["services"]["openai"] = {"status": "not_configured", "message": "API key missing"}
    
    # Check Firecrawl API key
    if settings.FIRECRAWL_API_KEY:
        health_status["services"]["firecrawl"] = {"status": "configured", "message": "API key present"}
    else:
        health_status["status"] = "degraded"
        health_status["services"]["firecrawl"] = {"status": "not_configured", "message": "API key missing"}
    
    # Check scheduler
    if scheduler_service.scheduler and scheduler_service.scheduler.running:
        health_status["services"]["scheduler"] = {"status": "running", "message": "Active"}
    else:
        health_status["status"] = "degraded"
        health_status["services"]["scheduler"] = {"status": "stopped", "message": "Not running"}
    
    return health_status

@app.get("/api/system/status")
async def system_status():
    """
    Detailed system status for frontend monitoring
    """
    try:
        db = get_db()
        
        # Get counts
        leads_count = len(db.table("scraped_data").select("id", count="exact").execute().data)
        # Check pending emails in scraped_data (mail_status='scheduled')
        pending_result = db.table("scraped_data").select("id", count="exact").eq("mail_status", "scheduled").execute()
        pending_emails = pending_result.count if pending_result.count else 0
        
        return {
            "success": True,
            "data": {
                "total_leads": leads_count,
                "pending_emails": pending_emails,
                "scheduler_running": scheduler_service.scheduler.running if scheduler_service.scheduler else False,
                "services": {
                    "openai": "configured" if settings.OPENAI_API_KEY else "not_configured",
                    "firecrawl": "configured" if settings.FIRECRAWL_API_KEY else "not_configured",
                    "supabase": "connected"
                }
            }
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {
            "success": False,
            "error": {
                "code": "SYSTEM_STATUS_ERROR",
                "message": "Failed to retrieve system status",
                "details": {"error": str(e)}
            }
        }

