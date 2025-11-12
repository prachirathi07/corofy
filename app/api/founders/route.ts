import { NextRequest, NextResponse } from 'next/server';
import { FounderDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');
    const verification = searchParams.get('verification');
    const mailStatus = searchParams.get('mailStatus');

    console.log('🔍 Fetching founders with params:', { industry, verification, mailStatus });

    let founders;

    if (industry) {
      founders = await FounderDatabase.getFoundersByIndustry(industry);
    } else if (verification !== null) {
      founders = await FounderDatabase.getFoundersByVerification(verification === 'true');
    } else if (mailStatus) {
      founders = await FounderDatabase.getFoundersByMailStatus(mailStatus);
    } else {
      founders = await FounderDatabase.getAllFounders();
    }

    console.log('✅ Founders fetched:', founders.length);
    
    return NextResponse.json({
      success: true,
      data: founders
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching founders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch founders data' },
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
    const founderData = await request.json();
    console.log('📝 Creating new founder:', founderData);

    const newFounder = await FounderDatabase.insertFounder(founderData);
    console.log('✅ Founder created:', newFounder?.id);
    
    return NextResponse.json(newFounder, { 
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error creating founder:', error);
    return NextResponse.json(
      { error: 'Failed to create founder' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      } }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Founder ID is required' },
        { status: 400, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        } }
      );
    }

    const updates = await request.json();
    console.log('🔄 Updating founder:', id, updates);

    const updatedFounder = await FounderDatabase.updateFounder(id, updates);
    console.log('✅ Founder updated:', updatedFounder?.id);
    
    return NextResponse.json(updatedFounder, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error updating founder:', error);
    return NextResponse.json(
      { error: 'Failed to update founder' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Founder ID is required' },
        { status: 400, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        } }
      );
    }

    console.log('🗑️ Deleting founder:', id);
    await FounderDatabase.deleteFounder(id);
    console.log('✅ Founder deleted:', id);
    
    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Error deleting founder:', error);
    return NextResponse.json(
      { error: 'Failed to delete founder' },
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
