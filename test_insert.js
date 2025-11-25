const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually read .env.local
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = {};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim();
        }
    });
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key is missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertTestRow() {
    console.log('--- Inserting Test Row into scraped_data ---');

    // Try with just founder_name, assuming it might be a valid column
    const dummyData = {
        founder_name: 'Test Founder',
        // company_name: 'Test Company', 
        // verification: true // We know this failed
    };

    console.log('Attempting to insert test row with only founder_name...');
    const { data, error } = await supabase
        .from('scraped_data')
        .insert([dummyData])
        .select();

    if (error) {
        console.error('Error inserting data:', error);
        // If this fails, we'll know founder_name is also wrong or there are other constraints
    } else {
        console.log('Successfully inserted data:', data);
    }
}

insertTestRow();
