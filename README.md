![PlanBoard](assets/ascii-art-text.png)

---

A self-hosted, Jira-like ticketing and project management tool for personal/small-team
use, designed to run on a home Linux mini PC and be accessed over the local network.

**Status:** Phase 1 (project scaffolding) — auth, tickets, and other features land in
later phases.

## Tech Stack

- Backend: FastAPI (Python) + SQLAlchemy + Alembic, PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- Deployment: Docker Compose

## Prerequisites

- Docker and Docker Compose installed on the machine that will run PlanBoard (the mini PC,
  or your dev machine while developing).

## Local Setup

1. Copy the environment file and fill in real values:

   ```
   cp .env.example .env
   ```

   At minimum, change `POSTGRES_PASSWORD` and `JWT_SECRET`. Generate a secret with:

   ```
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

2. Start everything:

   ```
   docker-compose up --build
   ```

3. Visit the frontend at `http://localhost:5173` (or whatever `FRONTEND_PORT` you set).
   The backend API is at `http://localhost:8000`, with interactive docs at
   `http://localhost:8000/docs`.

## Deploying on the Mini PC (LAN access)

1. Find the mini PC's LAN IP address:

   ```
   ip addr show
   ```

   (look for the `inet` address on your LAN interface, e.g. `192.168.1.50`).

2. In `.env` on the mini PC, set:

   ```
   CORS_ORIGIN=http://<mini-pc-ip>:<FRONTEND_PORT>
   VITE_API_BASE_URL=http://<mini-pc-ip>:<BACKEND_PORT>
   ```

3. Run `docker-compose up -d --build` on the mini PC.

4. From any other device on the same network, browse to
   `http://<mini-pc-ip>:<FRONTEND_PORT>`.

   Tip: give the mini PC a DHCP reservation on your router so its LAN IP doesn't
   change and break the URLs above.

**Note:** this app is served over plain HTTP on your LAN, which is expected for a
home setup. If you ever want to access it from outside your LAN, put a reverse proxy
(e.g. Caddy) in front of it with a real TLS certificate — that's not set up yet, but
nothing here blocks adding it later.

## Creating the First Superadmin

1. In `.env`, set `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` (min. 8 characters).
2. With the stack running, seed the account:

   ```
   docker compose exec backend python /scripts/seed_superadmin.py
   ```

3. Log in at the frontend URL with those credentials. The script is idempotent —
   safe to re-run; it does nothing if a superadmin already exists.
4. Apply database migrations before first use (and after pulling any update that
   adds a migration):

   ```
   docker compose exec backend alembic upgrade head
   ```

## Permissions

See [PERMISSIONS.md](./PERMISSIONS.md) for the role/permission matrix that every
backend route enforces.
