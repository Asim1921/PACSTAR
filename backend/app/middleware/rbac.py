from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException, status
from jose import jwt, JWTError
from bson import ObjectId

from app.core.config import settings
from app.db.models.user import UserInDB
from app.core.logging import audit_logger
import motor.motor_asyncio


class RBACMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces role-based access control (RBAC).
    - Extracts JWT from Authorization header
    - Validates and decodes token
    - Fetches user from MongoDB by ID
    - Attaches user to request.state
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
        # --- Public endpoints ---
        public_paths = [
            f"{settings.API_V1_PREFIX}/auth/register",
            f"{settings.API_V1_PREFIX}/auth/login",
            f"{settings.API_V1_PREFIX}/auth/logout",
            f"{settings.API_V1_PREFIX}/files/serve",  # Public file serving for static challenges
            "/health",
            "/docs",
            "/redoc", 
            "/openapi.json",
            f"{settings.API_V1_PREFIX}/docs",
            f"{settings.API_V1_PREFIX}/openapi.json",
            "/favicon.ico"  # Browser favicon requests
        ]

        # Skip RBAC if path starts with or matches a public path
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)

        # --- Auth required ---
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header",
            )

        token = auth_header.split(" ")[1]

        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        except JWTError:
            raise HTTPException(status_code=401, detail="Token verification failed")

        # --- Fetch user ---
        user_doc = await self.db["users"].find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")

        user_doc["_id"] = str(user_doc["_id"])
        if "last_login" in user_doc and user_doc["last_login"] is not None:
            user_doc["last_login"] = str(user_doc["last_login"])

        request.state.user = UserInDB.model_validate(user_doc)

        audit_logger.info(
            f"RBAC check passed for user={request.state.user.username}, "
            f"role={request.state.user.role}, path={request.url.path}"
        )

        return await call_next(request)
