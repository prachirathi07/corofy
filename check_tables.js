const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim();
    }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
    console.log('--- Checking scrape_data ---');
    const { data: scrapeData, error: scrapeError } = await supabase
        .from('scrape_data')
        .select('*')
        .limit(1);

    if (scrapeError) {
        console.log('Error fetching scrape_data:', scrapeError.message);
    } else {
        console.log('scrape_data rows:', scrapeData.length);
        if (scrapeData.length > 0) console.log('scrape_data columns:', Object.keys(scrapeData[0]));
    }

    console.log('\n--- Checking scraped_data ---');
    const { data: scrapedData, error: scrapedError } = await supabase
        .from('scraped_data')
        .select('*')
        .limit(1);

    if (scrapedError) {
        console.log('Error fetching scraped_data:', scrapedError.message);
    } else {
        console.log('scraped_data rows:', scrapedData.length);
        if (scrapedData.length > 0) console.log('scraped_data columns:', Object.keys(scrapedData[0]));
    }
}

checkTables();
