"""
Download queue worker for discovered assets (Phase 2b).

Downloads video clips/packs from source sites into the local
.lyric-video/assets/ directory, with per-site rate limiting
and error handling.
"""

from __future__ import annotations

import hashlib
import os
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

from src.core.resource_scraper import (
    get_db,
    upsert_asset,
)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
})


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DOWNLOAD_ROOT = Path.home() / ".lyric-video" / "assets"

RATE_LIMITS = {
    "editpacks": 3.0,
    "motionvault": 2.0,
    "animeclipsraw": 2.0,
    "youpro": 5.0,
    "ninjaclips": 1.0,
}

SUPPORTED_DL_SITES = {"editpacks", "motionvault", "animeclipsraw"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

@dataclass
class DownloadTask:
    asset_id: int
    site_name: str
    source_url: str
    title: str
    download_url: str
    local_path: str = ""
    status: str = "pending"
    error: str = ""
    queued_at: str = field(default_factory=lambda: datetime.now().isoformat())
    started_at: str = ""
    finished_at: str = ""


@dataclass
class DownloadResult:
    task: DownloadTask
    success: bool
    bytes_downloaded: int = 0
    elapsed: float = 0.0


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

class DownloadQueue:
    def __init__(self, max_concurrent: int = 2):
        self.max_concurrent = max_concurrent
        self._queue: list[DownloadTask] = []
        self._site_last_request: dict[str, float] = {}
        self._lock = __import__("threading").Lock()

    def add(self, task: DownloadTask) -> None:
        with self._lock:
            self._queue.append(task)

    def add_from_db(
        self,
        site_name: str,
        limit: Optional[int] = None,
        only_with_dl: bool = True,
    ) -> int:
        if site_name not in SUPPORTED_DL_SITES:
            print(f"[dlq] site '{site_name}' not supported for download")
            return 0

        conn = get_db()
        query = (
            "SELECT a.id, s.name, a.source_url, a.title, a.download_url "
            "FROM assets a JOIN sites s ON a.site_id = s.id "
            "WHERE s.name = ?"
        )
        params: list = [site_name]
        if only_with_dl:
            query += " AND a.download_url != ''"
        query += " ORDER BY a.id DESC"
        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)

        rows = conn.execute(query, params).fetchall()
        conn.close()

        count = 0
        for row in rows:
            task = DownloadTask(
                asset_id=row[0],
                site_name=row[1],
                source_url=row[2],
                title=row[3],
                download_url=row[4],
            )
            self.add(task)
            count += 1

        print(f"[dlq] queued {count} tasks for site='{site_name}' "
              f"(limit={limit}, with_dl={only_with_dl})")
        return count

    def pop(self, site_name: Optional[str] = None) -> Optional[DownloadTask]:
        with self._lock:
            candidates = self._queue
            if site_name:
                candidates = [t for t in candidates if t.site_name == site_name]
            if not candidates:
                return None
            task = candidates[0]
            self._queue.remove(task)
            return task

    def _record_request(self, site_name: str) -> None:
        with self._lock:
            self._site_last_request[site_name] = time.monotonic()

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self._queue)


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

def _normalize_download_url(url: str) -> str:
    """Convert Google Drive preview URLs to direct download format.

    drive.google.com/file/d/{ID}/view  ->  drive.google.com/uc?export=download&id={ID}
    drive.google.com/file/d/{ID}/preview -> same
    """
    import re as _re
    m = _re.search(r'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', url)
    if m:
        fid = m.group(1)
        return f"https://drive.google.com/uc?export=download&id={fid}"
    return url


def _guess_extension(url: str) -> str:
    url = _normalize_download_url(url)
    parsed = urlparse(url)
    path = parsed.path.lower()
    if path.endswith((".mp4", ".mkv", ".zip", ".mov")):
        return Path(path).suffix
    if "mp4" in url.lower() or "video" in url.lower():
        return ".mp4"
    return ".mp4"


def _local_filename(site_name: str, title: str, download_url: str) -> str:
    normalized = _normalize_download_url(download_url)
    url_hash = hashlib.md5(normalized.encode()).hexdigest()[:8]
    safe_title = "".join(
        c if c.isalnum() or c in " -_." else "_"
        for c in title
    ).strip(" ._")[:60]
    if not safe_title:
        safe_title = "clip"
    ext = _guess_extension(normalized)
    return f"{safe_title}_{url_hash}{ext}"


def download_file(
    url: str,
    dest: Path,
    timeout: int = 60,
    chunk_size: int = 1024 * 1024,
    on_progress=None,
) -> tuple[bool, int, str]:
    try:
        url = _normalize_download_url(url)
        response = SESSION.get(url, stream=True, timeout=timeout,
                               allow_redirects=True)
        if response.status_code >= 400:
            return False, 0, f"HTTP {response.status_code}"

        total = int(response.headers.get("content-length", 0))
        downloaded = 0

        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if on_progress and total > 0:
                        pct = downloaded / total * 100
                        if int(pct) % 20 == 0:
                            on_progress(downloaded, total, pct)

        return True, downloaded, ""

    except requests.exceptions.Timeout:
        return False, 0, "timeout"
    except requests.exceptions.ConnectionError as exc:
        return False, 0, f"connection error: {exc}"
    except Exception as exc:
        return False, 0, str(exc)


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

class DownloadWorker:
    def __init__(self, max_concurrent: int = 2,
                 download_root: Path = DOWNLOAD_ROOT):
        self.queue = DownloadQueue(max_concurrent=max_concurrent)
        self.download_root = download_root
        self.results: list[DownloadResult] = []

    def add_from_site(
        self,
        site_name: str,
        limit: Optional[int] = None,
        only_with_dl: bool = True,
    ) -> int:
        return self.queue.add_from_db(site_name, limit, only_with_dl)

    def _process_task(self, task: DownloadTask) -> DownloadResult:
        start = time.monotonic()
        site_dir = self.download_root / task.site_name
        filename = _local_filename(task.site_name, task.title,
                                   task.download_url)
        dest = site_dir / filename

        task.status = "downloading"
        task.started_at = datetime.now().isoformat()
        task.local_path = str(dest)

        safe_title = task.title.encode('ascii', 'replace').decode()[:30]
        print(f"  [dl] {task.site_name}/{safe_title:30s} "
              f"-> {dest.name}")

        success, bytes_dl, error = download_file(
            task.download_url, dest,
            on_progress=lambda cur, total, pct: None,
        )

        task.finished_at = datetime.now().isoformat()
        elapsed = time.monotonic() - start

        if success:
            task.status = "downloaded"
            conn = get_db()
            conn.execute(
                "UPDATE assets SET local_path = ?, status = ? "
                "WHERE id = ?",
                (str(dest), "downloaded", task.asset_id),
            )
            conn.commit()
            conn.close()
            print(f"    [OK] {bytes_dl:,} bytes in {elapsed:.1f}s")
        else:
            task.status = "failed"
            task.error = error
            conn = get_db()
            conn.execute(
                "UPDATE assets SET status = ? WHERE id = ?",
                ("failed", task.asset_id),
            )
            conn.commit()
            conn.close()
            print(f"    [FAIL] {error}")

        return DownloadResult(
            task=task,
            success=success,
            bytes_downloaded=bytes_dl,
            elapsed=elapsed,
        )

    def run(self) -> list[DownloadResult]:
        self.results = []
        total = self.queue.pending_count

        if total == 0:
            print("[dlq] queue is empty, nothing to download")
            return self.results

        print(f"[dlq] starting download of {total} files "
              f"(root={self.download_root})")

        processed = 0
        failed = 0

        while True:
            task = self.queue.pop()
            if task is None:
                break

            now = time.monotonic()
            last = self.queue._site_last_request.get(task.site_name, 0.0)
            min_gap = RATE_LIMITS.get(task.site_name, 2.0)
            wait = max(0, min_gap - (now - last))
            if wait > 0:
                time.sleep(wait + random.uniform(0, 0.5))

            self.queue._record_request(task.site_name)
            result = self._process_task(task)
            self.results.append(result)
            processed += 1
            if not result.success:
                failed += 1

            time.sleep(random.uniform(0.2, 0.5))

        print(f"[dlq] done: {processed} processed, "
              f"{processed - failed} succeeded, {failed} failed")
        return self.results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("Phase 2b - Download Worker (demo: 5 files per site)")
    print("=" * 60)

    worker = DownloadWorker(max_concurrent=2)

    total_queued = 0
    for site in ["motionvault", "animeclipsraw", "editpacks"]:
        count = worker.add_from_site(site, limit=5)
        total_queued += count

    print(f"\nTotal queued: {total_queued}")
    if total_queued == 0:
        print("Nothing to download. Run Phase 1 crawlers first.")
    else:
        results = worker.run()
        print(f"\nResults summary:")
        print(json.dumps({
            "total": len(results),
            "succeeded": sum(1 for r in results if r.success),
            "failed": sum(1 for r in results if not r.success),
            "total_bytes": sum(r.bytes_downloaded for r in results),
        }, indent=2))
