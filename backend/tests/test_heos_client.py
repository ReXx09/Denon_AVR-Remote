"""Tests for HEOS CLI media commands."""
from __future__ import annotations

import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from denon.heos_client import HeosClient


@pytest.mark.asyncio
async def test_play_stream_logs_receiver_rejection(monkeypatch, caplog):
    client = HeosClient("receiver")
    client._pid = 123

    async def rejected_command(*args, **kwargs):
        return {
            "heos": {
                "result": "fail",
                "message": "station unavailable",
            }
        }

    monkeypatch.setattr(client, "_command", rejected_command)

    with caplog.at_level(logging.WARNING, logger="denon.heos_client"):
        assert await client.play_stream(1028, "s25021") is False

    assert "HEOS play_stream rejected" in caplog.text
    assert "station unavailable" in caplog.text


@pytest.mark.asyncio
async def test_play_stream_logs_missing_player_id(caplog):
    client = HeosClient("receiver")

    with caplog.at_level(logging.WARNING, logger="denon.heos_client"):
        assert await client.play_stream(1028, "s25021") is False

    assert "no player ID" in caplog.text
