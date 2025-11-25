
from app.core.database import get_db
import logging

logging.basicConfig(level=logging.ERROR)

try:
    db = get_db()
    data = db.table("scraped_data").select("*").limit(1).execute().data
    if data:
        print("Columns found in scraped_data:")
        for key in sorted(data[0].keys()):
            print(key)
    else:
        print("No data found in scraped_data")
except Exception as e:
    print(f"Error: {e}")
