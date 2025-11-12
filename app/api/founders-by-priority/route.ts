import { NextResponse } from 'next/server';
import { FounderDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority');

    if (!priority) {
      return NextResponse.json(
        { error: 'Priority parameter is required' },
        { status: 400 }
      );
    }

    // Get all founders
    const founders = await FounderDatabase.getAllFounders();

    // Filter by priority
    // Priority values in database: 'High Priority', 'Medium Priority', 'Low Priority'
    const filteredFounders = founders.filter(f => {
      const founderPriority = f['Priority based on Reply'];
      return founderPriority === priority;
    });

    // Map to only return the fields we need
    const result = filteredFounders.map(founder => ({
      id: founder.id,
      founderName: founder['Founder Name'] || '',
      companyName: founder['Company Name'] || '',
      email: founder['Founder Email'] || '',
      industry: founder["Company's Industry"] || '',
      reply: founder['Mail Replys'] || ''
    }));

    return NextResponse.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching founders by priority:', error);
    return NextResponse.json(
      { error: 'Failed to fetch founders by priority' },
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

