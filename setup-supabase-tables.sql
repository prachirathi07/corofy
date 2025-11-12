-- Setup SQL Script for Supabase Tables
-- Run this in your Supabase SQL Editor

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

-- Enable Row Level Security for Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust for production)
CREATE POLICY "Allow all operations on products" ON products
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_industry ON products(industry);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products("brandName");

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

-- Enable Row Level Security for Webhook Data
ALTER TABLE webhook_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on webhook_data" ON webhook_data
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Insert Sample Data for Products (Optional)
INSERT INTO products (industry, "brandName", "chemicalName", application, "targetCountries")
VALUES 
  ('Agrochemical', 'CropProtect', 'Glyphosate', 'Herbicide', ARRAY['USA', 'Canada', 'Mexico']),
  ('Agrochemical', 'FarmGuard', 'Imidacloprid', 'Insecticide', ARRAY['Brazil', 'Argentina', 'India']),
  ('Pharmaceutical', 'MediCare', 'Acetaminophen', 'Pain Relief', ARRAY['USA', 'UK', 'Germany']),
  ('Pharmaceutical', 'HealthPlus', 'Ibuprofen', 'Anti-inflammatory', ARRAY['France', 'Spain', 'Italy']),
  ('Industrial', 'ChemCorp', 'Sodium Hydroxide', 'Chemical Processing', ARRAY['China', 'Japan', 'South Korea'])
ON CONFLICT DO NOTHING;

-- 4. Verify Tables Created
SELECT 
  'products' as table_name, 
  COUNT(*) as record_count 
FROM products
UNION ALL
SELECT 
  'webhook_data' as table_name, 
  COUNT(*) as record_count 
FROM webhook_data
UNION ALL
SELECT 
  'scraped Data' as table_name, 
  COUNT(*) as record_count 
FROM "scraped Data";



