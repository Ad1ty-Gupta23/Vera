import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    # "free" | "business" — Stage 5 (subscriptions table) will make this
    # richer (status, renewal dates, provider ids); this column stays as a
    # fast, denormalized "what should the UI route this user to" flag.
    plan = Column(String, nullable=False, default="free")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
