"""
Incident tool — interface prepared for Part 5.
Incident logging and context persistence will be implemented here.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class IncidentRecord(BaseModel):
    session_id: str
    intent: str
    urgency: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime = None

    def model_post_init(self, __context):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


# Tool will be wired into LangGraph in a later part.
# async def log_incident(record: IncidentRecord) -> str: ...
