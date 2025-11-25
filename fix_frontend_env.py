
import os
from dotenv import dotenv_values

# Load backend env
# Note: dotenv_values returns a dict of the values in the .env file
backend_env = dotenv_values(".env")

supabase_url = backend_env.get("SUPABASE_URL")
supabase_key = backend_env.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("Error: Could not find SUPABASE_URL or SUPABASE_KEY in .env")
    # Fallback to os.environ if not in .env file directly (though config uses .env)
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Could not find keys in environment either.")
        exit(1)

print(f"Found Supabase URL: {supabase_url}")
print(f"Found Supabase Key: {supabase_key[:10]}...")

# Prepare frontend env content
frontend_content = f"""NEXT_PUBLIC_SUPABASE_URL={supabase_url}
NEXT_PUBLIC_SUPABASE_ANON_KEY={supabase_key}
"""

# Write to frontend .env.local
frontend_env_path = os.path.join("dashboard", "dharm-mehulbhai", ".env.local")
try:
    with open(frontend_env_path, "w") as f:
        f.write(frontend_content)
    print(f"Successfully wrote {frontend_env_path}")
except Exception as e:
    print(f"Error writing file: {e}")
