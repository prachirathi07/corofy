require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAllVerificationToFalse() {
    try {
        console.log('🔄 Resetting all verification to false...\n');

        // Step 1: Get total count
        const { count, error: countError } = await supabase
            .from('scraped_data_new')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw countError;
        }

        console.log(`📊 Total records in database: ${count}\n`);

        // Step 2: Fetch all IDs in chunks
        console.log('📥 Fetching all record IDs...');
        let allIds = [];
        let from = 0;
        const fetchStep = 1000;
        let fetchMore = true;

        while (fetchMore) {
            const { data: chunk, error: fetchError } = await supabase
                .from('scraped_data_new')
                .select('id')
                .range(from, from + fetchStep - 1);

            if (fetchError) throw fetchError;

            if (chunk && chunk.length > 0) {
                allIds = [...allIds, ...chunk.map(r => r.id)];
                from += fetchStep;
                console.log(`   ✓ Fetched ${allIds.length} IDs so far...`);

                if (chunk.length < fetchStep) {
                    fetchMore = false;
                }
            } else {
                fetchMore = false;
            }
        }

        console.log(`✅ Fetched ${allIds.length} total IDs\n`);

        // Step 3: Update all to is_verified = false in chunks
        console.log('🔧 Setting is_verified = false for all records...');
        const CHUNK_SIZE = 100;
        const totalChunks = Math.ceil(allIds.length / CHUNK_SIZE);

        for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
            const chunk = allIds.slice(i, i + CHUNK_SIZE);
            const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

            const { error: updateError } = await supabase
                .from('scraped_data_new')
                .update({ is_verified: false })
                .in('id', chunk);

            if (updateError) {
                throw updateError;
            }
            console.log(`   ✓ Updated chunk ${chunkNumber}/${totalChunks} (${chunk.length} records)`);
        }

        console.log(`✅ Updated ${allIds.length} records to is_verified = false\n`);

        // Step 4: Verify the changes
        console.log('🔍 Verifying changes...');
        const { data: verifiedRecords } = await supabase
            .from('scraped_data_new')
            .select('id', { count: 'exact', head: true })
            .eq('is_verified', true);

        const { data: unverifiedRecords } = await supabase
            .from('scraped_data_new')
            .select('id', { count: 'exact', head: true })
            .eq('is_verified', false);

        console.log('\n✅ Reset complete!');
        console.log('📊 Final status:');
        console.log(`   - Verified (is_verified = true): 0`);
        console.log(`   - Unverified (is_verified = false): ${allIds.length}`);
        console.log('\n💡 Now refresh your dashboard to see the first 400 emails auto-selected (UI only)');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

resetAllVerificationToFalse();
