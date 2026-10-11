#!/usr/bin/env python
"""Read-only post-deployment smoke test for the public API."""

from __future__ import annotations

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def check(
    base_url: str, path: str, expected_status: str, *, require_proxy: bool
) -> None:
    request = Request(f"{base_url.rstrip('/')}{path}", headers={"User-Agent": "GinderSmoke/1"})
    with urlopen(request, timeout=10) as response:
        body = json.load(response)
        if response.status != 200 or body.get("status") != expected_status:
            raise RuntimeError(f"{path} returned an unexpected response")
        if require_proxy and response.headers.get("server", "").lower().startswith("uvicorn"):
            raise RuntimeError("backend is exposed directly; expected the HTTPS reverse proxy")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="Public origin, for example https://api.example.com")
    parser.add_argument(
        "--allow-http",
        action="store_true",
        help="Permit HTTP only for a local dry run",
    )
    args = parser.parse_args()

    parsed = urlparse(args.base_url)
    if parsed.scheme != "https" and not args.allow_http:
        parser.error("production smoke tests require an https:// URL")

    try:
        check(
            args.base_url,
            "/health/live",
            "ok",
            require_proxy=not args.allow_http,
        )
        check(
            args.base_url,
            "/health/ready",
            "ready",
            require_proxy=not args.allow_http,
        )
    except (HTTPError, URLError, RuntimeError, ValueError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1

    print("PASS: liveness, database, Redis, and HTTPS proxy checks succeeded")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
