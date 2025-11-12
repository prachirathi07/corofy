# Supabase Integration Documentation

## Overview
This project has been successfully integrated with Supabase to store and retrieve product data. The integration includes:

- **Supabase Configuration**: Connected to your Supabase project using the provided URL and API key
- **Database Operations**: Full CRUD operations for products and webhook data
- **API Endpoints**: RESTful APIs to interact with Supabase data
- **Dashboard Integration**: Real-time data display from Supabase

## Supabase Configuration

### Project Details
- **URL**: `https://utwhoufvuqkcbczszuog.supabase.co`
- **API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon key)
- **Configuration File**: `lib/supabase.ts`

### Database Schema
The integration expects the following tables in your Supabase database:

#### Products Table
```sql
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
```

#### Webhook Data Table
```sql
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
```

## API Endpoints

### 1. Products API (`/api/products`)
- **GET**: Fetch products with optional filtering
  - Query params: `industry`, `brandName`, `chemicalName`
- **POST**: Create new product

### 2. Dropdown Data API (`/api/dropdown-data`)
- **GET**: Fetch dropdown options
  - Query params: `type` (industries, brands, chemicals, countries)
  - Additional params based on type

### 3. Webhook API (`/api/webhook`)
- **POST**: Process webhook data and store in Supabase
- **GET**: Test webhook connectivity

### 4. Database Setup API (`/api/setup-db`)
- **POST**: Initialize database with sample data

### 5. Test Supabase API (`/api/test-supabase`)
- **GET**: Test Supabase connection

## Components

### 1. ProductForm (`components/ProductForm.tsx`)
- Fetches data from Supabase APIs
- Dynamic dropdown population based on selections
- Loading states and error handling
- Webhook submission with Supabase storage

### 2. ProductsTable (`components/ProductsTable.tsx`)
- Displays all products from Supabase
- Industry filtering
- Responsive table with country tags
- Real-time data updates

### 3. Dashboard (`components/Dashboard.tsx`)
- Main dashboard with both form and table
- Integrated Supabase data display

## Database Operations

### ProductDatabase Class (`lib/database.ts`)
- `getAllProducts()`: Fetch all products
- `getProductsByIndustry(industry)`: Filter by industry
- `getProductBySelection(industry, brand, chemical)`: Get specific product
- `insertProduct(productData)`: Create new product
- `updateProduct(id, updates)`: Update existing product
- `deleteProduct(id)`: Remove product
- `getIndustries()`: Get unique industries
- `getBrandsByIndustry(industry)`: Get brands for industry
- `getChemicalsByBrand(industry, brand)`: Get chemicals for brand
- `getCountriesBySelection(industry, brand, chemical)`: Get countries

### WebhookDatabase Class (`lib/database.ts`)
- `insertWebhookData(webhookData)`: Store webhook data
- `getAllWebhookData()`: Fetch all webhook data
- `getWebhookDataByDateRange(start, end)`: Filter by date range

## Usage Flow

1. **Setup Database**: Call `/api/setup-db` to initialize with sample data
2. **Select Products**: Use the ProductForm to select industry, brand, chemical, and countries
3. **Submit to Webhook**: Form data is sent to webhook URL and stored in Supabase
4. **View Data**: ProductsTable displays all data from Supabase
5. **Filter Data**: Use industry filter to view specific products

## Testing

### Test Supabase Connection
```bash
curl http://localhost:3000/api/test-supabase
```

### Test Database Setup
```bash
curl -X POST http://localhost:3000/api/setup-db
```

### Test Products API
```bash
# Get all products
curl http://localhost:3000/api/products

# Get products by industry
curl "http://localhost:3000/api/products?industry=Agrochemical"

# Get dropdown data
curl "http://localhost:3000/api/dropdown-data?type=industries"
```

## Environment Variables

The Supabase configuration is currently hardcoded in `lib/supabase.ts`. For production, consider moving to environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://utwhoufvuqkcbczszuog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Security Notes

- Row Level Security (RLS) is enabled on both tables
- Policies allow all operations (adjust for production)
- API key is the anon key (safe for client-side use)
- Consider implementing proper authentication for production

## Next Steps

1. **Test the Integration**: Run the development server and test all functionality
2. **Setup Database**: Use the setup-db API to initialize your Supabase database
3. **Customize UI**: Modify the components to match your design requirements
4. **Add Authentication**: Implement proper user authentication if needed
5. **Production Deployment**: Deploy to your hosting platform

## Troubleshooting

### Common Issues

1. **Database Tables Not Found**: Run the SQL schema in your Supabase dashboard
2. **API Errors**: Check the browser console and server logs
3. **Connection Issues**: Verify the Supabase URL and API key
4. **RLS Policies**: Ensure policies allow the operations you need

### Debug Endpoints

- `/api/test-supabase`: Test Supabase connection
- `/api/test-db`: Test database operations
- Browser DevTools: Check network requests and console errors
