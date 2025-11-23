from supabase import create_client, Client
from app.core.config import settings
from app.core.exceptions import SupabaseConnectionError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)

class SupabaseClient:
    _instance: Client = None
    _connection_healthy: bool = False
    
    @classmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((Exception,)),
        reraise=True
    )
    def get_client(cls) -> Client:
        """
        Get Supabase client with retry logic and health check.
        Retries up to 3 times with exponential backoff on failure.
        """
        if cls._instance is None:
            try:
                logger.info("🔌 Connecting to Supabase...")
                cls._instance = create_client(
                    settings.SUPABASE_URL, 
                    settings.SUPABASE_KEY
                )
                
                # Health check - verify connection works
                logger.info("🏥 Running health check...")
                cls._instance.table("scraped_data").select("id").limit(1).execute()
                
                cls._connection_healthy = True
                logger.info("✅ Supabase connection successful and healthy")
                
            except Exception as e:
                logger.error(f"❌ Supabase connection failed: {e}")
                cls._instance = None
                cls._connection_healthy = False
                raise SupabaseConnectionError(details={"error": str(e), "url": settings.SUPABASE_URL})
        
        return cls._instance
    
    @classmethod
    def reset_connection(cls):
        """Force reconnection (useful for error recovery)"""
        logger.warning("🔄 Resetting Supabase connection...")
        cls._instance = None
        cls._connection_healthy = False
    
    @classmethod
    def is_healthy(cls) -> bool:
        """Check if connection is healthy"""
        return cls._connection_healthy

# Convenience function
def get_db() -> Client:
    return SupabaseClient.get_client()

