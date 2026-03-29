from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import settings
from app.utils.logging import get_logger
from app.routes import auth, admin, professional, users, screening, tasks, journal, resources, notifications, analysis
from app.database import Base, engine

# 🔥 IMPORTANT: Import all models so SQLAlchemy registers them
from app import models

logger = get_logger(__name__)

# -----------------------------
# Rate Limiter
# -----------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-assisted behavioral screening and support platform for ASD",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Request Logging Middleware
# -----------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    return response

# -----------------------------
# Global Exception Handler
# -----------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# -----------------------------
# Routers
# -----------------------------
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(professional.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(screening.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(journal.router, prefix="/api/v1")
app.include_router(resources.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")

# -----------------------------
# Startup Event
# -----------------------------
@app.on_event("startup")
def on_startup():
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Using DATABASE_URL: {settings.DATABASE_URL}")

    try:
        # Verify connection
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT @@hostname, @@port, DATABASE();")
            )
            db_info = result.fetchone()
            logger.info(f"Connected to MySQL Host: {db_info[0]}")
            logger.info(f"Connected to MySQL Port: {db_info[1]}")
            logger.info(f"Using Database: {db_info[2]}")

        # 🔥 Now tables WILL be created because models are imported
        Base.metadata.create_all(bind=engine)

        logger.info("Database tables created/verified successfully.")

    except Exception as e:
        logger.error("Database initialization failed!", exc_info=True)
        raise e

# -----------------------------
# Root Endpoints
# -----------------------------
@app.get("/")
def root():
    return {
        "message": "ASD Screening & Support Platform API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}