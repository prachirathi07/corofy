import { NextRequest, NextResponse } from 'next/server';
import { EmailTimerDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail') || 'corofy.marketing@gmail.com';

    console.log('🔍 Fetching email send timestamp for user:', userEmail);

    const timestamp = await EmailTimerDatabase.getEmailSendTimestamp(userEmail);
    
    return NextResponse.json({
      success: true,
      timestamp: timestamp,
      userEmail: userEmail
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching email send timestamp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email send timestamp' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail = 'corofy.marketing@gmail.com', timestamp } = body;

    if (!timestamp || typeof timestamp !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Timestamp is required and must be a number' },
        { status: 400, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        } }
      );
    }

    console.log('💾 Setting email send timestamp for user:', userEmail, 'timestamp:', timestamp);

    await EmailTimerDatabase.setEmailSendTimestamp(userEmail, timestamp);
    
    return NextResponse.json({
      success: true,
      message: 'Email send timestamp updated successfully',
      timestamp: timestamp,
      userEmail: userEmail
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error setting email send timestamp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set email send timestamp' },
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

