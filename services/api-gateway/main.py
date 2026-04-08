from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import claims, users, admin, analytics, copilot

app = FastAPI(
    title="FinSight IFOS API",
    description="Intelligent Financial Oversight System — Ignite S3-IFOS Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router,     prefix="/users",     tags=["Users"])
app.include_router(claims.router,    prefix="/claims",    tags=["Claims"])
app.include_router(admin.router,     prefix="/admin",     tags=["Admin"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(copilot.router,   prefix="/copilot",   tags=["AI Copilot"])


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "FinSight IFOS API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
