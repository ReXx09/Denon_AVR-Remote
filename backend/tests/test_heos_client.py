"""Tests for HEOS CLI media commands."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from denon.heos_client import HeosClient


class _EmptyReader:
    async def readline(self):
        return b""


class _ClosingWriter:
    def __init__(self, commands=None):
        self.closed = False
        self.commands = commands

    def is_closing(self):
        return self.closed

    def close(self):
        self.closed = True

    async def wait_closed(self):
        await asyncio.sleep(0)

    def write(self, data):
        if self.commands is not None:
            command = data.decode().strip().removeprefix("heos://").split("?", 1)[0]
            self.commands.put_nowait(command)

    async def drain(self):
        pass


class _CommandReader:
    def __init__(self, commands):
        self.commands = commands

    async def readline(self):
        command = await self.commands.get()
        response = {
            "heos": {"command": command, "result": "success"},
        }
        if command == "player/get_players":
            response["payload"] = [{"pid": 42}]
        return (json.dumps(response) + "\r\n").encode()


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


@pytest.mark.asyncio
async def test_listener_disconnect_does_not_cancel_itself():
    client = HeosClient("receiver")
    writer = _ClosingWriter()
    client._reader = _EmptyReader()
    client._writer = writer

    listen_task = asyncio.create_task(client._listen())
    client._listen_task = listen_task
    await asyncio.wait_for(listen_task, timeout=1)

    assert not listen_task.cancelled()
    assert writer.closed
    assert not client.connected


@pytest.mark.asyncio
async def test_command_reconnect_does_not_deadlock_during_player_discovery(monkeypatch):
    commands = asyncio.Queue()
    reader = _CommandReader(commands)
    writer = _ClosingWriter(commands)

    async def open_connection(*args, **kwargs):
        return reader, writer

    monkeypatch.setattr(asyncio, "open_connection", open_connection)
    client = HeosClient("receiver")

    response = await asyncio.wait_for(client._command("test/command"), timeout=1)

    assert response["heos"]["result"] == "success"
    assert client.player_id == 42
    assert client.last_response_at is not None
    await client.disconnect()
