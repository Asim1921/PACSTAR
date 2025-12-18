#!/usr/bin/env python3
"""
Start the FastAPI server for testing
"""

import uvicorn
import os
import sys
from pathlib import Path

# Add the current directory to Python path
sys.path.append(str(Path(__file__).parent))

if __name__ == "__main__":
    # Set environment variables for testing
    os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
    os.environ.setdefault("MONGODB_DB", "pacstar_test")
    os.environ.setdefault("MONGODB_TLS", "False")
    os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-for-development")
    os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-jwt-refresh-secret-key-for-development")
    os.environ.setdefault("MASTER_ADMIN_USERNAME", "master_admin")
    os.environ.setdefault("MASTER_ADMIN_EMAIL", "admin@pacstar.com")
    os.environ.setdefault("MASTER_ADMIN_PASSWORD", "admin123")
    os.environ.setdefault("SESSION_SECRET_KEY", "test-session-secret-key-for-development")
    os.environ.setdefault("ENV", "dev")
    os.environ.setdefault("ALLOWED_HOSTS", '["*"]')
    os.environ.setdefault("ALLOW_ORIGINS", '["*"]')
    
    print("🚀 Starting PACSTAR Challenge Management Server")
    print("📋 Environment: Development")
    print("🌐 Server will be available at: http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/api/v1/docs")
    print("=" * 60)
    
    ssl_certfile = os.environ.get("SSL_CERT_FILE") or None
    ssl_keyfile = os.environ.get("SSL_KEY_FILE") or None

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile,
    )
