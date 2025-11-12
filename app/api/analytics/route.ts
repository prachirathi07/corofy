import { NextResponse } from 'next/server';
import { FounderDatabase } from '@/lib/database';

export async function GET() {
  try {
    console.log('📊 Fetching analytics data...');
    
    // Get all founders data
    const founders = await FounderDatabase.getAllFounders();
    console.log('📈 Total founders:', founders.length);

    // Calculate email statistics
    const totalEmails = founders.length;
    const emailsSent = founders.filter(f => f['Mail Status'] === 'SENT').length;
    const emailsNotSent = founders.filter(f => f['Mail Status'] !== 'SENT' || !f['Mail Status']).length;
    const emails5MinSent = founders.filter(f => f['1st Follow-Up Sent (5 days)'] === 'SENT').length;
    const emails10MinSent = founders.filter(f => f['2nd Follow-Up Sent (10 days)'] === 'SENT').length;
    const emailsReplied = founders.filter(f => {
      const reply = f['Mail Replys'];
      return reply && reply.trim() !== '';
    }).length;
    const emailsNotReplied = founders.filter(f => {
      const reply = f['Mail Replys'];
      return !reply || reply.trim() === '';
    }).length;
    const highPriority = founders.filter(f => f['Priority based on Reply'] === 'High Priority').length;
    const mediumPriority = founders.filter(f => f['Priority based on Reply'] === 'Medium Priority').length;
    const lowPriority = founders.filter(f => f['Priority based on Reply'] === 'Low Priority').length;

    const analytics = {
      totalEmails,
      emailsSent,
      emailsNotSent,
      emails5MinSent,
      emails10MinSent,
      emailsReplied,
      emailsNotReplied,
      highPriority,
      mediumPriority,
      lowPriority
    };

    console.log('📊 Debug - Email Status breakdown:');
    console.log('  - Total emails:', totalEmails);
    console.log('  - Emails sent:', emailsSent);
    console.log('  - Emails not sent:', emailsNotSent);
    console.log('  - 5-day follow-ups sent:', emails5MinSent);
    console.log('  - 10-day follow-ups sent:', emails10MinSent);
    console.log('  - Emails replied:', emailsReplied);
    console.log('  - Emails not replied:', emailsNotReplied);
    console.log('  - High priority:', highPriority);
    console.log('  - Medium priority:', mediumPriority);
    console.log('  - Low priority:', lowPriority);
    
    console.log('✅ Analytics calculated:', analytics);
    
    return NextResponse.json(analytics, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
