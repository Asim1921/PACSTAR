import logging
import sys
from app.core.config import settings


def setup_logging():
    """Configure application-wide logging."""
    log_format = (
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Reduce noise from dependencies
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("motor").setLevel(logging.WARNING)

    logger = logging.getLogger("pacstar")
    logger.info("Logging initialized.")
    return logger


# Audit logger (separate channel for security events)
audit_logger = logging.getLogger("audit")
audit_handler = logging.StreamHandler(sys.stdout)
audit_handler.setFormatter(
    logging.Formatter("%(asctime)s | AUDIT | %(message)s")
)
audit_logger.setLevel(logging.INFO)
audit_logger.addHandler(audit_handler)
audit_logger.propagate = False
