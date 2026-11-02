"""Opt-in API endpoints for third-party integrations."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies import get_app_state
from integration_settings import save_streamdeck_settings, streamdeck_settings
from state import AppState

router = APIRouter(prefix="/api/v1/integrations/streamdeck", tags=["integrations"])
_SOURCE_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9/_-]{0,19}$")


class StreamDeckSettingsRequest(BaseModel):
    audio_profiles: bool = False


def _require_audio_profiles() -> None:
    if not streamdeck_settings()["audio_profiles"]:
        raise HTTPException(403, "Stream Deck audio profile access is disabled")


@router.get("/settings")
async def get_streamdeck_settings():
    configured = streamdeck_settings()
    return {"audio_profiles_enabled": configured["audio_profiles"]}


@router.put("/settings")
async def update_streamdeck_settings(req: StreamDeckSettingsRequest):
    save_streamdeck_settings(req.audio_profiles)
    return {"ok": True, "audio_profiles_enabled": req.audio_profiles}


@router.get("/capabilities")
async def get_streamdeck_capabilities():
    enabled = streamdeck_settings()["audio_profiles"]
    return {
        "enabled": enabled,
        "features": ["audio_profiles"] if enabled else [],
    }


@router.get("/source-profiles")
async def export_source_profiles(state: AppState = Depends(get_app_state)):
    _require_audio_profiles()
    return {"profiles": state.source_profiles}


@router.post("/source-profiles/{source:path}/apply")
async def apply_exported_source_profile(source: str, state: AppState = Depends(get_app_state)):
    _require_audio_profiles()
    code = source.strip().upper()
    if not _SOURCE_CODE_RE.fullmatch(code):
        raise HTTPException(400, "Invalid source code")
    if code not in state.source_profiles:
        raise HTTPException(404, "No saved profile for this source")
    applied = await state.apply_source_profile(code)
    await state.broadcast_state(force=True)
    if not applied:
        raise HTTPException(502, "Input level could not be applied to the receiver")
    return {"ok": True, "source": code}
