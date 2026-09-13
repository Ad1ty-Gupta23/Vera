"""
Directions tool — interface prepared for Part 5.
Google Directions API calls will be implemented here.
"""
from pydantic import BaseModel
from typing import Optional


class DirectionsInput(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination: str          # address or place_id
    mode: str = "driving"     # driving | walking | transit


class DirectionsResult(BaseModel):
    summary: str
    distance_text: str
    duration_text: str
    steps: list[str]
    polyline: Optional[str] = None


# Tool will be wired into LangGraph in a later part.
# async def get_directions(input: DirectionsInput) -> DirectionsResult: ...
