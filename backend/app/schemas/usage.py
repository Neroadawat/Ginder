"""External API quota status payloads."""

from pydantic import BaseModel


class OperationUsageResponse(BaseModel):
    operation: str
    count: int
    soft_limit: int
    hard_limit: int
    soft_limit_reached: bool
    hard_limit_reached: bool


class GoogleUsageResponse(BaseModel):
    period: str
    enabled: bool
    nearby_search: OperationUsageResponse
    place_photo: OperationUsageResponse
