from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

logger = logging.getLogger("pacstar")


def register_exception_handlers(app):
    """Register global exception handlers for secure error responses."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(f"HTTP {exc.status_code} at {request.url}: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": "Request could not be completed."},
        )

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(f"Starlette HTTP {exc.status_code} at {request.url}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": "Unexpected request error."},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error at {request.url}: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid request data."},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error at {request.url}: {str(exc)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error."},
        )
