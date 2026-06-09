import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.inventario import router as inventario_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

settings = get_settings()
setup_logging(level=settings.log_level)
logger = get_logger(__name__)

app = FastAPI(title="OTO — Observatório do Turismo de Olímpia")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "request_handled",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
        },
    )
    return response


app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(inventario_router, prefix="/api/v1", tags=["inventario"])


@app.get("/health")
def health():
    return {"status": "ok"}
