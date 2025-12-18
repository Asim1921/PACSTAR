import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, ValidationError
from typing import List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

class Settings(BaseSettings):
    PROJECT_NAME: str = "PACSTAR Authentication Service"
    API_V1_PREFIX: str = "/api/v1"

    # --- MongoDB Configuration ---
    MONGODB_URI: str
    MONGODB_DB: str
    MONGODB_TLS: bool = False
    MONGODB_CA_FILE: str | None = None
    MONGODB_CLIENT_CERT_KEY: str | None = None

    # --- JWT Configuration ---
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # --- For Swagger UI ---
    ENV: str = "dev" 

    # --- Rate Limiting & Brute Force Protection ---
    RATE_LIMIT_REQUESTS: int = 100             # requests allowed in window
    RATE_LIMIT_WINDOW: int = 60                # seconds
    MAX_FAILED_LOGINS: int = 5                 # lock account after 5 failed attempts
    LOCKOUT_TIME_MINUTES: int = 15             # lockout period

    # --- Audit Log Collection ---
    AUDIT_LOG_COLLECTION: str = "audit_logs"
    ENABLE_AUDIT_LOGGING: bool = True

    # --- Master Admin Bootstrap ---
    MASTER_ADMIN_USERNAME: str
    MASTER_ADMIN_EMAIL: str
    MASTER_ADMIN_PASSWORD: str

    # --- Middleware / Security ---
    ALLOWED_HOSTS: List[str] = Field(default_factory=lambda: ["*"])
    ALLOW_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])
    @field_validator("ALLOWED_HOSTS", "ALLOW_ORIGINS", mode="before")
    def parse_list(cls, v):
        if isinstance(v, str):
            try:
                # Try JSON first (e.g. ["localhost","127.0.0.1"])
                return json.loads(v)
            except json.JSONDecodeError:
                # Fallback: comma/space separated (e.g. localhost,127.0.0.1)
                return [x.strip() for x in v.split(",") if x.strip()]
        return v
    SESSION_SECRET_KEY: str

    # --- HTTPS Server (Uvicorn/TLS) ---
    SSL_CERT_FILE: str | None = None
    SSL_KEY_FILE: str | None = None

    # --- Flag Server ---
    FLAG_SERVER_TOKEN: str | None = None
    FLAG_SERVER_CERT: str | None = None
    FLAG_SERVER_KEY: str | None = None

    # --- OpenStack Integration ---
    OPENSTACK_ENABLED: bool = False
    OPENSTACK_AUTH_URL: str | None = None
    OPENSTACK_USERNAME: str | None = None
    OPENSTACK_PASSWORD: str | None = None
    OPENSTACK_PROJECT_ID: str | None = None
    OPENSTACK_PROJECT_NAME: str | None = None
    OPENSTACK_USER_DOMAIN_NAME: str | None = "Default"
    OPENSTACK_PROJECT_DOMAIN_ID: str | None = "default"
    OPENSTACK_REGION_NAME: str | None = None
    OPENSTACK_INTERFACE: str | None = "public"
    OPENSTACK_IDENTITY_API_VERSION: str | None = "3"
    OPENSTACK_VERIFY_SSL: bool = True
    OPENSTACK_DEFAULT_FLAVOR_ID: str | None = None
    OPENSTACK_DEFAULT_NETWORK_ID: str | None = None
    OPENSTACK_DEFAULT_SECURITY_GROUP_IDS: List[str] = Field(default_factory=list)
    OPENSTACK_TEAM_NETWORK_CIDR_TEMPLATE: str | None = "10.250.{index}.0/24"

    # ✅ Pydantic v2 config
    model_config = {
        "env_file": os.path.join(BASE_DIR, ".env"),
        "case_sensitive": True,
    }

    # ✅ Validators for required fields
    @field_validator(
        "MONGODB_URI",
        "MONGODB_DB",
        "JWT_SECRET_KEY",
        "JWT_REFRESH_SECRET_KEY",
        "MASTER_ADMIN_USERNAME",
        "MASTER_ADMIN_EMAIL",
        "MASTER_ADMIN_PASSWORD",
        "SESSION_SECRET_KEY",
    )
    @classmethod
    def must_not_be_empty(cls, v: str, field):
        if not v or str(v).strip() == "":
            raise ValueError(f"{field.name} must be set in environment")
        return v


try:
    settings = Settings()  # type: ignore[var-annotated]
except ValidationError as e:
    raise RuntimeError(f"Configuration validation error: {e}")
