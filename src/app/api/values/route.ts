import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body
    if (!body.values) {
      return NextResponse.json({ error: 'Values are required' }, { status: 400 });
    }

    // Generate a unique ID for the user
    const userId = uuidv4();

    // Insert the user values into Supabase
    const { error } = await supabase.from('user_values').insert({
      id: userId,
      values: body.values,
      interests: body.interests || [], // Use empty array if interests not provided
      selected_image_values: body.selected_image_values || null,
      strengths: body.strengths || null, // Add strengths field
    });

    if (error) {
      console.error('Error saving user values:', error);
      return NextResponse.json({ error: 'Failed to save user values' }, { status: 500 });
    }

    return NextResponse.json({ userId });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

  const { data: userData, error: userError } = await supabase
    .from('user_values')
    .select('strengths, values')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.error('Error fetching user values', userError);
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user_values: userData });
}
