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

async function testChunkedFetch() {
    console.log('--- Testing Chunked Fetch ---');
    let allData = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    while (fetchMore) {
        console.log(`Fetching range ${from} to ${from + step - 1}...`);
        const { data: chunk, error: chunkError } = await supabase
            .from('scraped_data')
            .select('*')
            .range(from, from + step - 1);

        if (chunkError) {
            console.error('Error fetching chunk:', chunkError);
            return;
        }

        if (chunk && chunk.length > 0) {
            allData = [...allData, ...chunk];
            from += step;
            // If we got fewer rows than requested, we've reached the end
            if (chunk.length < step) {
                fetchMore = false;
            }
        } else {
            fetchMore = false;
        }
    }

    console.log('Total rows fetched:', allData.length);
}

testChunkedFetch();
