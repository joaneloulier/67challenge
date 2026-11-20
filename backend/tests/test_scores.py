import pytest
from fastapi.testclient import TestClient

from scores import create_app


@pytest.fixture
def make_app(tmp_path):
    """Builds apps on a temporary SQLite file, never the personal database."""
    url = f"sqlite:///{(tmp_path / 'test.sqlite').as_posix()}"
    apps = []

    def make():
        app = create_app(url)
        apps.append(app)
        return app

    yield make
    for app in apps:
        app.state.engine.dispose()  # release the file (needed on Windows)


@pytest.fixture
def client(make_app):
    with TestClient(make_app()) as client:
        yield client


def score(player="Samira", character="gazmou", points=12):
    return {"player": player, "character": character, "points": points}


def test_list_starts_empty(client):
    response = client.get("/scores/")
    assert response.status_code == 200
    assert response.json() == []


def test_score_round_trip(client):
    response = client.post("/scores/", json=score(player="  Samira  "))
    assert response.status_code == 201
    saved = response.json()
    assert saved["player"] == "Samira"  # spaces trimmed
    assert saved["character"] == "gazmou"
    assert saved["points"] == 12
    assert isinstance(saved["id"], int)
    assert client.get("/scores/").json() == [saved]


@pytest.mark.parametrize("body", [
    {},
    score(player=""),
    score(player="   "),
    score(player="x" * 21),
    score(player=12),
    score(character="mario"),
    score(points=-1),
    score(points=1001),
    score(points="12"),
    score(points=1.5),
    {**score(), "id": 99},
    [],
])
def test_invalid_score_is_refused_and_not_saved(client, body):
    response = client.post("/scores/", json=body)
    assert response.status_code == 422
    assert client.get("/scores/").json() == []


def test_leaderboard_is_top_10_highest_first(client):
    for points in [5, 30, 12, 30, 1, 2, 3, 4, 6, 7, 8, 9]:
        client.post("/scores/", json=score(player=f"p{points}", points=points))
    rows = client.get("/scores/").json()
    assert len(rows) == 10
    assert [row["points"] for row in rows] == [30, 30, 12, 9, 8, 7, 6, 5, 4, 3]
    # On a tie, the score saved first comes first.
    assert rows[0]["id"] < rows[1]["id"]


def test_scores_survive_a_restart(make_app):
    with TestClient(make_app()) as first:
        saved = first.post("/scores/", json=score()).json()
    with TestClient(make_app()) as second:
        assert second.get("/scores/").json() == [saved]


def test_cors_allows_the_frontend_only(client):
    allowed = client.get("/scores/", headers={"Origin": "http://localhost:5175"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5175"
    other = client.get("/scores/", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in other.headers
