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
    return await send_command(state, f"Z2PSBAS {req.value:02d}")


@router.post("/audio/treble")
async def z2_treble(req: Zone2ToneRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, f"Z2PSTRE {req.value:02d}")


@router.post("/audio/balance")
async def z2_balance(req: Zone2BalanceRequest, state: AppState = Depends(get_app_state)):
    left = 50 if req.value <= 50 else 100 - req.value
    right = 50 if req.value >= 50 else req.value
    if not state.telnet:
        raise HTTPException(503, "Not connected")
    await state.telnet.send(f"Z2CVFL {left:02d}")
    return await send_command(state, f"Z2CVFR {right:02d}")


@router.post("/audio/mono")
async def z2_mono(req: Zone2MonoRequest, state: AppState = Depends(get_app_state)):
    return await send_command(state, "Z2CSMONO" if req.enabled else "Z2CSST")


@router.post("/audio/{setting}/{direction}")
async def z2_audio_step(setting: str, direction: str, state: AppState = Depends(get_app_state)):
    prefixes = {"bass": "Z2PSBAS", "treble": "Z2PSTRE"}
    if setting not in prefixes or direction not in ("up", "down"):
        raise HTTPException(400, "Invalid Zone 2 audio setting")
    if setting in prefixes:
        return await send_command(state, f"{prefixes[setting]} {direction.upper()}")
    if not state.telnet:
        raise HTTPException(503, "Not connected")
    commands = ("Z2CVFL DOWN", "Z2CVFR UP") if direction == "up" else ("Z2CVFL UP", "Z2CVFR DOWN")
    for command in commands:
        if not await state.telnet.send(command):
            raise HTTPException(502, "Failed to send")
    return {"ok": True}

