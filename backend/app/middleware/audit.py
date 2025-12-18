from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from datetime import datetime
import motor.motor_asyncio

from app.core.config import settings
from app.core.logging import audit_logger


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all requests for auditing.
    - Logs method, path, user (if available), and timestamp
    - Stores audit logs in MongoDB
    """

    def __init__(self, app):
        super().__init__(app)
        # Build TLS args if enabled
        tls_args = {}
        mongodb_tls = getattr(settings, "MONGODB_TLS", False)
        # Handle string values from environment variables
        if isinstance(mongodb_tls, str):
            mongodb_tls = mongodb_tls.lower() in ('true', '1', 'yes', 'on')
        
        if mongodb_tls:
            tls_args = {
                "tls": True,
            }
            if settings.MONGODB_CA_FILE:
                tls_args["tlsCAFile"] = settings.MONGODB_CA_FILE
            if settings.MONGODB_CLIENT_CERT_KEY:
                tls_args["tlsCertificateKeyFile"] = settings.MONGODB_CLIENT_CERT_KEY
        
        self.client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI, **tls_args)
        self.db = self.client[settings.MONGODB_DB]

    async def dispatch(self, request: Request, call_next):
        # ✅ Public paths that do not require user context
        public_paths = [
            f"{settings.API_V1_PREFIX}/auth",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico",
        ]

        response = await call_next(request)

        user = getattr(request.state, "user", None)
        username = getattr(user, "username", "anonymous")

        log_entry = {
            "timestamp": datetime.utcnow(),
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "user": username,
            "ip": request.client.host if request.client else "unknown",
        }

        # ✅ If path is public, always log as anonymous
        if any(request.url.path.startswith(path) for path in public_paths):
            log_entry["user"] = "anonymous"
            username = "anonymous"

        # Log to stdout/file
        audit_logger.info(
            f"user={username} method={request.method} path={request.url.path} "
            f"status={response.status_code} ip={request.client.host if request.client else 'unknown'}"
        )

        # Log to MongoDB (if enabled)
        if settings.ENABLE_AUDIT_LOGGING:
            await self.db[settings.AUDIT_LOG_COLLECTION].insert_one(log_entry)

        return response
