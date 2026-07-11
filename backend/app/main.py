import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.due_date_scheduler import run_due_date_check
from app.core.notifications import set_event_loop
from app.database import SessionLocal
from app.logging_config import configure_logging
from app.routers import activity, auth, dashboard, health, notifications, projects, search, tickets, users

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_event_loop(asyncio.get_running_loop())
    scheduler_task = asyncio.create_task(run_due_date_check(SessionLocal))
    yield
    scheduler_task.cancel()


app = FastAPI(title="PlanBoard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tickets.router)
app.include_router(activity.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(search.router)
