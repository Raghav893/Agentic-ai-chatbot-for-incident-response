import base64
import ipaddress
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx


URL_PATTERN = re.compile(r"https?://[^\s<>\x00-\x20\"'`]+", re.IGNORECASE)
HOST_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
PHISHING_PATTERNS = (
    (
        r"\b(urgent|immediately|act now|final warning|within \d+ (hours?|minutes?))\b",
        "Urgent wording or a short deadline",
    ),
    (
        r"\b(suspend(?:ed|ing)?|lock(?:ed)?|terminat(?:e|ed|ion)|deactivat(?:e|ed|ion))\b",
        "Threat of suspension, account lockout, or termination",
    ),
    (
        r"\b(?:verify|confirm|share|submit|send|enter|provide)\s+(?:(?:your|the|a)\s+)?"
        r"(?:password|credentials|account|one[- ]time code|otp|pin)\b",
        "Request to verify an account or provide sensitive information",
    ),
    (
        r"\b(gift cards?|wire transfer|crypto(?:currency)? payment|bank transfer)\b",
        "Request or reference to a payment mechanism common in scams",
    ),
)


class InvalidUrl(ValueError):
    pass


@dataclass(frozen=True)
class UrlEvidence:
    url: str
    hostname: str
    path: str
    indicators: tuple[str, ...]
    can_lookup: bool


@dataclass(frozen=True)
class Reputation:
    status: str
    malicious: int = 0
    suspicious: int = 0


def inspect_url(url: str) -> UrlEvidence:
    if len(url) > 2048 or re.search(r"[\s\x00-\x1f\x7f\\]", url):
        raise InvalidUrl("URL contains invalid characters or exceeds the length limit.")

    try:
        parts = urlsplit(url)
        hostname = (parts.hostname or "").rstrip(".").encode("idna").decode("ascii").lower()
        port = parts.port
    except (ValueError, UnicodeError) as error:
        raise InvalidUrl("URL has an invalid hostname or port.") from error

    if parts.scheme not in {"http", "https"} or not hostname:
        raise InvalidUrl("Enter a full HTTP or HTTPS URL with a hostname.")

    indicators = []
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None

    labels = hostname.split(".")
    if address is None and (len(hostname) > 253 or not all(HOST_LABEL.fullmatch(label) for label in labels)):
        raise InvalidUrl("URL has an invalid hostname.")

    has_credentials = parts.username is not None or parts.password is not None
    if has_credentials:
        indicators.append("URL contains user-information before the hostname, which can obscure the destination")
    if address is not None:
        indicators.append("URL uses a numeric IP address in place of a domain name")
    if any(label.startswith("xn--") for label in labels):
        indicators.append("URL uses an internationalized hostname that may merit a lookalike check")
    if len(labels) >= 5:
        indicators.append("URL has multiple subdomain labels, which can make the actual hostname harder to recognize")
    if parts.scheme == "http":
        indicators.append("URL uses unencrypted HTTP")

    if address is not None:
        public_host = address.is_global and not address.is_multicast
    else:
        public_host = (
            len(labels) > 1
            and not labels[-1].isdigit()
            and labels[-1] not in {"localhost", "local", "internal", "test", "invalid", "example", "onion", "lan"}
            and hostname != "home.arpa"
            and not hostname.endswith(".home.arpa")
        )
    can_lookup = (
        public_host and not has_credentials and not parts.query and not parts.fragment and port in {None, 80, 443}
    )
    return UrlEvidence(url, hostname, parts.path, tuple(indicators), can_lookup)


def extract_urls(texts: list[str], limit: int = 3) -> list[UrlEvidence]:
    found = {}
    for text in texts:
        for match in URL_PATTERN.finditer(text):
            candidate = match.group().rstrip(".,;!")
            while candidate.endswith(")") and candidate.count(")") > candidate.count("("):
                candidate = candidate[:-1]
            try:
                found.setdefault(candidate, inspect_url(candidate))
            except InvalidUrl:
                continue
            if len(found) == limit:
                return list(found.values())
    return list(found.values())


def phishing_indicators(text: str) -> list[str]:
    text_without_links = URL_PATTERN.sub(" ", text)
    return [label for pattern, label in PHISHING_PATTERNS if re.search(pattern, text_without_links, re.IGNORECASE)]


async def lookup_reputation(client: httpx.AsyncClient, api_key: str, url: UrlEvidence) -> Reputation:
    if not url.can_lookup:
        return Reputation("skipped_ineligible_url")
    if not api_key:
        return Reputation("unconfigured")

    identifier = base64.urlsafe_b64encode(url.url.encode()).decode().rstrip("=")
    try:
        response = await client.get(
            f"https://www.virustotal.com/api/v3/urls/{identifier}",
            headers={"x-apikey": api_key},
            timeout=4.0,
        )
        if response.status_code == 404:
            return Reputation("no_existing_report")
        if response.status_code == 429:
            return Reputation("rate_limited")
        response.raise_for_status()
        stats = response.json()["data"]["attributes"]["last_analysis_stats"]
        malicious, suspicious = stats["malicious"], stats["suspicious"]
        if any(type(count) is not int or count < 0 for count in (malicious, suspicious)):
            return Reputation("unavailable")
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return Reputation("unavailable")

    return Reputation("report_found", malicious, suspicious)
