"""Integration tests for API endpoints using FastAPI TestClient."""
from __future__ import annotations

import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Patch settings before importing app to prevent real connections
os.environ["DENON_DASHBOARD_DENON_HOST"] = ""
os.environ["DENON_DASHBOARD_LOG_LEVEL"] = "WARNING"


def _make_mock_telnet(state: dict):
    """Create a mock telnet client with the given state."""
    mock = MagicMock()
    mock.connected = True
    mock.host = "192.168.1.100"
    mock.state = state
    mock.send = AsyncMock(return_value=True)
    mock.refresh = AsyncMock()
    mock.disconnect = AsyncMock()
    return mock


def _make_mock_heos():
    """Create a mock HEOS client."""
    mock = MagicMock()
    mock.connected = True
    mock.play = AsyncMock(return_value=True)
    mock.pause = AsyncMock(return_value=True)
    mock.stop = AsyncMock(return_value=True)
    mock.next_track = AsyncMock(return_value=True)
    mock.previous_track = AsyncMock(return_value=True)
    mock.get_now_playing = AsyncMock(return_value={"song": "Test Song"})
    mock.get_play_state = AsyncMock(return_value="play")
    mock.get_queue = AsyncMock(return_value=[{"song": "Queued Song", "artist": "Test Artist", "qid": 1}])
    mock.check_account = AsyncMock(return_value={"signed_in": True, "username": "demo@heos", "reachable": True})
    mock.is_source_available = AsyncMock(return_value=True)
    mock.disconnect = AsyncMock()
    return mock


@pytest.fixture
def mock_app_state(mock_state):
    """Patch app_state with mock clients."""
    from state import app_state

    app_state.telnet = _make_mock_telnet(mock_state)
    app_state.heos = _make_mock_heos()
    app_state.source_name_cache = {"GAME": "Game Console"}
    app_state.speaker_calibration = {"FL": -1.5, "FR": -2.0}
    yield app_state
    app_state.telnet = None
    app_state.heos = None


@pytest.fixture
def mock_app_no_connection():
    """Patch app_state with no connection."""
    from state import app_state

    app_state.telnet = None
    app_state.heos = None
    yield app_state


# ── Health ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_connected(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["telnet_connected"] is True


@pytest.mark.asyncio
async def test_health_disconnected(mock_app_no_connection):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["telnet_connected"] is False


# ── Status ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_connected(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is True
    assert data["power"] is True
    assert data["volume"] == 50.0
    assert data["source"] == "GAME"
    assert data["source_name"] == "Game Console"


@pytest.mark.asyncio
async def test_status_not_initialized(mock_app_no_connection):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/status")
    assert resp.status_code == 200
    assert resp.json()["connected"] is False


# ── Power ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_power_on(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/power/on")
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("PWON")


@pytest.mark.asyncio
async def test_power_off(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/power/off")
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("PWSTANDBY")


# ── Volume ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_set_volume(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/volume", json={"level": 45.0})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("MV45")


@pytest.mark.asyncio
async def test_set_volume_half_step(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/volume", json={"level": 45.5})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("MV455")


@pytest.mark.asyncio
async def test_volume_up(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/volume/up")
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("MVUP")


# ── Source ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_set_source(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/source", json={"source": "TV"})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("SITV")


# ── Night Mode ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_night_mode_enable_absolute_and_offset(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/night-mode", json={
            "enabled": True,
            "channels": [
                {"channel": "SW", "mode": "absolute", "value": 38},
                {"channel": "FL", "mode": "offset", "value": -4},
            ],
        })
    assert resp.status_code == 200
    assert mock_app_state.night_mode_enabled is True
    assert mock_app_state.night_mode_snapshot["FL"] == 50
    mock_app_state.telnet.send.assert_any_call("CVSW 38")
    mock_app_state.telnet.send.assert_any_call("CVFL 46")


@pytest.mark.asyncio
async def test_night_mode_disable_restores_snapshot(mock_app_state):
    from main import app

    mock_app_state.night_mode_enabled = True
    mock_app_state.night_mode_snapshot = {"FL": 50, "SW": 52}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/night-mode", json={"enabled": False, "channels": []})
    assert resp.status_code == 200
    assert mock_app_state.night_mode_enabled is False
    assert mock_app_state.night_mode_snapshot == {}
    mock_app_state.telnet.send.assert_any_call("CVFL 50")
    mock_app_state.telnet.send.assert_any_call("CVSW 52")


# ── Media ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_media_play(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/media/play")
    assert resp.status_code == 200
    mock_app_state.heos.play.assert_called_once()


@pytest.mark.asyncio
async def test_media_now_playing(mock_app_state):
    from main import app

    # Pre-populate cached media state (normally filled by background poller)
    mock_app_state.media_state = {
        "now_playing": {"song": "Test Song"},
        "play_state": "play",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/media/now-playing")
    assert resp.status_code == 200
    data = resp.json()
    assert data["now_playing"]["song"] == "Test Song"
    assert data["play_state"] == "play"


@pytest.mark.asyncio
async def test_media_queue(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/media/queue")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["queue"][0]["song"] == "Queued Song"
    mock_app_state.heos.get_queue.assert_called_once()


# ── Radio status ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_radio_status_ok(mock_app_state):
    import routes.media as media
    from main import app

    media._cached_station_count = 0
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/media/radio/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ready"] is True
    assert data["reason"] == "ok"
    assert data["account_signed_in"] is True


@pytest.mark.asyncio
async def test_radio_status_signed_out(mock_app_state):
    import routes.media as media
    from main import app

    media._cached_station_count = 0
    mock_app_state.heos.check_account = AsyncMock(
        return_value={"signed_in": False, "username": None, "reachable": True})
    mock_app_state.heos.is_source_available = AsyncMock(return_value=False)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/media/radio/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ready"] is False
    assert data["reason"] == "signed_out"


@pytest.mark.asyncio
async def test_radio_status_no_heos(mock_app_no_connection):
    import routes.media as media
    from main import app

    media._cached_station_count = 0
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/media/radio/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ready"] is False
    assert data["reason"] == "no_heos"


# ── Zone 2 ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_z2_power_on(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/zone2/power/on")
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("Z2ON")


@pytest.mark.asyncio
async def test_z3_volume(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/zone3/volume", json={"level": 42})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("Z342")


@pytest.mark.asyncio
async def test_dialog_level(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/dialog", json={"level": 6})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("PSDIL 06")


@pytest.mark.asyncio
async def test_reference_level_offset(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/reference-level", json={"offset": 10})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("PSREFLEV 10")


@pytest.mark.asyncio
async def test_z3_sleep_timer(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/zone3/sleep", json={"minutes": 30})
    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("Z3SLP030")

# ── Device Info ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_device_info(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/device")
    assert resp.status_code == 200
    data = resp.json()
    assert data["device_name"] == "Denon AVR"
    assert data["zone3_name"] == "Zone 3"
    assert "channel_names" in data
    assert any(source["id"] == "GAME" for source in data["sources"])
    assert any(source["id"] == "GAME1" for source in data["sources"])
    assert data["source_name_map"]["GAME"] == "Game Console"


@pytest.mark.asyncio
async def test_source_audio_profile_persist_and_delete(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.put("/api/v1/source-profiles/GAME1", json={
            "volume": 42.5,
            "bass": 52,
            "treble": 48,
            "tone_enabled": True,
        })
        assert resp.status_code == 200
        resp = await ac.get("/api/v1/source-profiles")
        assert resp.json()["profiles"]["GAME1"]["volume"] == 42.5
        resp = await ac.delete("/api/v1/source-profiles/GAME1")
        assert resp.status_code == 200
        resp = await ac.get("/api/v1/source-profiles")
        assert "GAME1" not in resp.json()["profiles"]


@pytest.mark.asyncio
async def test_source_audio_profile_accepts_slash_source_codes(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for source in ("SAT/CBL", "USB/IPOD"):
            resp = await ac.put(f"/api/v1/source-profiles/{source}", json={"bass": 52})
            assert resp.status_code == 200
            assert resp.json()["source"] == source

    assert set(mock_app_state.source_profiles) == {"SAT/CBL", "USB/IPOD"}


@pytest.mark.asyncio
async def test_source_audio_profile_can_be_applied(mock_app_state):
    from main import app

    mock_app_state.source_profiles = {"GAME1": {"subwoofer_level": 38}}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/source-profiles/GAME1/apply")

    assert resp.status_code == 200
    mock_app_state.telnet.send.assert_called_with("PSSWL 38")


@pytest.mark.asyncio
async def test_tone_controls_send_receiver_commands(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/tone", json={
            "enabled": False,
            "bass": 54,
            "treble": 47,
        })

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    mock_app_state.telnet.send.assert_any_call("PSTONE CTRL OFF")
    mock_app_state.telnet.send.assert_any_call("PSBAS 54")
    mock_app_state.telnet.send.assert_any_call("PSTRE 47")


@pytest.mark.asyncio
async def test_source_name_persist_and_reset(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/source-names/GAME", json={"name": "PlayStation 5"})
        assert resp.status_code == 200
        resp = await ac.get("/api/v1/device")
        assert resp.status_code == 200
        data = resp.json()
        assert data["source_name_map"]["GAME"] == "PlayStation 5"
        assert data["source_name_overrides"]["GAME"] == "PlayStation 5"
        resp = await ac.delete("/api/v1/source-names/GAME")
        assert resp.status_code == 200
        resp = await ac.get("/api/v1/device")
        assert resp.json()["source_name_map"]["GAME"] == "Game Console"


@pytest.mark.asyncio
async def test_source_favorites_persist_and_deduplicate(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/source-favorites", json={"source": "GAME1"})
        assert resp.status_code == 200
        resp = await ac.post("/api/v1/source-favorites", json={"source": "GAME1"})
        assert resp.json()["source_favorites"] == ["GAME1"]
        resp = await ac.get("/api/v1/device")
        assert resp.json()["source_favorites"] == ["GAME1"]
        resp = await ac.delete("/api/v1/source-favorites/GAME1")
        assert resp.status_code == 200
        assert resp.json()["source_favorites"] == []


@pytest.mark.asyncio
async def test_ui_theme_persisted_in_device_info(mock_app_state):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/ui-settings", json={"theme": "purple"})
        assert resp.status_code == 200
        resp = await ac.get("/api/v1/device")
        assert resp.status_code == 200
        assert resp.json()["theme"] == "purple"


# ── Not Connected ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_commands_503_when_disconnected(mock_app_no_connection):
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for endpoint in ["/api/v1/power/on", "/api/v1/volume/up", "/api/v1/mute/on"]:
            resp = await ac.post(endpoint)
            assert resp.status_code == 503, f"{endpoint} should return 503"
