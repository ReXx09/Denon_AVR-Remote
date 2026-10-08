"""HEOS media control endpoints."""
from __future__ import annotations

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, Field
import httpx

from api.models import RadioFavoriteRequest

from state import AppState, app_state
from dependencies import get_app_state
from denon.navidrome_client import NavidromeClient
from integration_settings import navidrome_settings, save_navidrome_settings

router = APIRouter(prefix="/api/v1/media", tags=["media"])


def _navidrome() -> NavidromeClient:
    configured = navidrome_settings()
    return NavidromeClient(
        configured["url"],
        configured["username"],
        configured["password"],
    )


@router.get("/navidrome/status")
async def navidrome_status():
    client = _navidrome()
    return {"configured": client.configured, "url": client.base_url if client.configured else None}


class NavidromeSettingsRequest(BaseModel):
    url: str = Field(default="", max_length=500)
    username: str = Field(default="", max_length=200)
    password: str | None = Field(default=None, max_length=500)


@router.get("/navidrome/settings")
async def navidrome_settings_view():
    configured = navidrome_settings()
    return {
        "url": configured["url"],
        "username": configured["username"],
        "has_password": bool(configured["password"]),
    }


@router.post("/navidrome/settings")
async def navidrome_settings_update(req: NavidromeSettingsRequest):
    if req.url and not req.url.startswith(("http://", "https://")):
        raise HTTPException(400, "Navidrome URL must start with http:// or https://")
    save_navidrome_settings(req.url, req.username, req.password)
    client = _navidrome()
    return {"ok": True, "configured": client.configured, "restart_required": False}


@router.post("/navidrome/test")
async def navidrome_test():
    try:
        await _navidrome().indexes()
        return {"ok": True}
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Navidrome is unreachable") from exc


@router.get("/navidrome/indexes")
async def navidrome_indexes():
    try:
        return await _navidrome().indexes()
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Navidrome is unreachable") from exc


@router.get("/navidrome/album/{album_id}")
async def navidrome_album(album_id: str):
    if not album_id or len(album_id) > 200 or any(char in album_id for char in "\r\n/?&"):
        raise HTTPException(400, "Invalid album ID")
    try:
        return await _navidrome().album(album_id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Navidrome is unreachable") from exc


@router.get("/navidrome/artist/{artist_id}")
async def navidrome_artist(artist_id: str):
    if not artist_id or len(artist_id) > 200 or any(char in artist_id for char in "\r\n/?&"):
        raise HTTPException(400, "Invalid artist ID")
    try:
        return await _navidrome().artist(artist_id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Navidrome is unreachable") from exc


class NavidromePlayRequest(BaseModel):
    song_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[^\r\n/?&]+$")


@router.post("/navidrome/play")
async def navidrome_play(req: NavidromePlayRequest, state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    client = _navidrome()
    if not client.configured:
        raise HTTPException(503, "Navidrome is not configured")
    ok = await state.heos.play_stream(1024, client.stream_url(req.song_id))
    if not ok:
        raise HTTPException(502, "Failed to start Navidrome stream")
    return {"ok": True}


@router.get("/navidrome/cover/{cover_id}")
async def navidrome_cover(cover_id: str):
    if not cover_id or len(cover_id) > 200 or any(char in cover_id for char in "\r\n/?&"):
        raise HTTPException(400, "Invalid cover ID")
    try:
        content, media_type = await _navidrome().cover(cover_id)
        return Response(content=content, media_type=media_type)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Navidrome is unreachable") from exc


async def _sync_play_state(state: AppState) -> None:
    """Refresh HEOS playback state immediately after a transport command."""
    if not state.heos:
        return
    play_state = await state.heos.get_play_state()
    if play_state:
        state.media_state["play_state"] = play_state
        await state.broadcast_state()


@router.post("/play")
async def media_play(state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.play()
    if not ok:
        raise HTTPException(502, "Play command failed")
    await _sync_play_state(state)
    return {"ok": True}


@router.post("/pause")
async def media_pause(state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.pause()
    if not ok:
        raise HTTPException(502, "Pause command failed")
    await _sync_play_state(state)
    return {"ok": True}


@router.post("/stop")
async def media_stop(state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.stop()
    if not ok:
        raise HTTPException(502, "Stop command failed")
    return {"ok": True}


@router.post("/next")
async def media_next(state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.next_track()
    if not ok:
        raise HTTPException(502, "Next command failed")
    return {"ok": True}


@router.post("/previous")
async def media_previous(state: AppState = Depends(get_app_state)):
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.previous_track()
    if not ok:
        raise HTTPException(502, "Previous command failed")
    return {"ok": True}


@router.get("/now-playing")
async def media_now_playing(state: AppState = Depends(get_app_state)):
    """Return cached now-playing info (updated by background poller)."""
    return state.media_state


@router.get("/queue")
async def media_queue(state: AppState = Depends(get_app_state)):
    """Return the current HEOS playback queue."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    queue = await state.heos.get_queue()
    return {"queue": queue, "total": len(queue)}


# ── Radio Browser ─────────────────────────────────────────────────────────────

import asyncio
import logging
import time

_LOGGER = logging.getLogger("radio")

TUNEIN_SID = 3
_BROWSE_CACHE: dict[str, tuple[float, dict]] = {}  # key → (timestamp, result)
_CACHE_TTL = 3600  # 1 hour
_MAX_CACHE_ITEMS = 500
_preload_done = False
_cached_station_count = 0


async def _cache_browse(state: AppState, cid: str | None = None) -> dict:
    """Browse and cache a single CID. Returns the result."""
    cache_key = cid or "__root__"
    now = time.monotonic()
    if cache_key in _BROWSE_CACHE:
        ts, cached = _BROWSE_CACHE[cache_key]
        if now - ts < _CACHE_TTL and cached.get("items"):
            return cached
    if not state.heos:
        return {"items": [], "count": 0, "returned": 0, "_debug": "no_heos"}
    try:
        result = await state.heos.browse_source(TUNEIN_SID, cid)
    except Exception as exc:
        _LOGGER.error("HEOS browse error for cid=%s: %s", cid, exc)
        return {"items": [], "count": 0, "returned": 0, "_debug": f"error_{exc}"}
    if result.get("items"):
        if len(_BROWSE_CACHE) >= _MAX_CACHE_ITEMS:
            oldest_key = min(_BROWSE_CACHE.keys(), key=lambda k: _BROWSE_CACHE[k][0])
            _BROWSE_CACHE.pop(oldest_key, None)
        _BROWSE_CACHE[cache_key] = (now, result)
    return result


async def preload_radio_stations() -> None:
    """Background task: preload Local Radio, Trending, and Music genres into cache."""
    global _preload_done
    if _preload_done:
        return
    try:
        await asyncio.sleep(10)  # wait for HEOS to be ready
        if not app_state.heos or not app_state.heos.connected:
            _LOGGER.info("Radio preload: HEOS not connected, skipping")
            return

        _LOGGER.info("Radio preload: starting...")
        t0 = time.time()
        total = 0

        top = await _cache_browse(app_state)
        if not top.get("items"):
            _LOGGER.warning("Radio preload: no top-level categories")
            return

        # Preload Local Radio + Trending (direct station lists)
        for cat_name in ("Local Radio", "Trending"):
            cat = next((i for i in top["items"] if cat_name in i.get("name", "")), None)
            if cat and cat.get("cid"):
                result = await _cache_browse(app_state, cat["cid"])
                n = len([i for i in result.get("items", []) if i.get("playable") == "yes"])
                total += n
                _LOGGER.info("Radio preload: %s → %d stations", cat_name, n)
                await asyncio.sleep(0.5)

        # Preload Music genre station lists
        music = next((i for i in top["items"] if i.get("name") == "Music"), None)
        if music and music.get("cid"):
            genres = await _cache_browse(app_state, music["cid"])
            for genre in genres.get("items", []):
                if genre.get("container") == "yes" and genre.get("cid"):
                    result = await _cache_browse(app_state, genre["cid"])
                    n = len([i for i in result.get("items", []) if i.get("playable") == "yes"])
                    total += n
                    await asyncio.sleep(0.3)

        _preload_done = True
        global _cached_station_count
        _cached_station_count = total
        _LOGGER.info("Radio preload: done — %d stations cached in %.1fs", total, time.time() - t0)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        _LOGGER.warning("Radio preload error: %s", exc)


@router.get("/radio/favorites")
async def radio_favorites(state: AppState = Depends(get_app_state)):
    return {"favorites": state.radio_favorites}


@router.get("/heos/favorites")
async def heos_favorites(state: AppState = Depends(get_app_state)):
    """Read presets saved on the receiver through the HEOS Favorites source."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    return await state.heos.browse_source(1028)


class HeosFavoritePlayRequest(BaseModel):
    sid: int = Field(..., ge=1, le=65535)
    mid: str = Field(..., min_length=1, max_length=500, pattern=r"^[^\r\n]+$")


@router.post("/heos/favorites/play")
async def play_heos_favorite(req: HeosFavoritePlayRequest, state: AppState = Depends(get_app_state)):
    """Play a receiver preset using the HEOS service ID returned by browse."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    if not await state.heos.play_stream(req.sid, req.mid):
        raise HTTPException(502, "Failed to play HEOS favorite")
    return {"ok": True}


@router.post("/radio/favorites")
async def add_radio_favorite(req: RadioFavoriteRequest, state: AppState = Depends(get_app_state)):
    favorite = req.model_dump()
    state.upsert_radio_favorite(favorite)
    return {"ok": True, "favorite": favorite, "favorites": state.radio_favorites}


@router.delete("/radio/favorites/{mid:path}")
async def delete_radio_favorite(mid: str, state: AppState = Depends(get_app_state)):
    state.remove_radio_favorite(mid)
    return {"ok": True, "favorites": state.radio_favorites}


@router.get("/radio/status")
async def radio_status(state: AppState = Depends(get_app_state)):
    """Diagnose whether internet radio (TuneIn) is usable.

    Drives the WebUI guidance panel. ``reason`` is one of:
      - ``ok``                 — TuneIn ready (or stations already cached)
      - ``no_heos``            — receiver's HEOS service unreachable
      - ``signed_out``         — no HEOS account signed in on the receiver
      - ``tunein_unavailable`` — signed in, but TuneIn not available yet
    """
    if not state.heos:
        return {
            "ready": False, "reason": "no_heos", "heos_connected": False,
            "account_signed_in": False, "username": None,
            "tunein_available": False, "cached_stations": _cached_station_count,
        }

    acct = await state.heos.check_account()
    signed_in = bool(acct.get("signed_in"))
    reachable = bool(acct.get("reachable"))
    tunein = await state.heos.is_source_available(TUNEIN_SID)

    # A populated cache means the UI works regardless of a transient probe.
    if _cached_station_count > 0:
        reason = "ok"
    elif not reachable:
        reason = "no_heos"
    elif not signed_in:
        reason = "signed_out"
    elif tunein is False:
        reason = "tunein_unavailable"
    elif tunein is None:
        reason = "no_heos"
    else:
        reason = "ok"

    return {
        "ready": reason == "ok",
        "reason": reason,
        "heos_connected": state.heos.connected,
        "account_signed_in": signed_in,
        "username": acct.get("username"),
        "tunein_available": bool(tunein),
        "cached_stations": _cached_station_count,
    }


@router.get("/radio/browse")
async def radio_browse(cid: str | None = None, state: AppState = Depends(get_app_state)):
    """Browse TuneIn radio directory. Omit cid for top-level categories."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    return await _cache_browse(state, cid)


@router.get("/radio/search")
async def radio_search(q: str = "", state: AppState = Depends(get_app_state)):
    """Search across all cached radio stations. Preload runs on startup."""
    global _cached_station_count
    query = q.strip().lower()
    if len(query) < 2:
        return {"results": [], "cached_stations": _cached_station_count}

    words = query.split()
    results = []
    seen = set()
    all_mids = set()

    for _key, (_, data) in _BROWSE_CACHE.items():
        for item in data.get("items", []):
            if item.get("playable") != "yes" or not item.get("mid"):
                continue
            all_mids.add(item["mid"])
            if item["mid"] in seen:
                continue
            name_lower = item.get("name", "").lower()
            if all(w in name_lower for w in words):
                results.append(item)
                seen.add(item["mid"])

    # Update cached count since we scanned anyway
    _cached_station_count = len(all_mids)

    return {"results": results, "cached_stations": _cached_station_count}


@router.post("/radio/refresh")
async def radio_refresh(state: AppState = Depends(get_app_state)):
    """Clear radio cache and re-preload stations in background."""
    global _preload_done
    _BROWSE_CACHE.clear()
    _preload_done = False
    asyncio.create_task(preload_radio_stations())
    return {"ok": True}


class RadioPlayRequest(BaseModel):
    mid: str = Field(..., min_length=1, max_length=500, pattern=r"^[^\r\n]+$",
                     description="Station media ID (e.g. 's280354')")


# HEOS local music / DLNA server source. Navidrome is exposed here when its
# DLNA service is enabled and visible to the receiver.
SERVER_SID = 1024


@router.get("/server/browse")
async def server_browse(cid: str | None = None, state: AppState = Depends(get_app_state)):
    """Browse the receiver's local music server, including Navidrome via DLNA."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    return await state.heos.browse_source(SERVER_SID, cid)


class ServerPlayRequest(BaseModel):
    mid: str = Field(..., min_length=1, max_length=500, pattern=r"^[^\r\n]+$")


@router.post("/server/play")
async def server_play(req: ServerPlayRequest, state: AppState = Depends(get_app_state)):
    """Start a track from the receiver's local music server."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    ok = await state.heos.play_stream(SERVER_SID, req.mid)
    if not ok:
        raise HTTPException(502, "Failed to play server item")
    return {"ok": True}


@router.post("/radio/play")
async def radio_play(req: RadioPlayRequest, state: AppState = Depends(get_app_state)):
    """Play a TuneIn radio station by media ID."""
    if not state.heos:
        raise HTTPException(503, "HEOS not connected")
    # Play uses the main HEOS connection (same player session)
    ok = await state.heos.play_stream(TUNEIN_SID, req.mid)
    if not ok:
        raise HTTPException(502, "Failed to play station")
    return {"ok": True}

