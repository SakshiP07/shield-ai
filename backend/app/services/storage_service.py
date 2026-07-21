"""Supabase Storage integration — uses the existing bucket only (never creates buckets)."""

from __future__ import annotations

import mimetypes
import uuid
from urllib.parse import urlparse

from app.core.supabase_client import get_supabase_admin

# Existing bucket — create/configure manually in the Supabase dashboard (never auto-created).
STORAGE_BUCKET = "avatars"


class StorageError(Exception):
    pass


class StorageService:
    @staticmethod
    def _bucket() -> str:
        return STORAGE_BUCKET

    @staticmethod
    def public_url(path: str) -> str:
        client = get_supabase_admin()
        return client.storage.from_(StorageService._bucket()).get_public_url(path)

    @staticmethod
    def upload_file(
        *,
        data: bytes,
        filename: str,
        content_type: str | None = None,
        folder: str = "uploads",
    ) -> str:
        """Upload bytes to the existing bucket and return the public URL."""
        if not data:
            raise StorageError("Empty file")

        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()
        path = f"{folder}/{uuid.uuid4().hex}{ext}"
        mime = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

        client = get_supabase_admin()
        try:
            client.storage.from_(StorageService._bucket()).upload(
                path,
                data,
                file_options={"content-type": mime, "upsert": "false"},
            )
        except Exception as exc:  # noqa: BLE001 — surface storage failures cleanly
            raise StorageError(f"Upload failed: {exc}") from exc

        return StorageService.public_url(path)

    @staticmethod
    def delete_by_url(url: str | None) -> bool:
        """Delete an object from the existing bucket given its public URL."""
        if not url:
            return False
        path = StorageService._path_from_public_url(url)
        if not path:
            return False
        client = get_supabase_admin()
        try:
            client.storage.from_(StorageService._bucket()).remove([path])
            return True
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _path_from_public_url(url: str) -> str | None:
        """Extract object path from a Supabase public object URL."""
        bucket = StorageService._bucket()
        marker = f"/object/public/{bucket}/"
        parsed = urlparse(url)
        if marker in parsed.path:
            return parsed.path.split(marker, 1)[1]
        # Relative path fallback
        if not url.startswith("http") and "/" in url:
            return url.lstrip("/")
        return None
