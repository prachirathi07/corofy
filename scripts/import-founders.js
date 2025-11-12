/**
 * Script to import founders data into Supabase
 * Usage: node scripts/import-founders.js
 */

const sampleFounders = [
  {
    "Founder Name": "Lina Yavuz",
    "Company Name": "Severin",
    "Position": "Key-Account-Manager",
    "Founder Email": "lina.yavuz@severin.de",
    "Founder Linkedin": "http://www.linkedin.com/in/lina-yavuz-751965244",
    "Founder Address": "Germany",
    "Company's Industry": "electrical/electronic manufacturing",
    "Company Website": "http://www.severin.com",
    "Company Linkedin": "http://www.linkedin.com/company/severin-elektroger-te-gmbh",
    "Company Phone": "+49 1516 2418101",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false
  },
  {
    "Founder Name": "Mike Braham",
    "Company Name": "Intempo Health",
    "Position": "Chief Growth Officer and Board of Directors",
    "Founder Email": "mike.braham@intempohealth.com",
    "Founder Linkedin": "http://www.linkedin.com/in/mikebraham",
    "Founder Address": "Leesburg, VA, USA",
    "Company's Industry": "information technology & services",
    "Company Website": "http://www.intempohealth.com",
    "Company Linkedin": "http://www.linkedin.com/company/intempo-health",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b56b4952e28"
  },
  {
    "Founder Name": "Bill Gates",
    "Company Name": "Breakthrough Energy",
    "Position": "Founder",
    "Founder Email": "be@breakthroughenergy.org",
    "Founder Linkedin": "http://www.linkedin.com/in/williamhgates",
    "Founder Address": "Seattle, WA, USA",
    "Company's Industry": "management consulting",
    "Company Website": "http://www.breakthroughenergy.org",
    "Company Linkedin": "http://www.linkedin.com/company/breakthrough-energy",
    "Company Phone": "+1 425-497-4303",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b56e7943a3a"
  },
  {
    "Founder Name": "Larry Fink",
    "Company Name": "BlackRock",
    "Position": "Chairman and CEO",
    "Founder Email": "larry_fink@blackrock.com",
    "Founder Linkedin": "http://www.linkedin.com/in/laurencefink",
    "Founder Address": "New York, NY, USA",
    "Company's Industry": "financial services",
    "Company Website": "http://www.blackrock.com",
    "Company Linkedin": "http://www.linkedin.com/company/blackrock",
    "Company Phone": "+1 212-810-5800",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b588bc3d458"
  },
  {
    "Founder Name": "Christian Luedders",
    "Company Name": "NovaTaste",
    "Position": "Product Designer",
    "Founder Email": "christian.luedders@novataste.com",
    "Founder Linkedin": "http://www.linkedin.com/in/christian-l%c3%bcdders-580481178",
    "Founder Address": "Hamburg, Germany",
    "Company's Industry": "food & beverages",
    "Company Website": "http://www.novataste.com",
    "Company Linkedin": "http://www.linkedin.com/company/nova-taste",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b57f9af8c72"
  },
  {
    "Founder Name": "Bobby Purnama",
    "Company Name": "Hyundai Motor Company",
    "Position": "General Purchase & Customs",
    "Founder Email": "bobbypurnama@hmmi.co.id",
    "Founder Linkedin": "http://www.linkedin.com/in/bobby-purnama-8b226aab",
    "Founder Address": "West Java, Indonesia",
    "Company's Industry": "automotive",
    "Company Website": "http://www.hyundaiusa.com",
    "Company Linkedin": "http://www.linkedin.com/company/hyundai-motor-company",
    "Company Angellist": "http://angel.co/hyundai",
    "Company Phone": "+82 23-464-1114",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b57afdb4eb3"
  },
  {
    "Founder Name": "Yunming Shao",
    "Company Name": "The Hina Group",
    "Position": "Managing Director",
    "Founder Email": "yunming.shao@hinagroup.com",
    "Founder Linkedin": "http://www.linkedin.com/in/yunming-shao-66279732",
    "Founder Address": "China",
    "Company's Industry": "investment banking",
    "Company Website": "http://www.hinagroup.com",
    "Company Linkedin": "http://www.linkedin.com/company/the-hina-group",
    "Company Phone": "+1 650-331-8786",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b580d4b80f5"
  },
  {
    "Founder Name": "J Montes",
    "Company Name": "Wireless Replay, Inc.",
    "Position": "Director of Sales",
    "Founder Email": "jcmontes@wirelessreplay.com",
    "Founder Linkedin": "http://www.linkedin.com/in/j-carlos-montes-1296bb24b",
    "Founder Address": "Miami, FL, USA",
    "Company's Industry": "telecommunications",
    "Company Website": "http://www.wirelessreplay.com",
    "Company Linkedin": "http://www.linkedin.com/company/wireless-replay-inc",
    "Company Phone": "+1 305-599-8969",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b573de8516e"
  },
  {
    "Founder Name": "Carol Snyder",
    "Company Name": "EY",
    "Position": "Financial Services Client Director and Client Executive Leader for FSO Central Region",
    "Founder Email": "carol.snyder@ey.com",
    "Founder Linkedin": "http://www.linkedin.com/in/carol-snyder-8585738",
    "Founder Address": "Bloomington, IL, USA",
    "Company's Industry": "professional training & coaching",
    "Company Website": "http://www.ey.com",
    "Company Linkedin": "http://www.linkedin.com/company/ernstandyoung",
    "Company Angellist": "http://angel.co/ernst-young-31",
    "Company Phone": "+44 20 7951 2000",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b584227d255"
  },
  {
    "Founder Name": "Philippe Winter",
    "Company Name": "Squadron Aviation Services Ltd.",
    "Position": "Lead Captain",
    "Founder Email": "philippe.winter@squadronav.com",
    "Founder Linkedin": "http://www.linkedin.com/in/philippe-winter",
    "Founder Address": "São Paulo - State of São Paulo, Brazil",
    "Company's Industry": "aviation",
    "Company Linkedin": "http://www.linkedin.com/company/squadron-aviation-services-ltd",
    "Verification": false,
    "5 Min Sent": false,
    "10 Min Sent": false,
    "Mail Status": "SENT",
    "Thread ID": "19999b568ab9f20a"
  }
];

async function importFounders() {
  console.log('Starting import of founders data...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < sampleFounders.length; i++) {
    const founder = sampleFounders[i];
    console.log(`[${i + 1}/${sampleFounders.length}] Importing: ${founder['Founder Name']} from ${founder['Company Name']}...`);
    
    try {
      const response = await fetch('http://localhost:3006/api/founders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(founder)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✓ Success: ${founder['Founder Name']} imported`);
        successCount++;
      } else {
        console.log(`✗ Error: ${data.error || 'Unknown error'}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`✗ Network Error: ${error.message}`);
      errorCount++;
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total: ${sampleFounders.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('\nCheck http://localhost:3006/database to view your data!');
}

// Run the import
importFounders().catch(console.error);


