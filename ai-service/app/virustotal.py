import asyncio
import base64
import re
from collections import OrderedDict, deque
from time import monotonic

import httpx

from .evidence import UrlEvidence
from .schemas import ReputationStatus, VirusTotalReport, VirusTotalVendor


REPORT_CACHE_LIMIT = 128
REPORT_TTL_SECONDS = 15 * 60
MISSING_TTL_SECONDS = 5 * 60
REQUESTS_PER_MINUTE = 4
WINDOW_SECONDS = 60
REQUEST_TIMEOUT_SECONDS = 4
LATEST_ANALYSIS_TIMESTAMP = 4_102_444_800
STATS_KEYS = ("harmless", "malicious", "suspicious", "timeout", "undetected")


class VirusTotalClient:
    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self.client = client
        self.api_key = api_key
        self._cache: OrderedDict[str, tuple[float, VirusTotalReport]] = OrderedDict()
        self._pending: dict[str, asyncio.Task[VirusTotalReport]] = {}
        self._requests: deque[float] = deque()
        self._retry_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def lookup(self, url: UrlEvidence) -> VirusTotalReport:
        if not url.can_lookup:
            return _report(url, "skipped_ineligible_url")
        if not self.configured:
            return _report(url, "unconfigured")

        now = monotonic()
        cached = self._cache.get(url.url)
        if cached:
            expires, report = cached
            if expires > now:
                self._cache.move_to_end(url.url)
                return report
            del self._cache[url.url]

        pending = self._pending.get(url.url)
        if pending:
            return await asyncio.shield(pending)

        while self._requests and self._requests[0] <= now - WINDOW_SECONDS:
            self._requests.popleft()
        if now < self._retry_at or len(self._requests) >= REQUESTS_PER_MINUTE:
            return _report(url, "rate_limited")

        self._requests.append(now)
        pending = asyncio.create_task(self._fetch_and_cache(url))
        self._pending[url.url] = pending
        return await asyncio.shield(pending)

    async def _fetch_and_cache(self, url: UrlEvidence) -> VirusTotalReport:
        try:
            report = await self._fetch(url)
            if report.status in {"report_found", "no_existing_report"}:
                ttl = REPORT_TTL_SECONDS if report.status == "report_found" else MISSING_TTL_SECONDS
                self._cache[url.url] = (monotonic() + ttl, report)
                if len(self._cache) > REPORT_CACHE_LIMIT:
                    self._cache.popitem(last=False)
            elif report.status == "rate_limited":
                self._retry_at = monotonic() + WINDOW_SECONDS
            return report
        finally:
            self._pending.pop(url.url, None)

    async def _fetch(self, url: UrlEvidence) -> VirusTotalReport:
        identifier = base64.urlsafe_b64encode(url.url.encode()).decode().rstrip("=")
        try:
            async with asyncio.timeout(REQUEST_TIMEOUT_SECONDS):
                response = await self.client.get(
                    f"https://www.virustotal.com/api/v3/urls/{identifier}",
                    headers={"x-apikey": self.api_key},
                    timeout=REQUEST_TIMEOUT_SECONDS,
                    follow_redirects=False,
                )
            if response.status_code == 404:
                return _report(url, "no_existing_report")
            if response.status_code == 429:
                return _report(url, "rate_limited")
            response.raise_for_status()
            return _parse_report(url, response.json()["data"])
        except (TimeoutError, httpx.HTTPError, AttributeError, KeyError, TypeError, ValueError):
            return _report(url, "unavailable")


def _report(url: UrlEvidence, status: ReputationStatus) -> VirusTotalReport:
    return VirusTotalReport(url=url.url if url.can_lookup else url.hostname, hostname=url.hostname, status=status)


def _parse_report(url: UrlEvidence, data: dict) -> VirusTotalReport:
    attributes = data["attributes"]
    stats = attributes.get("last_analysis_stats")
    if stats is None:
        return _report(url, "no_existing_report")
    if not isinstance(stats, dict) or not {"malicious", "suspicious"} <= stats.keys():
        return _report(url, "unavailable")

    counts = {key: stats.get(key, 0) for key in STATS_KEYS}
    if any(type(count) is not int or not 0 <= count <= 10_000 for count in counts.values()):
        return _report(url, "unavailable")
    total = sum(counts.values())
    if total == counts["timeout"]:
        return _report(url, "no_existing_report")

    date = attributes.get("last_analysis_date")
    if type(date) is not int or not 0 < date <= LATEST_ANALYSIS_TIMESTAMP:
        date = None
    report_id = data.get("id")
    if not isinstance(report_id, str) or not re.fullmatch(r"[a-f0-9]{64}", report_id):
        report_id = None
    return VirusTotalReport(
        url=url.url, hostname=url.hostname, status="report_found",
        malicious=counts["malicious"], suspicious=counts["suspicious"], harmless=counts["harmless"], total=total,
        last_analysis_date=date, report_id=report_id, vendors=_flagged_vendors(attributes.get("last_analysis_results")),
    )


def _flagged_vendors(results: object) -> list[VirusTotalVendor]:
    if not isinstance(results, dict):
        return []
    vendors = []
    for key, result in results.items():
        if not isinstance(result, dict):
            continue
        category = result.get("category")
        if category not in ("malicious", "suspicious"):
            continue
        name = _display_text(result.get("engine_name")) or _display_text(key)
        if name:
            vendors.append(VirusTotalVendor(
                name=name, verdict=_display_text(result.get("result")) or category, category=category,
            ))
    return sorted(vendors, key=lambda vendor: (vendor.category, vendor.name.casefold()))[:128]


def _display_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    normalized = " ".join(value.split())[:120].strip()
    return normalized if normalized.isprintable() else ""
