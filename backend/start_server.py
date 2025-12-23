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

    # Load SSL config from either:
    # - real environment variables (exported)
    # - backend/.env via app.core.config.settings
    # - fallback default certs in ~/certs
    #
    # Note: Frontend uses SSL_CRT_FILE sometimes; accept that alias too.
    try:
        from app.core.config import settings  # reads backend/.env
    except Exception:
        settings = None
    
    default_cert = Path.home() / "certs" / "192.168.15.248+2.pem"
    default_key = Path.home() / "certs" / "192.168.15.248+2-key.pem"

    env_cert = os.environ.get("SSL_CERT_FILE") or os.environ.get("SSL_CRT_FILE")
    env_key = os.environ.get("SSL_KEY_FILE")

    cfg_cert = getattr(settings, "SSL_CERT_FILE", None) if settings else None
    cfg_key = getattr(settings, "SSL_KEY_FILE", None) if settings else None

    ssl_certfile = env_cert or cfg_cert or (str(default_cert) if default_cert.exists() else None)
    ssl_keyfile = env_key or cfg_key or (str(default_key) if default_key.exists() else None)

    # Validate paths; if only one exists, disable SSL and print guidance.
    cert_ok = bool(ssl_certfile and Path(ssl_certfile).exists())
    key_ok = bool(ssl_keyfile and Path(ssl_keyfile).exists())

    if not (cert_ok and key_ok):
        if ssl_certfile or ssl_keyfile:
            print("⚠️  SSL configured but cert/key files were not found:")
            print(f"   SSL_CERT_FILE={ssl_certfile} (exists={cert_ok})")
            print(f"   SSL_KEY_FILE={ssl_keyfile} (exists={key_ok})")
        else:
            print("ℹ️  SSL not configured (no cert/key found). Starting in HTTP mode.")
        ssl_certfile = None
        ssl_keyfile = None

    scheme = "https" if (ssl_certfile and ssl_keyfile) else "http"
    print(f"🌐 Server will be available at: {scheme}://localhost:8000")
    print(f"📚 API Documentation: {scheme}://localhost:8000/api/v1/docs")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile,
    )
