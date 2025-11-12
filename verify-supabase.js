const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utwhoufvuqkcbczszuog.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d2hvdWZ2dXFrY2JjenN6dW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDI2MDIsImV4cCI6MjA3NDc3ODYwMn0.3CL11eCCfXw5hAxt5MF-ToJmZowqZvq06LF5Cz4EhO8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySupabase() {
  console.log('🔍 Verifying Supabase Connection...\n');
  console.log('📡 Supabase URL:', supabaseUrl);
  console.log('─'.repeat(60));

  // Test 1: Products Table
  console.log('\n✅ Test 1: Checking "products" table...');
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(3);

    if (productsError) {
      console.log('❌ Products table error:', productsError.message);
    } else {
      console.log(`✅ Products table: ${products.length} records found`);
      if (products.length > 0) {
        console.log('   Sample:', products[0].industry, '-', products[0].brandName);
      }
    }
  } catch (err) {
    console.log('❌ Products table error:', err.message);
  }

  // Test 2: Founders Table (scraped Data)
  console.log('\n✅ Test 2: Checking "scraped Data" table (founders)...');
  try {
    const { data: founders, error: foundersError } = await supabase
      .from('scraped Data')
      .select('*')
      .limit(3);

    if (foundersError) {
      console.log('❌ Founders table error:', foundersError.message);
    } else {
      console.log(`✅ Founders table: ${founders.length} records found`);
      if (founders.length > 0) {
        console.log('   Sample founder:', founders[0]['Founder Name'] || 'N/A');
        console.log('   Company:', founders[0]['Company Name'] || 'N/A');
      }
    }
  } catch (err) {
    console.log('❌ Founders table error:', err.message);
  }

  // Test 3: Webhook Data Table
  console.log('\n✅ Test 3: Checking "webhook_data" table...');
  try {
    const { data: webhookData, error: webhookError } = await supabase
      .from('webhook_data')
      .select('*')
      .limit(3);

    if (webhookError) {
      console.log('❌ Webhook data table error:', webhookError.message);
    } else {
      console.log(`✅ Webhook data table: ${webhookData.length} records found`);
    }
  } catch (err) {
    console.log('❌ Webhook data table error:', err.message);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('✅ Supabase verification complete!\n');
  console.log('📋 Next steps:');
  console.log('   1. If tables are missing, run the SQL in setup-supabase-tables.sql');
  console.log('   2. Check SETUP_INSTRUCTIONS.md for detailed setup guide');
  console.log('   3. Run: npm run dev');
  console.log('   4. Visit: http://localhost:3000/database\n');
}

verifySupabase().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});



