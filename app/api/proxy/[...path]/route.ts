import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'http://10.10.101.69:8000/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Reconstruct the API path
    const apiPath = pathSegments.join('/');
    const url = `${API_BASE_URL}/${apiPath}`;

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    // Get headers from the request
    const headers: HeadersInit = {};

    // Forward authorization header if present
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Check if this is a file upload (multipart/form-data)
    // Check both lowercase and original case
    const contentType = request.headers.get('content-type') || request.headers.get('Content-Type') || '';
    const isFileUpload = contentType.toLowerCase().includes('multipart/form-data');

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST, PUT, DELETE requests
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      if (isFileUpload) {
        try {
          // For file uploads, read the FormData and reconstruct it properly
          const incomingFormData = await request.formData();
          
          // Log FormData contents for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            const formDataEntries: Record<string, any> = {};
            const entries = Array.from(incomingFormData.entries());
            for (const [key, value] of entries) {
              if (value instanceof File) {
                formDataEntries[key] = `[File: ${value.name}, ${value.size} bytes, type: ${value.type || 'unknown'}]`;
              } else {
                formDataEntries[key] = value;
              }
            }
            console.log('Received FormData:', formDataEntries);
          }
          
          // Use the FormData directly - Next.js FormData should work with fetch
          // However, we need to ensure it's properly formatted
          // Try using it directly first, as Next.js FormData is compatible with fetch
          requestOptions.body = incomingFormData;
          // Don't set Content-Type header - fetch will set it with boundary automatically
        } catch (error) {
          console.error('Error parsing FormData:', error);
          // If FormData parsing fails, try to read as text
          try {
            const body = await request.text();
            if (body) {
              requestOptions.body = body;
              headers['Content-Type'] = 'application/json';
            }
          } catch (textError) {
            console.error('Error reading body as text:', textError);
          }
        }
      } else {
        // For non-multipart, try to read as JSON
        headers['Content-Type'] = 'application/json';
        try {
          const body = await request.text();
          if (body) {
            requestOptions.body = body;
          } else if (method === 'POST' || method === 'PUT') {
            // Send empty JSON object for POST/PUT requests with no body
            requestOptions.body = '{}';
          }
        } catch (error) {
          // If reading body fails, for POST/PUT, send empty JSON object
          if ((method === 'POST' || method === 'PUT') && !isFileUpload) {
            requestOptions.body = '{}';
          }
        }
      }
    } else {
      // For GET requests, set Content-Type if needed
      if (!isFileUpload) {
        headers['Content-Type'] = 'application/json';
      }
    }

    // Make the request to the backend with timeout
    let response: Response;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      // Add timeout to prevent hanging requests (30 seconds)
      timeoutId = setTimeout(() => controller.abort(), 30000);
      
      response = await fetch(fullUrl, {
        ...requestOptions,
        signal: controller.signal,
      });
      
      if (timeoutId) clearTimeout(timeoutId);
    } catch (fetchError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Fetch error:', {
        url: fullUrl,
        method,
        error: fetchError.message,
        name: fetchError.name,
        code: fetchError.code,
      });
      
      // Handle specific error types
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', detail: 'The request took too long to complete' },
          { status: 504 }
        );
      }
      
      if (fetchError.code === 'ECONNREFUSED' || fetchError.code === 'ENOTFOUND') {
        return NextResponse.json(
          { error: 'Backend unavailable', detail: 'Cannot connect to the backend server' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Network error', detail: fetchError.message },
        { status: 500 }
      );
    }

    // Handle 204 No Content response (Next.js doesn't allow 204 with JSON)
    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Get response data for other status codes
    let data: string;
    let jsonData: any;
    try {
      data = await response.text();
      try {
        jsonData = JSON.parse(data);
      } catch {
        jsonData = data;
      }
    } catch (parseError: any) {
      console.error('Error reading response:', {
        url: fullUrl,
        method,
        status: response.status,
        error: parseError.message,
      });
      jsonData = { error: 'Failed to parse response', detail: parseError.message };
    }

    // Log error responses for debugging
    if (response.status >= 400) {
      console.error(`Proxy error [${response.status}]:`, {
        url: fullUrl,
        method,
        contentType,
        isFileUpload,
        errorData: jsonData,
        responseHeaders: Object.fromEntries(response.headers.entries()),
      });
      
      // If it's a 400 error and we have FormData, log what we're sending
      if (response.status === 400 && isFileUpload && requestOptions.body) {
        try {
          const formData = requestOptions.body as FormData;
          const entries = Array.from(formData.entries());
          const formDataSummary: Record<string, any> = {};
          for (const [key, value] of entries) {
            if (value instanceof File) {
              formDataSummary[key] = {
                name: value.name,
                size: value.size,
                type: value.type,
                lastModified: value.lastModified,
              };
            } else {
              formDataSummary[key] = value;
            }
          }
          console.error('FormData being sent:', formDataSummary);
        } catch (e) {
          console.error('Could not log FormData details:', e);
        }
      }
    }

    // Return response with CORS headers
    return NextResponse.json(jsonData, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Proxy request failed', 
        detail: error.message || 'Unknown error occurred',
        type: error.name || 'Error',
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}

// Handle OPTIONS for CORS preflight
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

