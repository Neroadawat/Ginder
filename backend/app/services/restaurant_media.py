"""Validate and re-encode images; access only the configured private S3 bucket."""

import io
import warnings
from functools import lru_cache

import boto3
from botocore.config import Config
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings


def prepare_photo(raw: bytes) -> bytes:
    if not raw or len(raw) > settings.RESTAURANT_PHOTO_MAX_BYTES:
        raise HTTPException(413, "Choose an image no larger than 5 MiB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as original:
                if original.format not in {"JPEG", "PNG", "WEBP"} or getattr(
                    original, "is_animated", False
                ):
                    raise HTTPException(422, "Use a still JPG, PNG or WebP image")
                if original.width * original.height > 25_000_000:
                    raise HTTPException(422, "Image must contain at most 25 million pixels")
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((1600, 1600))
                # Construct a fresh image so EXIF, GPS and embedded profiles are not retained.
                clean = Image.new("RGB", image.size)
                clean.paste(image)
                output = io.BytesIO()
                clean.save(output, "WEBP", quality=85)
                return output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ):
        raise HTTPException(422, "This image cannot be read; choose another file") from None


@lru_cache(maxsize=4)
def _client(region: str):
    return boto3.client(
        "s3",
        region_name=region,
        config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
    )


class RestaurantMedia:
    def __init__(self):
        if not settings.RESTAURANT_PHOTO_BUCKET:
            raise HTTPException(503, "Restaurant photo storage has not been configured")
        self.bucket = settings.RESTAURANT_PHOTO_BUCKET
        self.client = _client(settings.RESTAURANT_PHOTO_REGION)

    def put(self, key: str, image: bytes) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=image,
            ContentType="image/webp",
            ServerSideEncryption="AES256",
            CacheControl="public, max-age=300",
        )

    def get(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        body = response["Body"]
        try:
            content = body.read(8 * 1024 * 1024 + 1)
            if len(content) > 8 * 1024 * 1024:
                raise HTTPException(502, "Stored image is too large")
            return content
        finally:
            body.close()

    def delete(self, key: str) -> None:
        # Keys originate from this service, never from a user-supplied URL or path.
        if not key.startswith("restaurants/") or ".." in key:
            raise ValueError("Invalid restaurant media key")
        self.client.delete_object(Bucket=self.bucket, Key=key)
