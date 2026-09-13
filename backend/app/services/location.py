from pydantic import BaseModel, field_validator
from typing import Optional


class LocationState(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    source: str = "browser"  # "browser" | "user_provided"

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError(f"Invalid latitude: {v}. Must be between -90 and 90.")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError(f"Invalid longitude: {v}. Must be between -180 and 180.")
        return v


def parse_location(data: dict) -> LocationState:
    """Parse and validate a location dict from the WebSocket message."""
    loc_data = data.get("location", data)  # support both nested and flat
    return LocationState(
        latitude=float(loc_data["latitude"]),
        longitude=float(loc_data["longitude"]),
        accuracy=loc_data.get("accuracy"),
        source=loc_data.get("source", "browser"),
    )
