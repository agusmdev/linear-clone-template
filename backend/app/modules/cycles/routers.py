"""Cycles router: cycles of a team (list, create), get, update, delete, complete."""

import uuid

from fastapi import APIRouter, Body, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.cycles.dependencies import get_cycle_service
from app.modules.cycles.schemas import (
    CycleCompleteRequest,
    CycleCompleteResponse,
    CycleCreate,
    CycleResponse,
    CycleUpdate,
)
from app.modules.cycles.service import CycleService
from app.user.auth import require_current_user_id

cycles_router = APIRouter(
    tags=["cycles"],
    dependencies=[Depends(require_current_user_id)],
)


@cycles_router.get(
    "/teams/{team_id}/cycles",
    response_description="List the cycles of a team, by start date",
    status_code=status.HTTP_200_OK,
)
async def list_cycles(
    team_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> list[CycleResponse]:
    log_action("list")
    log_entity("team", team_id)
    result = await cycle_service.list_cycles(team_id, user_id=user_id)
    return [CycleResponse.model_validate(c) for c in result]


@cycles_router.post(
    "/teams/{team_id}/cycles",
    response_description="Create a cycle in a team",
    status_code=status.HTTP_201_CREATED,
)
async def create_cycle(
    team_id: uuid.UUID,
    cycle: CycleCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> CycleResponse:
    log_action("create")
    log_entity("team", team_id)
    result = await cycle_service.create_cycle(team_id, cycle, user_id=user_id)
    return CycleResponse.model_validate(result)


@cycles_router.get(
    "/cycles/{cycle_id}",
    response_description="Get a cycle",
    status_code=status.HTTP_200_OK,
)
async def get_cycle(
    cycle_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> CycleResponse:
    log_action("get")
    result = await cycle_service.get_cycle(cycle_id, user_id=user_id)
    return CycleResponse.model_validate(result)


@cycles_router.patch(
    "/cycles/{cycle_id}",
    response_description="Update a cycle",
    status_code=status.HTTP_200_OK,
)
async def update_cycle(
    cycle_id: uuid.UUID,
    cycle: CycleUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> CycleResponse:
    log_action("update")
    result = await cycle_service.update_cycle(cycle_id, cycle, user_id=user_id)
    return CycleResponse.model_validate(result)


@cycles_router.delete(
    "/cycles/{cycle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a cycle (its issues stay, without a cycle)",
)
async def delete_cycle(
    cycle_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> None:
    log_action("delete")
    await cycle_service.delete_cycle(cycle_id, user_id=user_id)


@cycles_router.post(
    "/cycles/{cycle_id}/complete",
    response_description="Move the unfinished issues to the next cycle",
    status_code=status.HTTP_200_OK,
)
async def complete_cycle(
    cycle_id: uuid.UUID,
    body: CycleCompleteRequest = Body(default_factory=CycleCompleteRequest),
    user_id: uuid.UUID = Depends(require_current_user_id),
    cycle_service: CycleService = Depends(get_cycle_service),
) -> CycleCompleteResponse:
    log_action("complete")
    result = await cycle_service.complete_cycle(
        cycle_id, body.target_cycle_id, user_id=user_id
    )
    return CycleCompleteResponse.model_validate(result)
