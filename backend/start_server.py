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
    # Set environment variables for TEST server (force overrides so .env doesn't accidentally point to prod DB)
    os.environ["MONGODB_URI"] = os.environ.get("MONGODB_URI") or "mongodb://localhost:27017"
    os.environ["MONGODB_DB"] = "pacstar_test"
    os.environ["MONGODB_TLS"] = os.environ.get("MONGODB_TLS") or "False"
    os.environ["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY") or "test-jwt-secret-key-for-development"
    os.environ["JWT_REFRESH_SECRET_KEY"] = os.environ.get("JWT_REFRESH_SECRET_KEY") or "test-jwt-refresh-secret-key-for-development"
    os.environ["MASTER_ADMIN_USERNAME"] = os.environ.get("MASTER_ADMIN_USERNAME") or "master_admin"
    os.environ["MASTER_ADMIN_EMAIL"] = os.environ.get("MASTER_ADMIN_EMAIL") or "admin@pacstar.com"
    os.environ["MASTER_ADMIN_PASSWORD"] = os.environ.get("MASTER_ADMIN_PASSWORD") or "admin123"
    os.environ["SESSION_SECRET_KEY"] = os.environ.get("SESSION_SECRET_KEY") or "test-session-secret-key-for-development"
    os.environ["ENV"] = os.environ.get("ENV") or "dev"
    os.environ["ALLOWED_HOSTS"] = os.environ.get("ALLOWED_HOSTS") or '["*"]'
    os.environ["ALLOW_ORIGINS"] = os.environ.get("ALLOW_ORIGINS") or '["*"]'
    
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
