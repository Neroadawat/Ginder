"""Bounded, explicit inputs for restaurant administration."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CATEGORIES = [
    "Thai",
    "Japanese",
    "Korean",
    "Chinese",
    "Italian",
    "Indian",
    "Fast Food",
    "Cafe",
    "Dessert",
    "Food Court",
    "Steak",
    "Hot Pot",
    "Other",
]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class OpeningPoint(StrictInput):
    day: int = Field(ge=0, le=6)
    time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3])[0-5][0-9]$")


class OpeningPeriod(StrictInput):
    open: OpeningPoint
    close: OpeningPoint | None = None

    @model_validator(mode="after")
    def valid_window(self):
        if self.close is None:
            if self.open.day != 0 or self.open.time != "0000":
                raise ValueError("Always-open hours must start Sunday at 0000")
        elif self.open == self.close:
            raise ValueError("Opening and closing points must differ")
        return self


class OpeningHours(StrictInput):
    periods: list[OpeningPeriod] = Field(max_length=28)

    @model_validator(mode="after")
    def unambiguous_always_open(self):
        if len(self.periods) > 1 and any(period.close is None for period in self.periods):
            raise ValueError("Always-open hours cannot be mixed with other periods")
        return self


class RestaurantEdit(StrictInput):
    expected_version: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=255)
    primary_category: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str | None = Field(default=None, max_length=2000)
    price_level: int | None = Field(default=None, ge=0, le=4)
    opening_hours: OpeningHours | None = None
    admin_notes: str | None = Field(default=None, max_length=4000)
    reviewed: bool = False

    @model_validator(mode="after")
    def known_category(self):
        if self.primary_category not in CATEGORIES:
            raise ValueError("Select a supported category")
        return self


class PhotoMetadata(StrictInput):
    expected_version: int = Field(ge=1)
    attribution: str = Field(min_length=1, max_length=500)
    source: Literal["owner_upload", "permission_granted"]
    rights_confirmed: Literal[True]


class VersionInput(StrictInput):
    expected_version: int = Field(ge=1)
