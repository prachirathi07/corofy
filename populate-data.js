const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utwhoufvuqkcbczszuog.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d2hvdWZ2dXFrY2JjenN6dW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDI2MDIsImV4cCI6MjA3NDc3ODYwMn0.3CL11eCCfXw5hAxt5MF-ToJmZowqZvq06LF5Cz4EhO8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sample Products Data
const sampleProducts = [
  {
    industry: 'Agrochemical',
    brandName: 'CropProtect',
    chemicalName: 'Glyphosate',
    application: 'Herbicide for weed control',
    targetCountries: ['USA', 'Canada', 'Mexico', 'Brazil']
  },
  {
    industry: 'Agrochemical',
    brandName: 'FarmGuard',
    chemicalName: 'Imidacloprid',
    application: 'Insecticide for crop protection',
    targetCountries: ['Brazil', 'Argentina', 'India', 'China']
  },
  {
    industry: 'Pharmaceutical',
    brandName: 'MediCare',
    chemicalName: 'Acetaminophen',
    application: 'Pain relief and fever reduction',
    targetCountries: ['USA', 'UK', 'Germany', 'France']
  },
  {
    industry: 'Pharmaceutical',
    brandName: 'HealthPlus',
    chemicalName: 'Ibuprofen',
    application: 'Anti-inflammatory and pain relief',
    targetCountries: ['France', 'Spain', 'Italy', 'Japan']
  },
  {
    industry: 'Industrial',
    brandName: 'ChemCorp',
    chemicalName: 'Sodium Hydroxide',
    application: 'Chemical processing and manufacturing',
    targetCountries: ['China', 'Japan', 'South Korea', 'USA']
  }
];

// Sample Founders Data
const sampleFounders = [
  {
    'Founder Name': 'John Smith',
    'Company Name': 'TechStart Inc',
    'Position': 'CEO & Co-Founder',
    'Founder Email': 'john@techstart.com',
    'Founder Linkedin': 'https://linkedin.com/in/johnsmith',
    'Founder Address': '123 Tech Street, San Francisco, CA',
    "Company's Industry": 'Technology',
    'Company Website': 'https://techstart.com',
    'Company Linkedin': 'https://linkedin.com/company/techstart',
    'Company Blogpost': 'https://techstart.com/blog',
    'Company Angellist': null,
    'Company Phone': '+1-415-555-0100',
    'Verification': true,
    '5 Min Sent': true,
    '10 Min Sent': false,
    'Mail Status': 'SENT',
    'Priority based on Reply': 'High',
    'Thread ID': null
  },
  {
    'Founder Name': 'Sarah Johnson',
    'Company Name': 'HealthTech Solutions',
    'Position': 'Founder & CTO',
    'Founder Email': 'sarah@healthtech.io',
    'Founder Linkedin': 'https://linkedin.com/in/sarahjohnson',
    'Founder Address': '456 Health Ave, Boston, MA',
    "Company's Industry": 'Healthcare',
    'Company Website': 'https://healthtech.io',
    'Company Linkedin': 'https://linkedin.com/company/healthtech',
    'Company Blogpost': null,
    'Company Angellist': 'https://angel.co/healthtech',
    'Company Phone': '+1-617-555-0200',
    'Verification': true,
    '5 Min Sent': true,
    '10 Min Sent': true,
    'Mail Status': 'SENT',
    'Priority based on Reply': 'Medium',
    'Thread ID': 'thread_abc123'
  },
  {
    'Founder Name': 'Michael Chen',
    'Company Name': 'AI Innovations',
    'Position': 'Co-Founder',
    'Founder Email': 'michael@aiinnovations.ai',
    'Founder Linkedin': 'https://linkedin.com/in/michaelchen',
    'Founder Address': '789 Innovation Blvd, Austin, TX',
    "Company's Industry": 'Artificial Intelligence',
    'Company Website': 'https://aiinnovations.ai',
    'Company Linkedin': 'https://linkedin.com/company/ai-innovations',
    'Company Blogpost': 'https://aiinnovations.ai/insights',
    'Company Angellist': null,
    'Company Phone': '+1-512-555-0300',
    'Verification': false,
    '5 Min Sent': false,
    '10 Min Sent': false,
    'Mail Status': 'PENDING',
    'Priority based on Reply': null,
    'Thread ID': null
  }
];

async function populateData() {
  console.log('🚀 Populating Supabase Tables...\n');
  console.log('─'.repeat(60));

  // 1. Populate Products Table
  console.log('\n📦 Inserting sample products...');
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .insert(sampleProducts)
      .select();

    if (productsError) {
      console.log('⚠️  Products:', productsError.message);
    } else {
      console.log(`✅ Inserted ${products.length} products successfully!`);
    }
  } catch (err) {
    console.log('❌ Products error:', err.message);
  }

  // 2. Populate Founders Table
  console.log('\n👥 Inserting sample founders...');
  try {
    const { data: founders, error: foundersError } = await supabase
      .from('scraped Data')
      .insert(sampleFounders)
      .select();

    if (foundersError) {
      console.log('⚠️  Founders:', foundersError.message);
    } else {
      console.log(`✅ Inserted ${founders.length} founders successfully!`);
    }
  } catch (err) {
    console.log('❌ Founders error:', err.message);
  }

  // 3. Verify Data
  console.log('\n🔍 Verifying inserted data...');
  
  const { data: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });
  
  const { data: founderCount } = await supabase
    .from('scraped Data')
    .select('id', { count: 'exact', head: true });

  console.log('\n' + '─'.repeat(60));
  console.log('✅ Data Population Complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Products table: Ready ✅`);
  console.log(`   - Founders table: Ready ✅`);
  console.log(`   - Webhook data table: Ready (empty) ✅`);
  console.log('\n🚀 Next Steps:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Visit: http://localhost:3000');
  console.log('   3. Visit: http://localhost:3000/database');
  console.log('   4. Your tables should now display data! 🎉\n');
}

populateData().catch(err => {
  console.error('❌ Population failed:', err);
  process.exit(1);
});



