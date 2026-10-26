"""
IntelliAPI AI - FastAPI application entrypoint.

Run from the backend/ directory:
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import router
from app.config import settings
from app.services.model_loader import load_model

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("intelliapi")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load the trained model artifacts.
    try:
        bundle = load_model()
        logger.info("IntelliAPI AI started (v%s). Primary model: %s accuracy=%.4f",
                    __version__, bundle.primary_model_name, bundle.accuracy)
    except Exception as e:
        logger.error("Failed to load model on startup: %s", e)
        logger.error("Run the training pipeline first:  python -m training.train")
        # Continue starting so /health can report model_not_loaded.
    yield
    # Shutdown: nothing to clean up.


app = FastAPI(
    title="IntelliAPI AI",
    description=(
        "An intelligent agent for real-time API threat detection and explainable "
        "security decisions. Analyzes HTTP/API request representations with a "
        "trained machine-learning model and selects ALLOW / MONITOR / BLOCK."
    ),
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "IntelliAPI AI",
        "version": __version__,
        "docs": "/docs",
        "endpoints": ["/health", "/model-info", "/analyze", "/events", "/stats", "/ws"],
    }
