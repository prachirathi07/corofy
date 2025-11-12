import { NextResponse } from 'next/server';
import { FounderDatabase } from '@/lib/database';

export async function GET() {
  try {
    console.log('🏭 Fetching founder industries...');
    
    const industries = await FounderDatabase.getFounderIndustries();
    console.log('✅ Industries fetched:', industries.length);
    
    return NextResponse.json({
      success: true,
      data: industries
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching founder industries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch founder industries' },
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
