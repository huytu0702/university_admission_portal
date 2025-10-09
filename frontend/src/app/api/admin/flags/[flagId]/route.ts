import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function PATCH(request: NextRequest, { params }: { params: { flagId: string } }) {
  try {
    const { flagId } = await params;

    if (!flagId) {
      return new Response(JSON.stringify({ error: 'Missing flagId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid enabled value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward the request to the backend admin API without authentication
    // Note: The URL parameter is called flagId but maps to flagName in the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/admin/flags/${flagId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      // Log the error status for easier debugging
      console.error(`Backend API error: ${response.status} - ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to update feature flag in backend: ${response.status} ${response.statusText}` 
        }), 
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    // Revalidate the admin page after updating a flag
    revalidatePath('/admin');
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin flags PATCH:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}