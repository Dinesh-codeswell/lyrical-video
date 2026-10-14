"""Anime image search dialog — browse and pick an anime image as a video background."""

from __future__ import annotations

import requests
from pathlib import Path

from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QPixmap, QPalette, QColor
from PyQt6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from src.core.anime_client import AnimeImage, AnimeImageClient


# ── Worker thread ───────────────────────────────────────────────────────────

class _SearchWorker(QObject):
    """Runs API searches on a background thread to keep the UI responsive."""

    finished = pyqtSignal(list[AnimeImage])
    error = pyqtSignal(str)

    def __init__(self, client: AnimeImageClient, query: str, limit: int, rating: str) -> None:
        super().__init__()
        self._client = client
        self._query = query
        self._limit = limit
        self._rating = rating

    def run(self) -> None:
        try:
            results = self._client.search(self._query, limit=self._limit, rating=self._rating)
            self.finished.emit(results)
        except requests.RequestException as exc:
            self.error.emit(f"Search failed: {exc}")


class _RandomWorker(QObject):
    """Fetches a single random image on a background thread."""

    finished = pyqtSignal(AnimeImage)
    error = pyqtSignal(str)

    def __init__(self, client: AnimeImageClient, tag: str | None, rating: str) -> None:
        super().__init__()
        self._client = client
        self._tag = tag
        self._rating = rating

    def run(self) -> None:
        try:
            img = self._client.get_random(tag=self._tag, rating=self._rating)
            if img:
                self.finished.emit(img)
            else:
                self.error.emit("No images returned from API.")
        except requests.RequestException as exc:
            self.error.emit(f"Random fetch failed: {exc}")


# ── Dialog ──────────────────────────────────────────────────────────────────

class AnimeSearchDialog(QDialog):
    """Modal dialog that lets the user search anime images and pick one
    to download as a video background into ``input/backgrounds/``."""

    image_selected = pyqtSignal(AnimeImage)  # emitted when user confirms a choice

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Anime Image Search")
        self.setMinimumSize(680, 520)
        self._client = AnimeImageClient()
        self._current_images: list[AnimeImage] = []
        self._selected_image: AnimeImage | None = None
        self._build_ui()
        self._populate_tag_combo()
        self._search_button.setEnabled(False)

    # ── UI construction ───────────────────────────────────────────────────

    def _build_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 16, 16, 16)
        outer.setSpacing(10)

        # ── Top bar: search controls ──────────────────────────────────────
        top = QHBoxLayout()
        top.setSpacing(8)

        self._tag_combo = QComboBox()
        self._tag_combo.setEditable(True)
        self._tag_combo.setPlaceholderText("Search tags (e.g. demon slayer, watame)")
        self._tag_combo.setMinimumWidth(260)
        top.addWidget(self._tag_combo)

        self._rating_combo = QComboBox()
        self._rating_combo.addItems(["safe", "questionable", "explicit"])
        self._rating_combo.setCurrentText("safe")
        self._rating_combo.setFixedWidth(110)
        top.addWidget(self._rating_combo)

        self._search_button = QPushButton("Search")
        self._search_button.setProperty("variant", "primary")
        self._search_button.clicked.connect(self._on_search)
        top.addWidget(self._search_button)

        self._random_button = QPushButton("Random")
        self._random_button.setProperty("variant", "ghost")
        self._random_button.setFixedWidth(72)
        self._random_button.clicked.connect(self._on_random)
        top.addWidget(self._random_button)

        self._clear_button = QPushButton("Clear")
        self._clear_button.setProperty("variant", "ghost")
        self._clear_button.setFixedWidth(56)
        self._clear_button.clicked.connect(self._on_clear)
        top.addWidget(self._clear_button)

        outer.addLayout(top)

        # ── Preview area ──────────────────────────────────────────────────
        preview_row = QHBoxLayout()
        preview_row.setSpacing(12)

        self._preview_label = QLabel("(no image selected)")
        self._preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._preview_label.setStyleSheet(
            "border: 1px solid #333; background: #1a1a1a; color: #888;"
        )
        self._preview_label.setMinimumSize(240, 180)
        preview_row.addWidget(self._preview_label, stretch=1)

        # Image info panel (right of preview)
        info_panel = QVBoxLayout()
        info_panel.setSpacing(4)

        self._info_title = QLabel("Tags: —")
        self._info_title.setWordWrap(True)
        info_panel.addWidget(self._info_title)

        self._info_meta = QLabel("Score: — | Size: — | Source: —")
        self._info_meta.setWordWrap(True)
        info_panel.addWidget(self._info_meta)

        info_row = QHBoxLayout()
        info_row.addLayout(info_panel, stretch=1)

        preview_row.addLayout(info_row)
        outer.addLayout(preview_row)

        # ── Results list ──────────────────────────────────────────────────
        list_row = QHBoxLayout()
        list_row.setSpacing(8)

        self._results_list = QListWidget()
        self._results_list.setAlternatingRowColors(True)
        self._results_list.setMinimumHeight(140)
        self._results_list.itemDoubleClicked.connect(self._on_result_double_clicked)
        list_row.addWidget(self._results_list, stretch=1)

        outer.addLayout(list_row)

        # ── Progress bar (hidden by default) ─────────────────────────────
        self._progress = QProgressBar()
        self._progress.setRange(0, 0)  # indeterminate
        self._progress.setTextVisible(False)
        self._progress.setFixedHeight(6)
        self._progress.hide()
        outer.addWidget(self._progress)

        # ── Bottom: status + buttons ──────────────────────────────────────
        bottom = QHBoxLayout()
        bottom.setSpacing(8)

        self._status_label = QLabel("Enter tags and click Search, or click Random.")
        self._status_label.setProperty("secondary", "true")
        bottom.addWidget(self._status_label)

        bottom.addStretch()

        self._btn_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        self._btn_box.accepted.connect(self._on_ok)
        self._btn_box.rejected.connect(self.reject)
        self._btn_box.button(QDialogButtonBox.StandardButton.Ok).setEnabled(False)
        bottom.addWidget(self._btn_box)

        outer.addLayout(bottom)

    # ── Tag preset population ─────────────────────────────────────────────

    def _populate_tag_combo(self) -> None:
        """Add popular/common anime tags as quick-select presets."""
        presets = [
            "demon slayer",
            "attack on titan",
            "my hero academia",
            "one piece",
            "jujustu kaisen",
            "naruto",
            "kimetsu no yaiba",
            "anime landscape",
            "anime scenery",
            "anime city",
            "anime sunset",
            "anime night",
            "anime rain",
            "anime cherry blossom",
            "watame",
            "miku",
            "rem",
            "emilia",
            "saber",
            "holo",
        ]
        for tag in presets:
            self._tag_combo.addItem(tag)

    # ── Search flow ───────────────────────────────────────────────────────

    def _set_busy(self, busy: bool) -> None:
        self._search_button.setEnabled(not busy)
        self._random_button.setEnabled(not busy)
        if busy:
            self._search_button.setText("Searching…")
            self._random_button.setText("Fetching…")
            self._progress.show()
        else:
            self._search_button.setText("Search")
            self._random_button.setText("Random")
            self._progress.hide()

    def _on_search(self) -> None:
        query = self._tag_combo.currentText().strip()
        if not query:
            QMessageBox.warning(self, "Empty Query", "Enter at least one tag to search.")
            return

        self._set_busy(True)
        self._status_label.setText(f"Searching for: {query}…")
        self._btn_box.button(QDialogButtonBox.StandardButton.Ok).setEnabled(False)
        self._selected_image = None
        self._preview_label.setText("(searching…)")
        self._preview_label.setScaledContents(False)
        self._results_list.clear()

        self._thread = QThread(self)
        self._worker = _SearchWorker(self._client, query, limit=30, rating=self._rating_combo.currentText())
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.finished.connect(self._on_search_finished)
        self._worker.error.connect(self._on_search_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.started.connect(self._thread.start)
        self._thread.finished.connect(self._worker.deleteLater)
        self._thread.finished.connect(self._thread.deleteLater)
        self._thread.finished.connect(self._on_thread_done)
        self._thread.start()

    def _on_random(self) -> None:
        tag = self._tag_combo.currentText().strip() or None
        self._set_busy(True)
        label = f"Random{' (' + tag + ')' if tag else ''}…"
        self._status_label.setText(f"Fetching random image {label}")
        self._btn_box.button(QDialogButtonBox.StandardButton.Ok).setEnabled(False)
        self._selected_image = None
        self._preview_label.setText("(fetching…)")
        self._preview_label.setScaledContents(False)
        self._results_list.clear()

        self._thread = QThread(self)
        self._worker = _RandomWorker(self._client, tag, self._rating_combo.currentText())
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.finished.connect(self._on_random_finished)
        self._worker.error.connect(self._on_random_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.finished.connect(self._worker.deleteLater)
        self._thread.finished.connect(self._thread.deleteLater)
        self._thread.finished.connect(self._on_thread_done)
        self._thread.start()

    def _on_clear(self) -> None:
        self._tag_combo.setCurrentIndex(0)
        self._results_list.clear()
        self._preview_label.setText("(no image selected)")
        self._preview_label.setScaledContents(False)
        self._info_title.setText("Tags: —")
        self._info_meta.setText("Score: — | Size: — | Source: —")
        self._selected_image = None
        self._btn_box.button(QDialogButtonBox.StandardButton.Ok).setEnabled(False)
        self._status_label.setText("Enter tags and click Search, or click Random.")

    # ── Result handlers ───────────────────────────────────────────────────

    def _on_search_finished(self, images: list[AnimeImage]) -> None:
        self._current_images = images
        self._status_label.setText(f"Found {len(images)} images. Double-click to preview.")
        self._results_list.clear()

        for img in images:
            item = QListWidgetItem()
            item.setData(Qt.ItemDataRole.UserRole, img)
            # Short preview label
            tag_preview = ", ".join(img.tags[:5]) if img.tags else "(no tags)"
            item.setText(f"{img.backend} · score={img.score} · {tag_preview}")
            self._results_list.addItem(item)

        if images:
            self._select_result_at(0)

        self._set_busy(False)

    def _on_search_error(self, msg: str) -> None:
        self._status_label.setText(f"Search error: {msg}")
        QMessageBox.warning(self, "Search Failed", msg)
        self._set_busy(False)

    def _on_random_finished(self, img: AnimeImage) -> None:
        self._current_images = [img]
        self._status_label.setText(f"Got random image from {img.backend}.")
        self._results_list.clear()
        item = QListWidgetItem()
        item.setData(Qt.ItemDataRole.UserRole, img)
        tag_preview = ", ".join(img.tags[:5]) if img.tags else "(no tags)"
        item.setText(f"{img.backend} · score={img.score} · {tag_preview}")
        self._results_list.addItem(item)
        self._select_result_at(0)
        self._set_busy(False)

    def _on_random_error(self, msg: str) -> None:
        self._status_label.setText(f"Random fetch error: {msg}")
        QMessageBox.warning(self, "Fetch Failed", msg)
        self._set_busy(False)

    # ── Result selection ──────────────────────────────────────────────────

    def _select_result_at(self, index: int) -> None:
        if index < 0 or index >= len(self._current_images):
            return
        img = self._current_images[index]
        self._selected_image = img
        self._preview_image(img)
        self._btn_box.button(QDialogButtonBox.StandardButton.Ok).setEnabled(True)

    def _on_result_double_clicked(self, item: QListWidgetItem) -> None:
        img = item.data(Qt.ItemDataRole.UserRole)
        if isinstance(img, AnimeImage):
            idx = next((i for i, im in enumerate(self._current_images) if im is img), -1)
            if idx >= 0:
                self._select_result_at(idx)

    # ── Preview ───────────────────────────────────────────────────────────

    def _preview_image(self, img: AnimeImage) -> None:
        """Load and display a scaled preview of *img*."""
        try:
            # Try preview_url first, fall back to url
            preview_url = img.preview_url or img.url
            resp = requests.get(preview_url, timeout=20)
            resp.raise_for_status()
            pm = QPixmap()
            ok = pm.loadFromData(resp.content)
            if not ok:
                self._preview_label.setText("(failed to load preview)")
                return
        except requests.RequestException:
            self._preview_label.setText("(preview unavailable)")
            return

        # Scale to fit preview label while keeping aspect ratio
        scaled = pm.scaled(
            self._preview_label.size(),
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        self._preview_label.setPixmap(scaled)
        self._preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Update info
        size_str = f"{img.width}×{img.height}" if img.width and img.height else "unknown"
        source_str = img.source_url or "—"
        self._info_title.setText("Tags: " + (", ".join(img.tags) if img.tags else "(none)"))
        self._info_meta.setText(
            f"Score: {img.score} | Size: {size_str} | Backend: {img.backend}\n"
            f"Source: {source_str}"
        )

    # ── Confirmation ──────────────────────────────────────────────────────

    def _on_ok(self) -> None:
        if self._selected_image is None:
            return
        # Download into input/backgrounds/
        try:
            dest = self._client.download_to_backgrounds(self._selected_image)
            self.image_selected.emit(self._selected_image)
            QMessageBox.information(
                self,
                "Image Downloaded",
                f"Anime image saved to:\n{dest}\n\n"
                f"You can now use it as a background in the Theme Editor.",
            )
            self.accept()
        except requests.RequestException as exc:
            QMessageBox.critical(self, "Download Failed", f"Could not download image:\n{exc}")

    def _on_thread_done(self) -> None:
        self._thread = None
        self._worker = None

    # ── Cleanup ───────────────────────────────────────────────────────────

    def closeEvent(self, event) -> None:  # noqa: N802
        self._client.close()
        event.accept()
