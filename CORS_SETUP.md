# CORS Configuration for Backend

## Problem
You're getting CORS errors when the frontend tries to access the backend API:
```
Access to XMLHttpRequest at 'http://192.168.250.178:8000/api/v1/...' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

## Solution
You need to configure CORS on your FastAPI backend to allow requests from the frontend.

### FastAPI Backend Configuration

Add the following to your FastAPI backend (`main.py` or wherever you initialize your app):

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.15.70:3000",  # Add your network IP if accessing from other devices
        # Add production domain when deploying
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Your existing routes...
```

### Alternative: Allow All Origins (Development Only)

⚠️ **Warning: Only use this for development!**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins - NOT RECOMMENDED FOR PRODUCTION
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Testing

After adding CORS middleware:
1. Restart your FastAPI backend server
2. Try accessing the frontend again
3. The CORS errors should be resolved

### Common Issues

1. **Still getting CORS errors after adding middleware:**
   - Make sure you restarted the backend server
   - Check that the middleware is added before your routes
   - Verify the origin URL matches exactly (including http/https and port)

2. **Preflight requests failing:**
   - Make sure `allow_methods` includes "OPTIONS"
   - Ensure `allow_headers` includes "Authorization" and "Content-Type"

3. **Credentials not working:**
   - Set `allow_credentials=True`
   - Don't use `allow_origins=["*"]` with credentials - specify exact origins

## Additional Resources

- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

