"""Public HTTPS auth drill using one self-created, finally-deleted test account.

No existing account is used. Tokens and credentials are never printed.
"""

import argparse
import json
import secrets
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("origin")
    args = parser.parse_args()
    if not args.origin.startswith("https://"):
        parser.error("A public HTTPS origin is required")
    base = args.origin.rstrip("/") + "/api/v1"
    credentials = {
        "email": "release-auth-" + uuid.uuid4().hex + "@example.org",
        "password": secrets.token_urlsafe(32),
    }

    def request(method, path, body=None, token=None):
        headers = {"Content-Type": "application/json", "User-Agent": "GinderAuthSmoke/1"}
        if token:
            headers["Authorization"] = "Bearer " + token
        req = Request(
            base + path, method=method, headers=headers,
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            with urlopen(req, timeout=20) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, {}

    created = False
    try:
        status, first = request("POST", "/auth/signup", {
            **credentials, "display_name": "Temporary release check", "accepted_terms": True,
        })
        assert status == 201, f"Signup failed: {status}"
        created = True
        status, second = request("POST", "/auth/login", credentials)
        assert status == 200, f"Second login failed: {status}"
        status, rotated = request(
            "POST", "/auth/refresh", {"refresh_token": first["refresh_token"]}
        )
        assert status == 200 and rotated["refresh_token"] != first["refresh_token"]
        status, _ = request("POST", "/auth/refresh", {"refresh_token": first["refresh_token"]})
        assert status == 401, "Old refresh accepted"
        status, _ = request("GET", "/users/me", token=rotated["access_token"])
        assert status == 401, "Replayed login access still valid"
        status, _ = request("GET", "/users/me", token=second["access_token"])
        assert status == 200, "Other login was incorrectly revoked"
        status, second = request(
            "POST", "/auth/refresh", {"refresh_token": second["refresh_token"]}
        )
        assert status == 200
        status, _ = request("POST", "/auth/logout", {"refresh_token": second["refresh_token"]})
        assert status == 200
        status, _ = request("GET", "/users/me", token=second["access_token"])
        assert status == 401, "Logout did not revoke access"
        status, _ = request("POST", "/auth/refresh", {"refresh_token": second["refresh_token"]})
        assert status == 401, "Logout did not revoke refresh"
        print("PASS: public signup/login/rotation/replay/isolation/logout")
    finally:
        if created:
            status, cleanup = request("POST", "/auth/login", credentials)
            assert status == 200, "Could not sign in to remove temporary test account"
            status, _ = request("DELETE", "/users/me", token=cleanup["access_token"])
            assert status == 200, "Could not remove temporary test account"
            print("PASS: temporary account deleted")


if __name__ == "__main__":
    main()
