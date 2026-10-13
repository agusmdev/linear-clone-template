"""Module for including all the app's routers"""

from fastapi import APIRouter

from app.modules.issues.routers import issues_router
from app.modules.items.routers import items_router
from app.modules.labels.routers import labels_router
from app.modules.notifications.routers import notifications_router
from app.modules.teams.routers import teams_router
from app.modules.workspaces.routers import workspaces_router
from app.user.auth.routers import auth_router
from app.user.routers import user_router


def get_app_router() -> APIRouter:
    router = APIRouter()

    router.include_router(
        auth_router,
        prefix="/auth",
        tags=["auth"],
    )

    router.include_router(
        user_router,
        prefix="/users",
        tags=["users"],
    )

    router.include_router(items_router)
    router.include_router(workspaces_router)
    router.include_router(teams_router)
    router.include_router(labels_router)
    router.include_router(issues_router)
    router.include_router(notifications_router)

    return router
