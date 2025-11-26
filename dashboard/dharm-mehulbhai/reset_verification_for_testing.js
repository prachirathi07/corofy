require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetVerificationForTesting() {
    try {
        console.log('🔄 Starting verification reset for testing...\n');

        // Step 1: Get all records
        console.log('📊 Fetching all records...');
        const { data: allRecords, error: fetchError } = await supabase
            .from('scraped_data_new')
            .select('id, is_verified, mail_status')
            .order('id');

        if (fetchError) {
            throw fetchError;
        }

        console.log(`✅ Found ${allRecords.length} total records\n`);

        // Step 2: Separate into groups
        const first800 = allRecords.slice(0, 800);
        const next400 = allRecords.slice(800, 1200);
        const remaining = allRecords.slice(1200);

        console.log('📋 Record distribution:');
        console.log(`   - Records 1-800: ${first800.length} (will set is_verified = true)`);
        console.log(`   - Records 801-1200: ${next400.length} (will set is_verified = false)`);
        console.log(`   - Records 1201+: ${remaining.length} (will set is_verified = false)\n`);

        // Step 3: Update first 800 to verified (in chunks)
        if (first800.length > 0) {
            console.log('🔧 Setting is_verified = true for records 1-800...');
            const first800Ids = first800.map(r => r.id);

            // Update in chunks of 100
            const CHUNK_SIZE = 100;
            for (let i = 0; i < first800Ids.length; i += CHUNK_SIZE) {
                const chunk = first800Ids.slice(i, i + CHUNK_SIZE);
                const { error: updateError } = await supabase
                    .from('scraped_data_new')
                    .update({ is_verified: true })
                    .in('id', chunk);

                if (updateError) {
                    throw updateError;
                }
                console.log(`   ✓ Updated chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(first800Ids.length / CHUNK_SIZE)} (${chunk.length} records)`);
            }
            console.log(`✅ Updated ${first800.length} records to verified\n`);
        }

        // Step 4: Update records 801+ to unverified (in chunks)
        const toUnverify = [...next400, ...remaining];
        if (toUnverify.length > 0) {
            console.log('🔧 Setting is_verified = false for records 801+...');
            const toUnverifyIds = toUnverify.map(r => r.id);

            // Update in chunks of 100
            const CHUNK_SIZE = 100;
            for (let i = 0; i < toUnverifyIds.length; i += CHUNK_SIZE) {
                const chunk = toUnverifyIds.slice(i, i + CHUNK_SIZE);
                const { error: updateError } = await supabase
                    .from('scraped_data_new')
                    .update({ is_verified: false })
                    .in('id', chunk);

                if (updateError) {
                    throw updateError;
                }
                console.log(`   ✓ Updated chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(toUnverifyIds.length / CHUNK_SIZE)} (${chunk.length} records)`);
            }
            console.log(`✅ Updated ${toUnverify.length} records to unverified\n`);
        }

        // Step 5: Verify the changes
        console.log('🔍 Verifying changes...');
        const { data: verifiedRecords } = await supabase
            .from('scraped_data_new')
            .select('id, is_verified')
            .eq('is_verified', true);

        const { data: unverifiedRecords } = await supabase
            .from('scraped_data_new')
            .select('id, is_verified')
            .eq('is_verified', false);

        console.log('\n✅ Reset complete!');
        console.log('📊 Final status:');
        console.log(`   - Verified (is_verified = true): ${verifiedRecords?.length || 0}`);
        console.log(`   - Unverified (is_verified = false): ${unverifiedRecords?.length || 0}`);
        console.log('\n💡 Now refresh your dashboard to see the auto-selection select records 801-1200');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

resetVerificationForTesting();
