"""
Location tool — interface prepared for Part 5.
Actual browser geolocation is supplied by the frontend via WebSocket.
"""
from pydantic import BaseModel
from typing import Optional


class LocationResult(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


# Tool will be wired into LangGraph in a later part.
# The frontend sends location via the WebSocket event:
# {"type": "location.update", "latitude": ..., "longitude": ...}
