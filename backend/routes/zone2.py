"""Zone 2 control endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.models import SourceRequest, Zone2BalanceRequest, Zone2MonoRequest, Zone2ToneRequest, Zone2VolumeRequest
from routes._helpers import send_command
from state import AppState
from dependencies import get_app_state

router = APIRouter(prefix="/api/v1/zone2", tags=["zone2"])


@router.post("/power/on")
async def z2_power_on(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2ON")


@router.post("/power/off")
async def z2_power_off(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2OFF")


@router.post("/volume")
async def z2_volume(req: Zone2VolumeRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2{req.level:02d}")


@router.post("/volume/up")
async def z2_volume_up(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2UP")


@router.post("/volume/down")
async def z2_volume_down(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2DOWN")


@router.post("/mute/on")
async def z2_mute_on(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2MUON")


@router.post("/mute/off")
async def z2_mute_off(state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2MUOFF")


@router.post("/source")
async def z2_source(req: SourceRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2{req.source}")


@router.post("/audio/bass")
async def z2_bass(req: Zone2ToneRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2BAS {req.value}")


@router.post("/audio/treble")
async def z2_treble(req: Zone2ToneRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2TRE {req.value}")


@router.post("/audio/balance")
async def z2_balance(req: Zone2BalanceRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2BAL {req.value}")


@router.post("/audio/mono")
async def z2_mono(req: Zone2MonoRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2MONO {'ON' if req.enabled else 'OFF'}")


@router.post("/audio/{setting}/{direction}")
async def z2_audio_step(setting: str, direction: str, state: AppState = Depends(get_app_state)):
    prefixes = {"bass": "Z2BAS", "treble": "Z2TRE", "balance": "Z2BAL"}
    if setting not in prefixes or direction not in ("up", "down"):
        raise HTTPException(400, "Invalid Zone 2 audio setting")
    return await send_command(state, f"{prefixes[setting]} {direction.upper()}")

