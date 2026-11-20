"""Backend of the 67 Challenge: stores scores and serves the top 10.

Run from backend/:
    uv run uvicorn scores:create_app --factory --reload --port 8001
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

# Default database file: backend/instance/scores.sqlite (created on first start).
INSTANCE = Path(__file__).resolve().parent.parent / "instance"
DEFAULT_DATABASE_URL = f"sqlite:///{(INSTANCE / 'scores.sqlite').as_posix()}"

# The React dev server (vite.config.js uses port 5175).
FRONTEND_ORIGINS = ["http://localhost:5175", "http://127.0.0.1:5175"]

# Upper bound on a score: 30 s of play cannot honestly give more than this.
MAX_POINTS = 1000


# ---------- Database model (SQLAlchemy) ----------

class Base(DeclarativeBase):
    pass


class Score(Base):
    __tablename__ = "score"

    id: Mapped[int] = mapped_column(primary_key=True)
    player: Mapped[str]
    character: Mapped[str]
    points: Mapped[int]
    created_at: Mapped[str] = mapped_column(
        default=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------- HTTP contract (Pydantic) ----------

# Name typed by the player: spaces trimmed, 1 to 20 characters, must be a string.
PlayerName = Annotated[str, StringConstraints(
    strip_whitespace=True, min_length=1, max_length=20, strict=True,
)]


class ScoreCreate(BaseModel):
    """Body of POST /scores/. Unknown fields are refused (422)."""
    model_config = ConfigDict(extra="forbid")

    player: PlayerName
    character: Literal["gazmou", "tracto"]
    points: Annotated[int, Field(ge=0, le=MAX_POINTS, strict=True)]


class ScoreRead(BaseModel):
    """What the API sends back. from_attributes reads a Score ORM object."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    player: str
    character: str
    points: int
    created_at: str


# ---------- Application factory ----------

def create_app(database_url: str | None = None) -> FastAPI:
    if database_url is None:
        INSTANCE.mkdir(parents=True, exist_ok=True)
        database_url = DEFAULT_DATABASE_URL

    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)  # create the table if it does not exist yet

    app = FastAPI(title="67 Challenge API", version="1.0")
    app.state.engine = engine  # kept so tests can dispose() it
    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    def get_session():
        with Session(engine) as session:
            yield session

    DatabaseSession = Annotated[Session, Depends(get_session)]

    @app.get("/scores/", response_model=list[ScoreRead])
    def list_scores(session: DatabaseSession):
        """Top 10: highest points first; on a tie, the earliest score wins."""
        query = select(Score).order_by(Score.points.desc(), Score.id).limit(10)
        return session.scalars(query).all()

    @app.post("/scores/", response_model=ScoreRead, status_code=201)
    def save_score(data: ScoreCreate, session: DatabaseSession):
        score = Score(**data.model_dump())
        session.add(score)
        session.commit()
        session.refresh(score)
        return score

    return app
