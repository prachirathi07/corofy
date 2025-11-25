
import os
from dotenv import load_dotenv
from app.core.config import Settings

print("Current working directory:", os.getcwd())
print("Files in current directory:", os.listdir())

print("Loading .env...")
load_dotenv(override=True)

print("SUPABASE_URL from env:", os.getenv("SUPABASE_URL"))
print("SUPABASE_KEY from env:", "FOUND" if os.getenv("SUPABASE_KEY") else "MISSING")

try:
    settings = Settings()
    print("Settings loaded successfully!")
    print("SUPABASE_URL:", settings.SUPABASE_URL)
    print("N8N_WEBHOOK_URL:", settings.N8N_WEBHOOK_URL)
except Exception as e:
    print("Error loading settings:", e)
    # Print raw env vars to debug
    print("Raw N8N_WEBHOOK_URL:", os.getenv("N8N_WEBHOOK_URL"))
