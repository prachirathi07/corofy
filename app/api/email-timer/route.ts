import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'userEmail parameter is required' },
        { status: 400 }
      );
    }

    // Query the table directly
    const { data, error } = await supabase
      .from('email_send_timestamps')
      .select('last_send_timestamp')
      .eq('user_email', userEmail)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found - no timer active
      return NextResponse.json({
        success: true,
        timestamp: null
      });
    }

    if (error) {
      console.error('Error fetching email timer:', error);
      // If table doesn't exist, return null (fail gracefully)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('email_send_timestamps table does not exist. Please run the SQL migration.');
        return NextResponse.json({
          success: true,
          timestamp: null
        });
      }
      return NextResponse.json({
        success: true,
        timestamp: null
      });
    }

    // Return the timestamp (could be 0 if cleared, which is valid)
    const timestamp = data?.last_send_timestamp;
    
    // If timestamp is 0 or null, treat as no timer
    if (!timestamp || timestamp === 0) {
      return NextResponse.json({
        success: true,
        timestamp: null
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: timestamp
    });
  } catch (error) {
    console.error('Error in GET /api/email-timer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, timestamp } = body;

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'userEmail is required' },
        { status: 400 }
      );
    }

    if (timestamp === undefined || timestamp === null) {
      return NextResponse.json(
        { success: false, error: 'timestamp is required' },
        { status: 400 }
      );
    }

    // If timestamp is 0, delete the record (clear timer)
    if (timestamp === 0) {
      const { error: deleteError } = await supabase
        .from('email_send_timestamps')
        .delete()
        .eq('user_email', userEmail);

      if (deleteError) {
        console.error('Error clearing email timer:', deleteError);
        // If table doesn't exist, that's okay - just return success
        if (deleteError.code === '42P01' || deleteError.message?.includes('does not exist')) {
          return NextResponse.json({
            success: true,
            message: 'Timer cleared successfully'
          });
        }
        return NextResponse.json(
          { success: false, error: 'Failed to clear timer' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Timer cleared successfully'
      });
    }

    // Upsert the timestamp (insert or update)
    console.log('💾 Attempting to save timer:', { userEmail, timestamp });
    const { data: upsertData, error } = await supabase
      .from('email_send_timestamps')
      .upsert(
        {
          user_email: userEmail,
          last_send_timestamp: timestamp,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_email'
        }
      )
      .select();

    if (error) {
      console.error('❌ Error saving email timer - Full error:', JSON.stringify(error, null, 2));
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      
      // If table doesn't exist, return error with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Table does not exist. Please run the SQL migration from create-email-timer-table.sql in your Supabase SQL Editor.' 
          },
          { status: 500 }
        );
      }
      
      // If RLS policy issue
      if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('policy')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Permission denied. Please check Row Level Security policies on email_send_timestamps table.' 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to save timer: ${error.message || 'Unknown error'}`,
          errorCode: error.code,
          errorDetails: error.details
        },
        { status: 500 }
      );
    }

    console.log('✅ Timer saved successfully:', upsertData);

    return NextResponse.json({
      success: true,
      message: 'Timer saved successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/email-timer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

