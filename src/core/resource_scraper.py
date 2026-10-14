"""
Resource discovery crawlers for external clip/pack sites.

Phase 1: Metadata indexing only — no video downloads.
Stores discovered assets into a local SQLite database for the dashboard.
"""

from __future__ import annotations

import sqlite3
import time
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urldefrag

import requests
from bs4 import BeautifulSoup

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
})


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class DiscoveredAsset:
    """A single clip/pack/scene discovered on a source site."""
    source_site: str            # e.g. "ninjaclips", "editpacks", "youpro"
    source_url: str             # canonical URL on the source site
    title: str                  # display title
    description: str = ""       # optional blurb
    category: str = ""          # site-specific category/taxonomy
    tags: list[str] = field(default_factory=list)
    year: Optional[int] = None
    resolution: str = ""        # e.g. "1080p", "4K", "720p"
    duration: str = ""          # human-readable from the site
    download_url: str = ""      # direct download URL if known, else ""
    thumbnail_url: str = ""     # preview image URL if known
    views_downloads: str = ""   # "230k views" / "5.7k downloads" etc.
    rank_trend: str = ""        # site-specific ranking/trend info
    scraped_at: str = field(default_factory=lambda: datetime.now().isoformat())
    local_path: str = ""        # filled in Phase 2 when downloaded
    status: str = "indexed"     # "indexed" | "queued" | "downloaded" | "failed"
    id: Optional[int] = None     # DB row id (set by iter_assets; NULL until saved)


# ---------------------------------------------------------------------------
# SQLite storage
# ---------------------------------------------------------------------------

DB_PATH = Path.home() / ".lyric-video" / "resources.db"


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sites (
            id          INTEGER PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            base_url    TEXT NOT NULL,
            first_seen  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assets (
            id              INTEGER PRIMARY KEY,
            site_id         INTEGER NOT NULL REFERENCES sites(id),
            source_url      TEXT NOT NULL UNIQUE,
            title           TEXT NOT NULL,
            description     TEXT DEFAULT '',
            category        TEXT DEFAULT '',
            tags            TEXT DEFAULT '[]',
            year            INTEGER,
            resolution      TEXT DEFAULT '',
            duration        TEXT DEFAULT '',
            download_url    TEXT DEFAULT '',
            thumbnail_url   TEXT DEFAULT '',
            views_downloads TEXT DEFAULT '',
            rank_trend      TEXT DEFAULT '',
            scraped_at      TEXT NOT NULL,
            local_path      TEXT DEFAULT '',
            status          TEXT NOT NULL DEFAULT 'indexed'
        );

        CREATE INDEX IF NOT EXISTS idx_assets_site   ON assets(site_id);
        CREATE INDEX IF NOT EXISTS idx_assets_title  ON assets(title);
        CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
        CREATE INDEX IF NOT EXISTS idx_assets_tags   ON assets(tags);
    """)
    conn.close()


def upsert_asset(asset: DiscoveredAsset) -> int:
    conn = get_db()
    cur = conn.execute("SELECT id FROM sites WHERE name = ?", (asset.source_site,))
    row = cur.fetchone()
    if row:
        site_id = row["id"]
    else:
        cur = conn.execute(
            "INSERT INTO sites (name, base_url, first_seen) VALUES (?, ?, ?)",
            (asset.source_site, "", asset.scraped_at),
        )
        site_id = cur.lastrowid

    conn.execute("""
        INSERT INTO assets (
            site_id, source_url, title, description, category, tags,
            year, resolution, duration, download_url, thumbnail_url,
            views_downloads, rank_trend, scraped_at, local_path, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_url) DO UPDATE SET
            title=excluded.title,
            description=excluded.description,
            category=excluded.category,
            tags=excluded.tags,
            resolution=excluded.resolution,
            duration=excluded.duration,
            download_url=excluded.download_url,
            thumbnail_url=excluded.thumbnail_url,
            views_downloads=excluded.views_downloads,
            rank_trend=excluded.rank_trend,
            scraped_at=excluded.scraped_at,
            status=excluded.status
    """, (
        site_id, asset.source_url, asset.title, asset.description,
        asset.category, str(asset.tags), asset.year, asset.resolution,
        asset.duration, asset.download_url, asset.thumbnail_url,
        asset.views_downloads, asset.rank_trend, asset.scraped_at,
        asset.local_path, asset.status,
    ))
    conn.commit()
    return site_id


def iter_assets(
    site: str = "",
    status: str = "",
    limit: int = 0,
) -> list[DiscoveredAsset]:
    conn = get_db()
    sql = "SELECT a.*, s.name AS site_name FROM assets a JOIN sites s ON a.site_id = s.id WHERE 1=1"
    params: list[str] = []
    if site:
        sql += " AND s.name = ?"
        params.append(site)
    if status:
        sql += " AND a.status = ?"
        params.append(status)
    sql += " ORDER BY a.scraped_at DESC"
    if limit:
        sql += f" LIMIT {limit}"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    out: list[DiscoveredAsset] = []
    for r in rows:
        tags: list[str] = []
        try:
            tags = __import__("json").loads(r["tags"])
        except Exception:
            pass
        out.append(DiscoveredAsset(
            id=r["id"],
            source_site=r["site_name"],
            source_url=r["source_url"],
            title=r["title"],
            description=r["description"],
            category=r["category"],
            tags=tags,
            year=r["year"],
            resolution=r["resolution"],
            duration=r["duration"],
            download_url=r["download_url"],
            thumbnail_url=r["thumbnail_url"],
            views_downloads=r["views_downloads"],
            rank_trend=r["rank_trend"],
            scraped_at=r["scraped_at"],
            local_path=r["local_path"],
            # Older rows were written with the legacy " indexed" default
            # (leading space); trim so status filters/matches work.
            status=str(r["status"] or "").strip() or "indexed",
        ))
    return out


def count_by_site() -> dict[str, int]:
    conn = get_db()
    rows = conn.execute(
        "SELECT s.name, COUNT(a.id) FROM sites s LEFT JOIN assets a ON a.site_id = s.id GROUP BY s.id"
    ).fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}


def count_total() -> int:
    conn = get_db()
    r = conn.execute("SELECT COUNT(*) FROM assets").fetchone()
    conn.close()
    return r[0]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def first_text(el) -> str:
    if el is None:
        return ""
    return el.get_text(strip=True)


def safe_int(s: str) -> Optional[int]:
    s = "".join(ch for ch in s if ch.isdigit())
    return int(s) if s else None


def scrape(url: str, pause: float = 1.0) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    time.sleep(pause)
    return soup(resp.text)


# ===========================================================================
# SITE: ninjaclips.io
# ===========================================================================

def _parse_view_count(s: str) -> str:
    return s.strip()


def crawl_ninjaclips(max_pages: int = 5) -> int:
    """Crawl /clips listing pages for trending clip metadata.

    Each card's <a> links to the SOURCE video (YouTube/Crunchyroll/etc.).
    We store source_url = that external link.
    """
    base = "https://ninjaclips.io/clips"
    count = 0
    for page in range(1, max_pages + 1):
        url = f"{base}?page={page}" if page > 1 else base
        print(f"[ninjaclips] fetching page {page}: {url}")
        try:
            s = scrape(url, pause=1.5)
        except Exception as exc:
            print(f"[ninjaclips]  page {page} failed: {exc}")
            break

        # Each clip is an <li><a href=...>rank + channel + title + views</a></li>
        items = s.select("li.relative.min-w-0")
        if not items:
            items = s.select("li")
        for li in items:
            a = li.select_one("a[href]")
            if not a:
                continue
            href = a.get("href", "")
            if not href or not href.startswith("http"):
                continue
            text = a.get_text(" ", strip=True)
            # Parse: rank channel duration title views
            parts = text.split()
            # Rank is first token if numeric
            rank = parts[0] if parts and parts[0].isdigit() else ""
            rest = text[len(rank):].strip() if rank else text
            # Channel often ends right before a duration pattern (N:M)
            channel = ""
            title = rest
            # Heuristic: find duration pattern like "3:47"
            import re
            dm = re.search(r"\d{1,2}:\d{2}", rest)
            if dm:
                before = rest[:dm.start()].strip()
                after = rest[dm.end():].strip()
                # Channel = first segment, title = rest
                segs = before.split(None, 1)
                channel = segs[0] if segs else ""
                title = after
            # Views/trend: last segment containing k/m/day
            views = ""
            if title:
                tparts = title.rsplit(None, 2)
                if len(tparts) >= 2 and any(c in tparts[-1].lower() for c in "kmd"):
                    views = tparts[-1]
                    title = " ".join(tparts[:-1])
            asset = DiscoveredAsset(
                source_site="ninjaclips",
                source_url=href,
                title=title or "untitled",
                description=channel,
                category="trending",
                tags=["anime", "clip", "trending"],
                views_downloads=views,
                rank_trend=rank,
                scraped_at=datetime.now().isoformat(),
            )
            upsert_asset(asset)
            count += 1

        print(f"[ninjaclips]  page {page}: {count} total assets indexed")
    print(f"[ninjaclips] done — {count} assets indexed")
    return count


# ===========================================================================
# SITE: editpacks.org
# ===========================================================================

def _ep_slug_from_url(url: str) -> str:
    """Extract source slug from editpacks.org/source/<slug>."""
    for prefix in ("/source/", "/"):
        idx = url.find(prefix)
        if idx != -1:
            tail = url[idx + len(prefix):].rstrip("/")
            return tail.split("/")[0]
    return ""


def crawl_editpacks_homepage() -> int:
    """Crawl the homepage /?sort=new listing for pack-level metadata.

    HTML structure:
      <a class="poster" href="/source/slug">
        <div class="poster-art"><img>...</div>
        <div class="poster-meta">
          <div class="...">Title text</div>
          <div class="...">1 pack · 1 download</div>
        </div>
      </a>
    """
    url = "https://editpacks.org/?sort=new"
    print(f"[editpacks] fetching homepage: {url}")
    s = scrape(url, pause=2.0)
    count = 0

    posters = s.select("a.poster[href*='/source/']")
    for a in posters:
        href = a.get("href", "")
        full_url = urljoin("https://editpacks.org", href)
        slug = _ep_slug_from_url(href)

        # Title: from poster-hover-name span or aria-label
        title_el = a.select_one("span.poster-hover-name")
        title = first_text(title_el) if title_el else a.get("aria-label", "")
        # Strip year suffix like " (2022)"
        title = __import__("re").sub(r"\s*\(\d{4}\)\s*$", "", title).strip()
        if not title or len(title) < 2:
            continue

        # Metadata from poster-meta children
        year: Optional[int] = None
        cat = "uncategorized"
        pack_count = ""
        dl_count = ""
        meta = a.select_one("div.poster-meta")
        if meta:
            text = meta.get_text(" ", strip=True)
            yr_m = __import__("re").search(r"\((\d{4})\)", text)
            if yr_m:
                year = safe_int(yr_m.group(1))
            pm = __import__("re").search(r"(\d+(?:\.\d+)?[kK]?)\s*(packs?)\s*[·•]\s*(\d+(?:\.\d+)?[kK]?)\s*(downloads?)?", text)
            if pm:
                pack_count = f"{pm.group(1)} {pm.group(2)}"
                dl_count = f"{pm.group(3)} {pm.group(4) or ''}".strip()
            # Category: tags in poster-hover-tags
            tag_spans = a.select("span.poster-hover-tags span")
            cats = [first_text(ts) for ts in tag_spans if first_text(ts) and first_text(ts) not in ("New",)]
            if cats:
                cat = cats[0]

        asset = DiscoveredAsset(
            source_site="editpacks",
            source_url=full_url,
            title=title,
            category=cat,
            year=year,
            tags=["scenepack", "editpacks", cat.lower()],
            views_downloads=f"{pack_count} · {dl_count}".strip(" ·"),
            scraped_at=datetime.now().isoformat(),
        )
        upsert_asset(asset)
        count += 1

    print(f"[editpacks] homepage: {count} titles indexed")
    return count


def crawl_editpacks_source(slug: str) -> int:
    """Crawl an individual /source/<slug> page for per-pack details.

    Pack entry structure:
      <div class="item-row item-row-link">
        <a class="item-row-cover" href="/i/{id}/...-scenepack">  <- pack page
        <div class="item-body">
          Shadow the Hedgehog Scenepack Scenepack 1080p 1:47 ♥19
        </div>
        <div class="item-actions">
          <a class="btn item-preview" href="/i/{id}/...">Preview</a>
          <a class="btn item-dl" href="/api/dl/{id}?s=...&t=...">Download</a>
        </div>
      </div>
    Resolution: <span class="tag q">1080p</span>
    Duration:   <span class="tag">1:47</span>
    """
    url = f"https://editpacks.org/source/{slug}"
    print(f"[editpacks] source page: {url}")
    try:
        s = scrape(url, pause=2.0)
    except Exception as exc:
        print(f"[editpacks]  failed: {exc}")
        return 0

    count = 0
    rows = s.select("div.item-row.item-row-link")
    for row in rows:
        # Preview link
        preview_a = row.select_one("a.item-row-cover[href*='/i/']")
        if not preview_a:
            continue
        pack_href = preview_a.get("href", "")
        pack_id_m = __import__("re").search(r"/i/(\d+)/", pack_href)
        if not pack_id_m:
            continue
        pack_id = pack_id_m.group(1)
        pack_title = preview_a.get("aria-label", "") or first_text(preview_a) or ""

        # Resolution + duration from item-body
        body = row.select_one("div.item-body")
        resolution = ""
        duration = ""
        if body:
            bt = body.get_text(" ", strip=True)
            rm = __import__("re").search(r"(\d{3,4}p)", bt)
            if rm:
                resolution = rm.group(1)
            dm = __import__("re").search(r"(\d{1,2}:\d{2})", bt)
            if dm:
                duration = dm.group(1)

        # Download URL
        dl_a = row.select_one("a.item-dl[href*='/api/dl/']")
        download_url = ""
        if dl_a:
            download_url = urljoin("https://editpacks.org", dl_a.get("href", ""))

        # Source title for context
        source_title_el = s.select_one("h1")
        source_title = first_text(source_title_el) if source_title_el else slug.replace("-", " ").title()

        asset = DiscoveredAsset(
            source_site="editpacks",
            source_url=f"https://editpacks.org/pack/{pack_id}",
            title=pack_title or source_title,
            description=source_title,
            category="pack",
            tags=["scenepack", "editpacks", slug],
            resolution=resolution,
            duration=duration,
            download_url=download_url,
            views_downloads=f"pack {pack_id}",
            scraped_at=datetime.now().isoformat(),
        )
        upsert_asset(asset)
        count += 1

    print(f"[editpacks] {slug}: {count} packs indexed")
    return count


def crawl_editpacks_source_pages(limit: int = 15) -> int:
    """Crawl individual /source/<slug> pages for the top titles.

    Picks the most-downloaded titles from the homepage index.
    Only processes assets whose source_url starts with /source/ (homepage
    entries), not per-pack entries created by this function itself.
    """
    # Get ALL editpacks assets and filter to those with /source/ URLs
    conn = get_db()
    rows = conn.execute(
        "SELECT a.*, s.name AS site_name FROM assets a "
        "JOIN sites s ON a.site_id = s.id "
        "WHERE s.name = 'editpacks' "
        "AND a.source_url LIKE '%/source/%' "
        "AND a.download_url = '' "
        "ORDER BY a.views_downloads DESC "
        "LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    if not rows:
        return 0

    def _dl_key(r) -> int:
        import re as _re
        m = _re.search(r'(\d+(?:\.\d+)?[kK]?)', r["views_downloads"] or "")
        if not m:
            return 0
        v = m.group(1)
        mul = 1000 if 'k' in v.lower() else 1
        try:
            return int(float(v.replace('k','').replace('K','')) * mul)
        except ValueError:
            return 0

    rows.sort(key=_dl_key, reverse=True)
    total = 0
    seen: set[str] = set()
    for r in rows:
        slug = _ep_slug_from_url(r["source_url"])
        if not slug or slug in seen:
            continue
        seen.add(slug)
        print(f"[editpacks] expanding: {r['title']} ({slug})")
        total += crawl_editpacks_source(slug)
    return total


# ===========================================================================
# SITE: youpro.cloud
# ===========================================================================

def crawl_youpro_actor(actor_url: str) -> int:
    """Crawl a single actor page and extract pack URLs from JSON-LD.

    The actor page embeds a CollectionPage JSON-LD with an ItemList of
    all scene packs for that actor. This is the canonical source of truth.
    """
    print(f"[youpro] actor: {actor_url}")
    try:
        s = scrape(actor_url, pause=1.0)
    except Exception as exc:
        print(f"[youpro]  failed: {exc}")
        return 0

    count = 0
    import json as _json
    import re as _re

    blocks = _re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', str(s), _re.S
    )
    for block in blocks:
        try:
            data = _json.loads(block)
        except _json.JSONDecodeError:
            continue
        if not isinstance(data, list):
            data = [data]
        for item in data:
            if item.get("@type") != "CollectionPage":
                continue
            il = item.get("mainEntity", {}).get("itemListElement", [])
            if not il:
                continue
            actor_name = item.get("about", {}).get("name", "") or ""
            for el in il:
                pack = el.get("item", {})
                if not pack:
                    continue
                pack_url = pack.get("url", "")
                pack_name = pack.get("name", "") or "untitled"
                if not pack_url or pack_url in ("", "#"):
                    continue
                # Extract year from name like "Captain America (2011)"
                year: Optional[int] = None
                yr_m = _re.search(r"\((\d{4})\)\s*$", pack_name)
                if yr_m:
                    year = safe_int(yr_m.group(1))

                asset = DiscoveredAsset(
                    source_site="youpro",
                    source_url=pack_url,
                    title=pack_name,
                    category=f"actor:{actor_name}" if actor_name else "scene-pack",
                    year=year,
                    tags=["scenepack", "youpro", "actor"],
                    scraped_at=datetime.now().isoformat(),
                )
                upsert_asset(asset)
                count += 1
            break  # one CollectionPage per page

    print(f"[youpro]  {actor_url.split('/')[-2]}: {count} packs indexed")
    return count


def crawl_youpro_actor_list() -> int:
    """Discover all actor page URLs from the directory page, then crawl each."""
    base = "https://www.youpro.cloud/scene-packs/directory"
    print(f"[youpro] fetching actor list from: {base}")
    try:
        s = scrape(base, pause=2.0)
    except Exception as exc:
        print(f"[youpro]  failed to fetch directory: {exc}")
        return 0

    # Extract actor URLs from raw HTML
    import re as _re
    actor_paths = _re.findall(
        r'href="(/scene-packs/actor/[^"]+)"', str(s)
    )
    actor_urls = sorted(set(
        urljoin("https://www.youpro.cloud", p)
        for p in actor_paths
    ))
    print(f"[youpro] found {len(actor_urls)} actor pages")

    total = 0
    for au in actor_urls:
        total += crawl_youpro_actor(au)
    print(f"[youpro] actors: {total} packs indexed from {len(actor_urls)} actors")
    return total


def crawl_youpro_directory(max_pages: int = 41) -> int:
    """Crawl youpro scene packs.

    The directory pagination pages (1-41) do NOT contain individual pack
    links in the static HTML — packs are rendered client-side. Instead we
    crawl the actor listing (embedded in the directory page HTML) and each
    actor page's JSON-LD CollectionPage, which is the canonical source.
    """
    return crawl_youpro_actor_list()


def crawl_youpro_pack(url_path: str) -> int:
    """Crawl an individual pack page for clip-level details.

    url_path: the full URL to the pack page.
    """
    print(f"[youpro] pack page: {url_path}")
    try:
        s = scrape(url_path, pause=2.0)
    except Exception as exc:
        print(f"[youpro]  failed: {exc}")
        return 0

    count = 0
    # Extract download URL from download button if present
    download_url = ""
    dl_btn = s.select_one('a[href*="download"], a[href*=".zip"], button')
    if dl_btn:
        href = dl_btn.get("href", "") or dl_btn.get("data-url", "")
        if href:
            download_url = urljoin("https://www.youpro.cloud", href)

    # Title
    title_el = s.select_one("h1, h2, h3")
    title = first_text(title_el) if title_el else url_path.split("/")[-1]

    asset = DiscoveredAsset(
        source_site="youpro",
        source_url=url_path,
        title=title,
        category="scene-pack",
        tags=["scenepack", "youpro"],
        download_url=download_url,
        scraped_at=datetime.now().isoformat(),
    )
    upsert_asset(asset)
    count += 1
    print(f"[youpro] {title}: indexed")
    return count


# ===========================================================================
# SITE: animeclipsraw.fr
# ===========================================================================

def crawl_animeclipsraw_categories() -> int:
    """Crawl main category pages and individual post pages."""
    categories = [
        "https://animeclipsraw.fr/category/best-mc-twixtor/",
        "https://animeclipsraw.fr/movie-serie-clips/",
        "https://animeclipsraw.fr/category/one-piece-clips/",
    ]
    count = 0
    for cat_url in categories:
        print(f"[animeclipsraw] category: {cat_url}")
        try:
            s = scrape(cat_url, pause=2.0)
        except Exception as exc:
            print(f"[animeclipsraw]  failed: {exc}")
            continue

        # Post links — skip cookie/consent, navigation, category pages
        import re as _re
        links = s.select('a[href*="animeclipsraw.fr/"]')
        seen: set[str] = set()
        skip_paths = ("/opt-out", "/cookie", "/privacy", "/contact", "/about",
                      "/category/", "/wp-", "/feed", "/xmlrpc")
        for a in links:
            href = a.get("href", "")
            if not href:
                continue
            if any(skip in href for skip in skip_paths):
                continue
            full = urljoin("https://animeclipsraw.fr", href)
            if full in seen:
                continue
            if full == "https://animeclipsraw.fr/":
                continue
            # Skip nav menu links (ct-menu-link class)
            if a.get("class") and "ct-menu-link" in a.get("class"):
                continue
            # Skip if URL looks like a section/category page (has trailing slash but not a post slug)
            if href.rstrip("/").endswith("/") or href.rstrip("/").count("/") <= 3:
                # e.g. /news/, /twixtor-clips/ — these are section pages
                pass  # still allow, upsert will dedupe
            seen.add(full)

            # Title: prefer h6 sibling, then a text, then derive from URL
            title = first_text(a)
            if not title or len(title.strip()) < 3:
                # Try parent h6 or heading ancestor
                h6 = a.find_parent("h6") or a.find_parent("h3") or a.find_parent("h2")
                if h6:
                    title = first_text(h6)
            if not title or len(title.strip()) < 3:
                # Derive from URL slug
                slug = href.strip("/").split("/")[-1]
                title = slug.replace("-", " ").replace("twixtor", "").strip(" -").title()
                if not title:
                    title = slug.title()
            if title.strip().lower() in ("Manage Cookie Settings", "Accept", "Reject", "Skip to content"):
                continue
            asset = DiscoveredAsset(
                source_site="animeclipsraw",
                source_url=full,
                title=title,
                category=cat_url.split("/category/")[-1].rstrip("/").replace("-", " ").title()
                if "/category/" in cat_url else "clips",
                tags=["anime", "twixtor", "animeclipsraw"],
                scraped_at=datetime.now().isoformat(),
            )
            upsert_asset(asset)
            count += 1

        print(f"[animeclipsraw] {cat_url}: {count} posts indexed")
    print(f"[animeclipsraw] categories: {count} posts indexed")
    return count


def crawl_animeclipsraw_post(url_path: str) -> int:
    """Crawl an individual post page for download links (Mega/Google Drive)."""
    print(f"[animeclipsraw] post: {url_path}")
    try:
        s = scrape(url_path, pause=2.0)
    except Exception as exc:
        print(f"[animeclipsraw]  failed: {exc}")
        return 0

    count = 0
    download_url = ""
    # Look for Mega.nz or Google Drive links
    for a in s.select("a"):
        href = a.get("href", "")
        if "mega.nz" in href or "drive.google.com" in href:
            download_url = href
            break

    # Title: use the og:title meta, or h1, or derive from URL
    og_title = s.select_one('meta[property="og:title"]')
    if og_title:
        title = og_title.get("content", "")
    else:
        h1 = s.select_one("h1")
        title = first_text(h1) if h1 else ""
    if not title or len(title.strip()) < 3:
        # Derive from URL slug, but use the asset's existing title if available
        slug = url_path.rstrip("/").split("/")[-1]
        title = slug.replace("-", " ").title()
    if title and not title.strip():
        title = slug.replace("-", " ").title()

    asset = DiscoveredAsset(
        source_site="animeclipsraw",
        source_url=url_path,
        title=title,
        category="twixtor-clip",
        tags=["anime", "twixtor", "animeclipsraw"],
        download_url=download_url,
        scraped_at=datetime.now().isoformat(),
    )
    upsert_asset(asset)
    count += 1
    has_dl = 'YES' if download_url else 'no'
    safe_title = title.encode('ascii', 'replace').decode()[:30]
    print(f"[animeclipsraw] {safe_title:30s}: download={has_dl}")
    return count


# ===========================================================================
# SITE: motionvault.space
# ===========================================================================

def crawl_animeclipsraw_all_posts(max_posts: int = 20) -> int:
    """Crawl individual animeclipsraw post pages for Mega/GD download links.

    Each post page has Mega.nz and/or Google Drive download links.
    We crawl the most recent posts (by asset ID) to extract download URLs.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT a.source_url FROM assets a JOIN sites s ON a.site_id = s.id "
        "WHERE s.name = 'animeclipsraw' AND a.download_url = '' "
        "ORDER BY a.id DESC LIMIT ?",
        (max_posts,),
    ).fetchall()
    conn.close()

    total = 0
    for row in rows:
        total += crawl_animeclipsraw_post(row[0])
    print(f"[animeclipsraw] posts: {total} download URLs extracted")
    return total


def crawl_motionvault() -> int:
    """Crawl motionvault.space for clip metadata.

    The homepage has Google Drive direct-download links paired with
    "Free Download" buttons. Each clip card contains a GD file link
    and a resolution tag.
    """
    url = "https://motionvault.space/"
    print(f"[motionvault] fetching: {url}")
    try:
        s = scrape(url, pause=2.0)
    except Exception as exc:
        print(f"[motionvault] failed: {exc}")
        return 0

    count = 0
    import re as _re

    # The page uses clip cards with iframes. Parse cards directly.
    # Each card: <div class="clip-thumb"><iframe src="...drive.../d/{ID}/...">
    #            <span class="clip-se">Title</span></div>
    clip_cards = s.select('div.clip-thumb')
    print(f"[motionvault] found {len(clip_cards)} clip-thumb cards")

    seen: set[str] = set()
    paired: list[tuple[str, str]] = []  # (title, gd_file_id)
    for card in clip_cards:
        iframe = card.select_one('iframe[src*="drive.google.com/file/d/"]')
        if not iframe:
            continue
        src = iframe.get("src", "")
        m = _re.search(r'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', src)
        if not m:
            continue
        fid = m.group(1)
        if fid in seen:
            continue
        seen.add(fid)

        # Title from card text: "One Piece | Anime" -> "One Piece"
        card_text = card.get_text(" | ", strip=True)
        title = card_text.split("|")[0].strip()
        if not title or len(title) < 2:
            title = f"MotionVault Clip {len(paired)+1}"

        paired.append((title, fid))

    # Fallback: if no cards found, extract GD IDs from iframes directly
    if not paired:
        for iframe in s.select('iframe[src*="drive.google.com/file/d/"]'):
            src = iframe.get("src", "")
            m = _re.search(r'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', src)
            if not m or m.group(1) in seen:
                continue
            seen.add(m.group(1))
            paired.append((f"MotionVault Clip {len(paired)+1}", m.group(1)))

    for title, fid in paired:
        gd_url = f"https://drive.google.com/file/d/{fid}/view"
        # Use the GD URL as the unique source identifier for each clip
        asset = DiscoveredAsset(
            source_site="motionvault",
            source_url=gd_url,
            title=title,
            category="clip",
            tags=["anime", "motionvault"],
            download_url=gd_url,
            scraped_at=datetime.now().isoformat(),
        )
        upsert_asset(asset)
        count += 1

    print(f"[motionvault] homepage: {count} clips indexed")
    return count


# ===========================================================================
# Orchestrator
# ===========================================================================

def crawl_all(
    max_pages_ninjaclips: int = 3,
    expand_editpacks: bool = True,
    editpacks_source_limit: int = 15,
) -> dict[str, int]:
    """Run all Phase 1 crawlers.

    Args:
        max_pages_ninjaclips: how many /clips pages to crawl
        expand_editpacks: crawl individual /source/<slug> pages for pack details
        editpacks_source_limit: max source pages to expand
    """
    init_db()
    results: dict[str, int] = {}
    results["ninjaclips"] = crawl_ninjaclips(max_pages_ninjaclips)
    ep_homepage = crawl_editpacks_homepage()
    results["editpacks_homepage"] = ep_homepage
    if expand_editpacks:
        ep_sources = crawl_editpacks_source_pages(limit=editpacks_source_limit)
        results["editpacks_sources"] = ep_sources
    results["youpro_actors"] = crawl_youpro_actor_list()
    results["animeclipsraw_categories"] = crawl_animeclipsraw_categories()
    results["animeclipsraw_posts"] = crawl_animeclipsraw_all_posts(max_posts=10)
    results["motionvault"] = crawl_motionvault()
    results["TOTAL"] = count_total()
    return results


if __name__ == "__main__":
    import json
    print("=" * 60)
    print("Phase 1 — Resource Discovery Crawler")
    print("=" * 60)
    res = crawl_all()
    print("\nResults:")
    print(json.dumps(res, indent=2))
    print("\nTotal counts by site:")
    print(json.dumps(count_by_site(), indent=2))
    print(f"\nGrand total assets: {count_total()}")
