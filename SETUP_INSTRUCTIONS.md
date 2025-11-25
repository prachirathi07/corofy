# 🚀 Supabase Setup Instructions

## ✅ Current Status:
- **Supabase Connection**: ✅ WORKING
- **"scraped Data" table**: ✅ EXISTS (but empty)
- **"products" table**: ❌ MISSING (needs to be created)
- **"webhook_data" table**: ❌ MISSING (needs to be created)

---

## 📋 Setup Method 1: Using Supabase SQL Editor (Recommended)

### Step 1: Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Select your project: `utwhoufvuqkcbczszuog`

### Step 2: Open SQL Editor
1. Click on "SQL Editor" in the left sidebar
2. Click "New Query"

### Step 3: Run the SQL Script
Copy and paste the entire content from `setup-supabase-tables.sql` into the SQL editor and click "Run"

Or run this SQL:

```sql
-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "chemicalName" TEXT NOT NULL,
  application TEXT NOT NULL,
  "targetCountries" TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on products" ON products
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Create Webhook Data Table
CREATE TABLE IF NOT EXISTS webhook_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "chemicalName" TEXT NOT NULL,
  application TEXT NOT NULL,
  "targetCountries" TEXT[] NOT NULL,
  source TEXT DEFAULT 'webhook',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE webhook_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on webhook_data" ON webhook_data
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Insert Sample Data
INSERT INTO products (industry, "brandName", "chemicalName", application, "targetCountries")
VALUES 
  ('Agrochemical', 'CropProtect', 'Glyphosate', 'Herbicide', ARRAY['USA', 'Canada', 'Mexico']),
  ('Agrochemical', 'FarmGuard', 'Imidacloprid', 'Insecticide', ARRAY['Brazil', 'Argentina', 'India']),
  ('Pharmaceutical', 'MediCare', 'Acetaminophen', 'Pain Relief', ARRAY['USA', 'UK', 'Germany'])
ON CONFLICT DO NOTHING;
```

### Step 4: Verify Tables
Run this to check:
```sql
SELECT 'products' as table_name, COUNT(*) as records FROM products
UNION ALL
SELECT 'webhook_data', COUNT(*) FROM webhook_data
UNION ALL
SELECT 'scraped Data', COUNT(*) FROM "scraped Data";
```

---

## 📋 Setup Method 2: Using API Endpoint

After creating the tables in Supabase (Method 1), you can populate with sample data:

```bash
# Start your dev server
npm run dev

# In another terminal, call the setup endpoint
curl -X POST http://localhost:3000/api/setup-db
```

This will insert product data from your `lib/productData.ts` file.

---

## 🧪 Verify Everything Works

After setup, run the verification script:

```bash
node verify-supabase.js
```

You should see:
```
✅ Products table: X records found
✅ Founders table: X records found  
✅ Webhook data table: 0 records found
```

---

## 🎯 Test Your Application

### 1. Start the development server:
```bash
npm run dev
```

### 2. Visit these pages:

- **Main Dashboard**: http://localhost:3000
  - Form to select products and send to webhook

- **Database Page**: http://localhost:3000/database
  - View all founders from "scraped Data" table
  - Filter by industry
  - Refresh data

### 3. Test the APIs:

```bash
# Get all products
curl http://localhost:3000/api/products

# Get all founders
curl http://localhost:3000/api/founders

# Test Supabase connection
curl http://localhost:3000/api/test-supabase
```

---

## 📊 Your Tables Overview

### 1. **products** table
- Stores chemical product information
- Used by: ProductForm, ProductsTable
- Columns: industry, brandName, chemicalName, application, targetCountries

### 2. **webhook_data** table  
- Stores data sent to webhooks
- Used by: Webhook API
- Columns: industry, brandName, chemicalName, application, targetCountries, source

### 3. **scraped Data** table (already exists!)
- Stores founder information
- Used by: FoundersTable
- Columns: Founder Name, Company Name, Email, LinkedIn, etc.

---

## 🔧 Troubleshooting

### "Table does not exist" error
✅ **Solution**: Run the SQL script in Supabase SQL Editor (Method 1)

### "No data showing" in tables
✅ **Solution**: 
1. Run the SQL INSERT statements to add sample data
2. Or call the `/api/setup-db` endpoint

### "Connection failed" error
✅ **Solution**: Check your `lib/supabase.ts` credentials are correct

### Empty "scraped Data" table
✅ **Solution**: Import founders data using the import script:
```bash
node scripts/import-founders.js
```

---

## 📝 Next Steps

1. ✅ Run SQL script in Supabase (Method 1 above)
2. ✅ Verify with: `node verify-supabase.js`
3. ✅ Start dev server: `npm run dev`
4. ✅ Visit `/database` page to see your data
5. ✅ Add founders data if needed

Need help? Check the console logs or run the verification script!



