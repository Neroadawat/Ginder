"""Verify exact S3 bucket/key scope without contacting AWS."""

import io

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber
from fastapi import HTTPException

from app.core.config import settings
from app.services import restaurant_media


def test_media_requires_explicit_bucket_before_constructing_a_client(monkeypatch):
    monkeypatch.setattr(settings, "RESTAURANT_PHOTO_BUCKET", "")
    with pytest.raises(HTTPException) as error:
        restaurant_media.RestaurantMedia()
    assert error.value.status_code == 503


def test_s3_upload_read_delete_use_only_the_configured_restaurant_bucket(monkeypatch):
    client = boto3.client(
        "s3",
        region_name="ap-southeast-2",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    monkeypatch.setattr(settings, "RESTAURANT_PHOTO_BUCKET", "new-ginder-test-only")
    monkeypatch.setattr(restaurant_media, "_client", lambda _region: client)
    image = b"already-converted-webp"
    key = "restaurants/restaurant-id/photo-id.webp"
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            {
                "Bucket": "new-ginder-test-only",
                "Key": key,
                "Body": image,
                "ContentType": "image/webp",
                "ServerSideEncryption": "AES256",
                "CacheControl": "public, max-age=300",
            },
        )
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(image), len(image))},
            {
                "Bucket": "new-ginder-test-only",
                "Key": key,
            },
        )
        stub.add_response("delete_object", {}, {"Bucket": "new-ginder-test-only", "Key": key})
        media = restaurant_media.RestaurantMedia()
        media.put(key, image)
        assert media.get(key) == image
        media.delete(key)
        stub.assert_no_pending_responses()
        with pytest.raises(ValueError):
            media.delete("unrelated-project/private-file")
