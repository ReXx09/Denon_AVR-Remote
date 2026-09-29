"""Zone 3 control endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.models import SleepTimerRequest, SourceRequest, Zone3VolumeRequest
from dependencies import get_app_state
from routes._helpers import send_command
from state import AppState

router = APIRouter(prefix="/api/v1/zone3", tags=["zone3"])


@router.post("/power/on")
async def z3_power_on(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3ON")


@router.post("/power/off")
async def z3_power_off(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3OFF")


@router.post("/volume")
async def z3_volume(req: Zone3VolumeRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z3{req.level:02d}")


@router.post("/volume/up")
async def z3_volume_up(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3UP")


@router.post("/volume/down")
async def z3_volume_down(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3DOWN")


@router.post("/mute/on")
async def z3_mute_on(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3MUON")


@router.post("/mute/off")
async def z3_mute_off(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z3MUOFF")


@router.post("/source")
async def z3_source(req: SourceRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z3{req.source}")


@router.post("/sleep")
async def z3_sleep(req: SleepTimerRequest, state: AppState = Depends(get_app_state)):
    if req.minutes is None or req.minutes == 0:
        return await send_command(state, "Z3SLPOFF")
    return await send_command(state, f"Z3SLP{req.minutes:03d}")