"""Small Subsonic-compatible client for direct Navidrome library access."""
from __future__ import annotations

import hashlib
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx


class NavidromeClient:
    """Access Navidrome without exposing credentials to the browser."""

    def __init__(self, base_url: str, username: str, password: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.username and self.password)

    def _params(self, **values: Any) -> dict[str, str]:
        salt = secrets.token_hex(8)
        token = hashlib.md5((self.password + salt).encode()).hexdigest()
        params = {
            "u": self.username,
            "t": token,
            "s": salt,
            "v": "1.16.1",
            "c": "denon-dashboard",
            "f": "json",
        }
        params.update({key: str(value) for key, value in values.items()})
        return params

    async def request(self, endpoint: str, **params: Any) -> dict[str, Any]:
        if not self.configured:
            raise RuntimeError("Navidrome is not configured")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=10.0) as client:
            response = await client.get(f"/rest/{endpoint}.view", params=self._params(**params))
            response.raise_for_status()
            data = response.json()
        subsonic = data.get("subsonic-response", {})
        if subsonic.get("status") != "ok":
            error = subsonic.get("error", {}).get("message", "Navidrome request failed")
            raise RuntimeError(error)
        return subsonic

    async def indexes(self) -> dict[str, Any]:
        return await self.request("getIndexes")

    async def album(self, album_id: str) -> dict[str, Any]:
        return await self.request("getAlbum", id=album_id)

    async def artist(self, artist_id: str) -> dict[str, Any]:
        return await self.request("getArtist", id=artist_id)

    def stream_url(self, song_id: str) -> str:
        params = self._params(id=song_id)
        query = urlencode(params)
        return f"{self.base_url}/rest/stream.view?{query}"

    async def cover(self, cover_id: str) -> tuple[bytes, str]:
        if not self.configured:
            raise RuntimeError("Navidrome is not configured")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=10.0) as client:
            response = await client.get("/rest/coverArt.view", params=self._params(id=cover_id))
            response.raise_for_status()
            return response.content, response.headers.get("content-type", "image/jpeg")