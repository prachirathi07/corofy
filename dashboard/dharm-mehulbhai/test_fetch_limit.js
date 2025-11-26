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

async function testFetchLimit() {
    console.log('--- Fetching with range 0-2000 ---');
    const { data, error, count } = await supabase
        .from('scraped_data')
        .select('*', { count: 'exact' })
        .range(0, 2000);

    if (error) {
        console.log('Error fetching:', error.message);
    } else {
        console.log('Fetched rows:', data.length);
        console.log('Total count in DB:', count);
    }
}

testFetchLimit();
