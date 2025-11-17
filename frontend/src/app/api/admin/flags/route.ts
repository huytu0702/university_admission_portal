import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward the request to the backend admin API without authentication
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/admin/flags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Log the error status for easier debugging
      console.error(`Backend API error: ${response.status} - ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch feature flags from backend: ${response.status} ${response.statusText}` 
        }), 
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin flags GET:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}