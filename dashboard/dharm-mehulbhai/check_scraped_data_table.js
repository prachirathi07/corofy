const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      envVars[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
    }
  });
}

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure .env.local contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkScrapedDataTable() {
  console.log('🔍 Checking Supabase database for scraped_data table...\n');

  try {
    // Check if scraped_data table exists and get its structure
    console.log('📊 Fetching data from scraped_data table...');
    const { data, error, count } = await supabase
      .from('scraped_data')
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching from scraped_data:', error);
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('\n⚠️  Table "scraped_data" does not exist.');
        console.log('Checking for alternative table names...\n');
        
        // Try scraped_data_new
        const { data: newData, error: newError } = await supabase
          .from('scraped_data_new')
          .select('*', { count: 'exact' })
          .limit(5);
        
        if (!newError && newData) {
          console.log('✅ Found table: scraped_data_new');
          console.log(`   Total rows: ${newData.length} (showing first 5)`);
          if (newData.length > 0) {
            console.log('\n📋 Sample columns:', Object.keys(newData[0]));
          }
        } else {
          console.log('❌ scraped_data_new also does not exist or has errors');
        }
      }
      return;
    }

    console.log(`✅ Table "scraped_data" exists!`);
    console.log(`   Total rows: ${count || data.length}`);
    console.log(`   Showing first ${data.length} rows:\n`);

    if (data && data.length > 0) {
      console.log('📋 Columns in table:');
      console.log('   ', Object.keys(data[0]).join(', '));
      console.log('\n📄 Sample data (first row):');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Get total count
      const { count: totalCount } = await supabase
        .from('scraped_data')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\n📊 Total records in scraped_data: ${totalCount}`);
    } else {
      console.log('⚠️  Table exists but is empty');
    }

    // Check for scraped_data_new as well
    console.log('\n🔍 Checking for scraped_data_new table...');
    const { data: newData, error: newError, count: newCount } = await supabase
      .from('scraped_data_new')
      .select('*', { count: 'exact' })
      .limit(1);

    if (!newError && newData !== null) {
      console.log(`✅ Table "scraped_data_new" also exists!`);
      console.log(`   Total rows: ${newCount || 0}`);
    } else {
      console.log('ℹ️  Table "scraped_data_new" does not exist or has errors');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkScrapedDataTable();

