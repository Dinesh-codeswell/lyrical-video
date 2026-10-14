"""Clips library panel — browses and downloads external clip assets.

Displays the discovered asset index from resource_scraper, lets the user
filter by site, search by title, and download clips into the local assets
directory. Downloaded files are served by the FastAPI backend for preview.
"""

from __future__ import annotations

import json
import sys
import threading
from pathlib import Path
from typing import Callable, Optional

from PyQt6.QtCore import Qt, QUrl, pyqtSignal, QEventLoop, QEvent
from PyQt6.QtGui import QColor, QDesktopServices
from PyQt6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QSpinBox,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from src.core.resource_scraper import (
    init_db,
    iter_assets,
    get_db,
    count_by_site,
    count_total,
)
from src.gui.styles import TOKENS


# Remove the fallback combobox class (import QComboBox above instead)
class QComboBox_custom:
    pass  # unused, QComboBox is imported


# Per-site color tags
SITE_COLORS: dict[str, str] = {
    "editpacks":   "#3b82f6",   # blue
    "youpro":      "#8b5cf6",   # purple
    "motionvault": "#10b981",   # green
    "animeclipsraw": "#f59e0b", # amber
    "ninjaclips":  "#ef4444",   # red
}


def _status_icon(status: str) -> str:
    return {
        "indexed":   "○",
        "downloaded": "●",
        "failed":    "✗",
        "queued":    "◐",
    }.get(status, "?")


class _AssetListItem(QListWidgetItem):
    """List item holding an asset dict for the clips library."""

    def __init__(self, asset: dict):
        super().__init__()
        self._asset = asset
        self._refresh_text()

    def _refresh_text(self) -> None:
        a = self._asset
        icon = _status_icon(a.get("status", "indexed"))
        color = SITE_COLORS.get(a.get("site", ""), "#6b7280")
        dl = "DL" if a.get("download_url") else "—"
        loc = "local ✓" if a.get("local_path") else ""
        text = (
            f"{icon} {a.get('title', '')}"
            f"\n  {a.get('site', '')}  ·  {a.get('resolution', '')}  ·  {a.get('duration', '')}"
            f"  ·  DL: {dl}"
            f"  {loc}"
        )
        self.setText(text)
        self.setForeground(QColor(color))
        self.setToolTip(
            f"Site: {a.get('site')}\n"
            f"Source: {a.get('source_url')}\n"
            f"Category: {a.get('category')}\n"
            f"Tags: {', '.join(a.get('tags', []))}"
        )


class ClipsLibraryPanel(QGroupBox):
    """Left-middle panel: browse external clip/pack library + download assets.

    Emits:
        asset_selected(dict)   — double-click on an asset row
        asset_downloaded(int)  — asset_id when a download completes
    """

    asset_selected = pyqtSignal(dict)
    asset_downloaded = pyqtSignal(int)

    def __init__(
        self,
        parent: QWidget | None = None,
        api_base: str = "http://localhost:8000",
    ):
        super().__init__("Clips Library", parent)
        self._api_base = api_base.rstrip("/")
        self._assets: list[dict] = []
        self._filtered: list[dict] = []
        self._selected_id: int | None = None
        self._load_loop: Optional[threading.Thread] = None
        self._stop_load = threading.Event()
        self._build_ui()
        self._refresh_index()

    # ------------------------------------------------------------------
    # UI construction
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setSpacing(8)

        # Search + filter row
        top_row = QHBoxLayout()
        top_row.setSpacing(8)

        self._search = QLineEdit()
        self._search.setPlaceholderText("Search clips by title…")
        self._search.setFixedHeight(28)
        self._search.textChanged.connect(self._on_search)
        top_row.addWidget(self._search)

        self._site_filter = QComboBox()
        self._site_filter.addItem("All sites")
        self._site_filter.addItems(sorted(SITE_COLORS.keys()))
        self._site_filter.currentTextChanged.connect(self._on_site_filter)
        top_row.addWidget(self._site_filter, stretch=0)

        self._refresh_btn = QPushButton("Refresh Index")
        self._refresh_btn.setProperty("variant", "ghost")
        self._refresh_btn.setFixedHeight(28)
        self._refresh_btn.clicked.connect(self._refresh_index)
        top_row.addWidget(self._refresh_btn)

        top_row.addStretch()
        layout.addLayout(top_row)

        # Status line
        self._status_label = QLabel("Loading…")
        self._status_label.setProperty("secondary", "true")
        self._status_label.setWordWrap(True)
        layout.addWidget(self._status_label)

        # Asset list
        self._list = QListWidget()
        self._list.setAlternatingRowColors(True)
        self._list.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self._list.setSpacing(4)
        self._list.itemDoubleClicked.connect(self._on_double_click)
        layout.addWidget(self._list, stretch=1)

        # Bottom action row
        btns = QHBoxLayout()
        btns.setSpacing(8)

        self._download_btn = QPushButton("Download Selected")
        self._download_btn.setProperty("variant", "primary")
        self._download_btn.setFixedHeight(30)
        self._download_btn.setEnabled(False)
        self._download_btn.clicked.connect(self._download_selected)
        btns.addWidget(self._download_btn)

        self._open_file_btn = QPushButton("Open in Browser")
        self._open_file_btn.setProperty("variant", "ghost")
        self._open_file_btn.setFixedHeight(30)
        self._open_file_btn.setEnabled(False)
        self._open_file_btn.clicked.connect(self._open_selected_in_browser)
        btns.addWidget(self._open_file_btn)

        btns.addStretch()
        layout.addLayout(btns)

    # ------------------------------------------------------------------
    # Filtering / search
    # ------------------------------------------------------------------

    def _on_search(self, query: str) -> None:
        self._apply_filter()

    def _on_site_filter(self, site: str) -> None:
        self._apply_filter()

    def _apply_filter(self) -> None:
        query = self._search.text().strip().lower()
        site = self._site_filter.currentText()
        if site == "All sites":
            site = ""
        filtered = self._assets
        if site:
            filtered = [a for a in filtered if a.get("site") == site]
        if query:
            filtered = [a for a in filtered if query in a.get("title", "").lower()]
        # Sort: downloaded first, then by title
        filtered.sort(key=lambda a: (
            0 if a.get("status") == "downloaded" else 1,
            a.get("title", "").lower(),
        ))
        self._filtered = filtered
        self._list.clear()
        for a in filtered:
            item = _AssetListItem(a)
            self._list.addItem(item)
        self._update_status()
        self._update_button_states()

    def _update_status(self) -> None:
        total = count_total()
        by_site = count_by_site()
        parts = [f"{total} assets"]
        if by_site:
            parts.append(" · ".join(f"{k}: {v}" for k, v in sorted(by_site.items())))
        dl_count = sum(1 for a in self._assets if a.get("status") == "downloaded")
        parts.append(f" · {dl_count} downloaded")
        if self._filtered:
            parts.append(f" · showing {len(self._filtered)}")
        self._status_label.setText(" ".join(parts))

    def _update_button_states(self) -> None:
        sel = self._list.currentItem()
        has_sel = isinstance(sel, _AssetListItem)
        self._download_btn.setEnabled(has_sel and sel._asset.get("download_url"))
        self._open_file_btn.setEnabled(has_sel and sel._asset.get("local_path"))

    # ------------------------------------------------------------------
    # Background index loading
    # ------------------------------------------------------------------

    def _refresh_index(self) -> None:
        """Load the asset index from SQLite in a background thread."""
        self._stop_load.set()
        self._stop_load = threading.Event()
        self._refresh_btn.setEnabled(False)
        self._refresh_btn.setText("Refreshing…")
        self._status_label.setText("Loading asset index…")

        def _load() -> None:
            try:
                init_db()
                # Don't hold the thread hostage — disable stop between sites
                assets = iter_assets(limit=0)
                # Convert to dicts
                dicts = []
                for a in assets:
                    dicts.append({
                        "id": getattr(a, "id", None),
                        "site": a.source_site,
                        "title": a.title,
                        "source_url": a.source_url,
                        "category": a.category,
                        "tags": list(a.tags),
                        "resolution": a.resolution,
                        "duration": a.duration,
                        "download_url": a.download_url,
                        "thumbnail_url": a.thumbnail_url,
                        "views_downloads": a.views_downloads,
                        "scraped_at": a.scraped_at,
                        "status": a.status,
                        "local_path": a.local_path,
                    })
                if not self._stop_load.is_set():
                    self._assets = dicts
                    # Schedule UI update on main thread
                    from PyQt6.QtWidgets import QApplication
                    QApplication.postEvent(
                        self,
                        _IndexLoadedEvent(dicts),
                    )
            except Exception as exc:
                if not self._stop_load.is_set():
                    from PyQt6.QtWidgets import QApplication
                    QApplication.postEvent(
                        self,
                        _IndexErrorEvent(str(exc)),
                    )

        self._load_loop = threading.Thread(target=_load, daemon=True)
        self._load_loop.start()

    # ------------------------------------------------------------------
    # Event handlers (main thread)
    # ------------------------------------------------------------------

    def event(self, event) -> bool:
        if isinstance(event, _IndexLoadedEvent):
            self._on_index_loaded(event.dicts)
            return True
        if isinstance(event, _IndexErrorEvent):
            self._on_index_error(event.message)
            return True
        return super().event(event)

    def _on_index_loaded(self, dicts: list[dict]) -> None:
        self._refresh_btn.setEnabled(True)
        self._refresh_btn.setText("Refresh Index")
        self._assets = dicts
        self._apply_filter()

    def _on_index_error(self, message: str) -> None:
        self._refresh_btn.setEnabled(True)
        self._refresh_btn.setText("Refresh Index")
        self._status_label.setText(f"Error loading index: {message}")
        QMessageBox.warning(self, "Index Error", f"Could not load asset index:\n{message}")

    # ------------------------------------------------------------------
    # Selection / double-click
    # ------------------------------------------------------------------

    def _on_selection_changed(self, current, _prev) -> None:
        if isinstance(current, _AssetListItem):
            self._selected_id = current._asset.get("id")
        else:
            self._selected_id = None
        self._update_button_states()

    def _on_double_click(self, item: QListWidgetItem) -> None:
        if not isinstance(item, _AssetListItem):
            return
        self.asset_selected.emit(item._asset)

    def _open_selected_in_browser(self) -> None:
        sel = self._list.currentItem()
        if not isinstance(sel, _AssetListItem):
            return
        url = sel._asset.get("source_url")
        if url:
            QDesktopServices.openUrl(QUrl(url))

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    def _download_selected(self) -> None:
        sel = self._list.currentItem()
        if not isinstance(sel, _AssetListItem):
            return
        asset = sel._asset
        asset_id = asset.get("id")
        download_url = asset.get("download_url")
        if not download_url or not asset_id:
            QMessageBox.information(self, "No Download", "This asset has no download URL.")
            return

        # Try the FastAPI backend download endpoint first
        self._download_btn.setEnabled(False)
        self._download_btn.setText("Downloading…")
        self._status_label.setText(f"Downloading: {asset['title']}")

        def _dl() -> None:
            try:
                import requests
                job_id = self._trigger_backend_download(asset_id)
                if job_id:
                    # Poll for completion
                    self._poll_download(asset_id, job_id)
                else:
                    # Fallback: direct download via download_worker
                    self._direct_download(asset)
            except Exception as exc:
                if not self._stop_load.is_set():
                    from PyQt6.QtWidgets import QApplication
                    QApplication.postEvent(
                        self,
                        _DownloadErrorEvent(str(exc)),
                    )

        t = threading.Thread(target=_dl, daemon=True)
        t.start()

    def _trigger_backend_download(self, asset_id: int) -> str | None:
        """POST /api/assets/{id}/download and return job_id, or None on failure."""
        try:
            import requests
            resp = requests.post(
                f"{self._api_base}/api/assets/{asset_id}/download",
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("job_id")
        except Exception:
            pass
        return None

    def _poll_download(self, asset_id: int, job_id: str) -> None:
        """Poll /api/assets/{id}/download-status until complete."""
        import time
        import requests
        max_polls = 600  # 10 min at 1s interval
        for _ in range(max_polls):
            if self._stop_load.is_set():
                return
            try:
                resp = requests.get(
                    f"{self._api_base}/api/assets/{asset_id}/download-status",
                    params={"job_id": job_id},
                    timeout=5,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    status = data.get("status", "")
                    progress = data.get("progress", 0)
                    if status == "completed":
                        self._on_download_success(asset_id)
                        return
                    elif status == "failed":
                        self._on_download_error(data.get("error", "download failed"))
                        return
                    else:
                        self._status_label.setText(
                            f"Downloading: {data.get('title', '')} — {progress}%"
                        )
            except Exception:
                pass
            time.sleep(1)
        self._status_label.setText("Download timed out")

    def _direct_download(self, asset: dict) -> None:
        """Fallback: download directly without backend using download_worker."""
        from src.core.download_worker import DownloadWorker, DownloadTask
        try:
            worker = DownloadWorker(max_concurrent=1)
            task = DownloadTask(
                asset_id=asset["id"],
                site_name=asset["site"],
                source_url=asset["source_url"],
                title=asset["title"],
                download_url=asset["download_url"],
            )
            worker.queue.add(task)
            results = worker.run()
            if results and results[0].success:
                self._on_download_success(asset["id"])
            else:
                err = results[0].error if results else "no result"
                self._on_download_error(err)
        except Exception as exc:
            self._on_download_error(str(exc))

    def _on_download_success(self, asset_id: int) -> None:
        self._refresh_btn.setEnabled(True)
        self._refresh_btn.setText("Refresh Index")
        self._download_btn.setEnabled(True)
        self._download_btn.setText("Download Selected")
        self._status_label.setText(f"Downloaded asset #{asset_id}")
        self.asset_downloaded.emit(asset_id)
        # Refresh the list to show updated status
        self._apply_filter()

    def _on_download_error(self, message: str) -> None:
        self._refresh_btn.setEnabled(True)
        self._refresh_btn.setText("Refresh Index")
        self._download_btn.setEnabled(True)
        self._download_btn.setText("Download Selected")
        self._status_label.setText(f"Download failed: {message[:80]}")
        QMessageBox.warning(self, "Download Failed", message)


# Lightweight event types for thread→UI communication
class _IndexLoadedEvent(QEvent):
    def __init__(self, dicts: list[dict]):
        super().__init__(QEvent.Type.User + 1)
        self.dicts = dicts


class _IndexErrorEvent(QEvent):
    def __init__(self, message: str):
        super().__init__(QEvent.Type.User + 2)
        self.message = message


class _DownloadErrorEvent(QEvent):
    def __init__(self, message: str):
        super().__init__(QEvent.Type.User + 3)
        self.message = message


# Minimal combobox replacement (avoids import issues)
class QComboBox_custom(QWidget):
    """Fallback combobox — not used in production path; QComboBox imported below."""

    signal_current_text_changed = pyqtSignal(str)

    def __init__(self, parent):
        super().__init__(parent)
        self._items = []

    def addItem(self, text: str) -> None:
        self._items.append(text)

    def addItems(self, items: list[str]) -> None:
        self._items.extend(items)

    def currentText(self) -> str:
        return self._items[0] if self._items else ""

    def setCurrentIndex(self, idx: int) -> None:
        pass


