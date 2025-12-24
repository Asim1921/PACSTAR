from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
import asyncio
from datetime import datetime, timezone

from app.core.config import settings
from app.middleware.error_handler import register_exception_handlers
from app.middleware.audit import AuditMiddleware
from app.middleware.rbac import RBACMiddleware
from app.api.v1.endpoints import auth, user, role, challenge, team, files
from app.api.v1.endpoints import builder
from app.api.v1.endpoints import openstack as openstack_routes
from app.api.v1.endpoints import event as event_routes
from app.api.v1.endpoints import flag_server as flag_server_routes
from app.api.v1.endpoints import maintenance as maintenance_routes
from app.db.models.challenge import initialize_challenge_models
from app.services.event_service import EventService
from app.schemas.event import EventStatus

# --- FastAPI Application Setup ---
# Disable docs in production for security
if settings.ENV == "prod":
    docs_url = None
    redoc_url = None
    openapi_url = None
else:
    docs_url = f"{settings.API_V1_PREFIX}/docs"
    redoc_url = f"{settings.API_V1_PREFIX}/redoc"
    openapi_url = f"{settings.API_V1_PREFIX}/openapi.json"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Production-grade FastAPI authentication system with RBAC and MongoDB backend.",
    openapi_url=openapi_url,
    docs_url=docs_url,
    redoc_url=redoc_url,
)

# --- Security: Trusted Host ---
if hasattr(settings, "ALLOWED_HOSTS") and settings.ALLOWED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )

# --- Security: CORS ---
if hasattr(settings, "ALLOW_ORIGINS") and settings.ALLOW_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

# --- Security: Session / CSRF ---
if hasattr(settings, "SESSION_SECRET_KEY") and settings.SESSION_SECRET_KEY:
    app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)

# --- Custom Middlewares ---
app.add_middleware(AuditMiddleware)
app.add_middleware(RBACMiddleware)

# --- Error Handlers ---
register_exception_handlers(app)

# --- Routers ---
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(user.router, prefix=settings.API_V1_PREFIX)
app.include_router(role.router, prefix=settings.API_V1_PREFIX)
app.include_router(challenge.router, prefix=settings.API_V1_PREFIX)
app.include_router(team.router, prefix=settings.API_V1_PREFIX)
app.include_router(files.router, prefix=f"{settings.API_V1_PREFIX}/files")
app.include_router(builder.router, prefix=f"{settings.API_V1_PREFIX}/builder")
app.include_router(openstack_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(event_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(flag_server_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(maintenance_routes.router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
async def startup_event():
    """Initialize challenge models on startup and start background tasks"""
    await initialize_challenge_models()
    # Start background task for automatic event start
    # Use create_task to run in background without blocking
    task = asyncio.create_task(check_and_start_events())
    # Store task reference to prevent garbage collection
    app.state.event_check_task = task


async def check_and_start_events():
    """Background task to check for scheduled events that should start"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        event_service = EventService()
        logger.info("🚀 Event auto-start background task started")
    except Exception as e:
        logger.error(f"❌ Failed to initialize EventService in background task: {e}", exc_info=True)
        return
    
    while True:
        try:
            # Get current time in Pakistan timezone (UTC+5)
            # Pakistan timezone: Asia/Karachi (UTC+5)
            from datetime import timezone, timedelta
            pakistan_tz = timezone(timedelta(hours=5))
            now_pakistan = datetime.now(pakistan_tz)
            now_utc = datetime.utcnow()
            
            # Find all scheduled events that should start
            scheduled_events = await event_service.events.find({
                "status": EventStatus.SCHEDULED.value
            }).to_list(length=100)
            
            # Find all running events that should end
            running_events = await event_service.events.find({
                "status": {"$in": [EventStatus.RUNNING.value, EventStatus.PAUSED.value]}
            }).to_list(length=100)
            
            if scheduled_events:
                logger.debug(f"Found {len(scheduled_events)} scheduled events to check")
            if running_events:
                logger.debug(f"Found {len(running_events)} running/paused events to check for end time")
            
            # Check scheduled events for auto-start
            for event in scheduled_events:
                try:
                    event_id = str(event["_id"])
                    event_name = event.get("name", "Unknown")
                    start_time = event.get("start_time")
                    
                    # Handle timezone-aware or naive datetime
                    if isinstance(start_time, datetime):
                        # Event start_time is stored in UTC in database
                        # Convert to Pakistan timezone for comparison
                        if start_time.tzinfo:
                            start_time_utc = start_time.astimezone(timezone.utc).replace(tzinfo=None)
                        else:
                            # Assume naive datetime is UTC
                            start_time_utc = start_time
                        
                        # Convert UTC start_time to Pakistan timezone
                        start_time_pakistan = start_time_utc.replace(tzinfo=timezone.utc).astimezone(pakistan_tz)
                        
                        # Compare Pakistan times
                        if start_time_pakistan <= now_pakistan:
                            logger.info(f"⏰ Event '{event_name}' (ID: {event_id}) start time reached (Pakistan: {start_time_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')} <= {now_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')}). Starting...")
                            
                            # Start the event
                            result = await event_service.events.update_one(
                                {"_id": event["_id"]},
                                {
                                    "$set": {
                                        "status": EventStatus.RUNNING.value,
                                        "updated_at": datetime.utcnow()
                                    }
                                }
                            )
                            
                            if result.modified_count > 0:
                                # Get updated event for notification
                                updated_event = await event_service.events.find_one({"_id": event["_id"]})
                                
                                # Notify teams
                                try:
                                    await event_service._notify_teams_event_started(updated_event)
                                except Exception as notify_error:
                                    logger.error(f"⚠️ Failed to send notifications for event {event_id}: {notify_error}")
                                
                                logger.info(f"✅ Auto-started event: {event_name} (ID: {event_id})")
                            else:
                                logger.warning(f"⚠️ Failed to update event {event_id} status (no documents modified)")
                        else:
                            time_diff = (start_time_pakistan - now_pakistan).total_seconds()
                            if time_diff < 60:  # Log if starting within 1 minute
                                logger.info(f"⏳ Event '{event_name}' starts in {time_diff:.0f} seconds (Pakistan time)")
                    else:
                        logger.warning(f"⚠️ Event '{event_name}' (ID: {event_id}) has invalid start_time type: {type(start_time)}, value: {start_time}")
                        
                except Exception as e:
                    logger.error(f"❌ Failed to auto-start event {event.get('_id', 'unknown')}: {e}", exc_info=True)
            
            # Check running/paused events for auto-end
            for event in running_events:
                try:
                    event_id = str(event["_id"])
                    event_name = event.get("name", "Unknown")
                    end_time = event.get("end_time")
                    
                    # Handle timezone-aware or naive datetime
                    if isinstance(end_time, datetime):
                        # Event end_time is stored in UTC in database
                        if end_time.tzinfo:
                            end_time_utc = end_time.astimezone(timezone.utc).replace(tzinfo=None)
                        else:
                            # Assume naive datetime is UTC
                            end_time_utc = end_time
                        
                        # Convert UTC end_time to Pakistan timezone for comparison
                        end_time_pakistan = end_time_utc.replace(tzinfo=timezone.utc).astimezone(pakistan_tz)
                        
                        # Check if end time has passed
                        if end_time_pakistan <= now_pakistan:
                            logger.info(f"⏰ Event '{event_name}' (ID: {event_id}) end time reached (Pakistan: {end_time_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')} <= {now_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')}). Ending...")

                            # Use service-layer end_event so cleanup runs (stop/delete challenge instances)
                            try:
                                await event_service.end_event(
                                    event_id=event_id,
                                    user_role="Master",
                                    user_zone=event.get("zone", "unknown"),
                                )
                                logger.info(f"✅ Auto-ended event: {event_name} (ID: {event_id})")
                            except Exception as end_err:
                                logger.error(f"⚠️ Failed to auto-end event {event_id}: {end_err}", exc_info=True)
                        else:
                            time_diff = (end_time_pakistan - now_pakistan).total_seconds()
                            if time_diff < 300:  # Log if ending within 5 minutes
                                logger.info(f"⏳ Event '{event_name}' ends in {time_diff/60:.1f} minutes (Pakistan time)")
                    else:
                        logger.warning(f"⚠️ Event '{event_name}' (ID: {event_id}) has invalid end_time type: {type(end_time)}, value: {end_time}")
                        
                except Exception as e:
                    logger.error(f"❌ Failed to auto-end event {event.get('_id', 'unknown')}: {e}", exc_info=True)
            
            # Wait 30 seconds before checking again
            await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"❌ Error in event auto-start background task: {e}", exc_info=True)
            await asyncio.sleep(60)  # Wait longer on error


@app.get("/health", tags=["system"])
async def health_check():
    """Simple health check endpoint for monitoring."""
    return {"status": "ok"}


@app.middleware("http")
async def secure_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    # More permissive CSP for Swagger UI in development
    if settings.ENV == "dev":
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "font-src 'self' https://cdn.jsdelivr.net;"
        )
    else:
        # Strict CSP for production
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'"
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
