# 67 Challenge

Tape **6** puis **7**, encore et encore : chaque « 67 » rapporte 1 point.
30 secondes ; deux 6 ou deux 7 de suite font perdre. Le score est enregistré
dans SQLite et le Top 10 s'affiche à côté du jeu.

Canvas (jeu) · React (formulaire, résultat, classement) · FastAPI + SQLAlchemy + SQLite (scores).

## Prérequis

- Python 3.12 avec [uv](https://docs.astral.sh/uv/)
- Node.js ≥ 22.12

## Lancer

Terminal 1 — backend (port 8001) :

```sh
cd backend
uv sync --locked
uv run pytest -q          # 17 passed
uv run uvicorn scores:create_app --factory --reload --port 8001
```

Terminal 2 — frontend (port 5175) :

```sh
cd frontend
npm ci
npm test                  # 18 tests passent
npm run dev
```

Ouvrir http://127.0.0.1:5175.

La base de données est créée automatiquement dans `backend/instance/scores.sqlite`.
Les tests utilisent un fichier temporaire et ne touchent jamais cette base.

## Images des personnages

Déposer 4 fichiers PNG dans `frontend/public/characters/` :

| Fichier | Affiché quand… |
|---|---|
| `gazmou-6.png` | Gazmou, dernière touche = 6 |
| `gazmou-7.png` | Gazmou, au départ et dernière touche = 7 |
| `tracto-6.png` | Tracto, dernière touche = 6 |
| `tracto-7.png` | Tracto, au départ et dernière touche = 7 |

Sans image, le jeu dessine une carte colorée avec le chiffre et le nom.

## Organisation

```
frontend/src/game.js      règles pures : newGame(), press(), tick() — testées sans navigateur
frontend/src/canvas.js    dessin, clavier, boucle requestAnimationFrame, destroy()
frontend/src/main.jsx     React : formulaire, <canvas>, sauvegarde, classement
frontend/src/api.js       fetch vers le backend, erreurs lisibles
backend/scores/__init__.py  create_app(), modèle Score, GET/POST /scores/
```

## API

- `GET /scores/` → Top 10, du plus haut au plus bas (égalité : le plus ancien d'abord)
- `POST /scores/` body `{"player": "Samira", "character": "gazmou", "points": 12}` → 201
  - `player` : 1 à 20 caractères (espaces retirés) ; `character` : `gazmou` ou `tracto` ;
    `points` : entier de 0 à 1000. Sinon 422 et rien n'est enregistré.
- Documentation interactive : http://127.0.0.1:8001/docs

## Limites connues

- Le serveur valide le **format** du score, mais ne peut pas prouver qu'une partie a
  réellement été jouée : une requête fabriquée à la main peut envoyer un faux score
  (dans les bornes 0–1000).
- Pas de comptes : deux joueurs peuvent utiliser le même nom.
