# Satellite

Production-oriented geospatial workspace platform combining SaaS project operations, team collaboration, and Copernicus satellite imagery in a unified web application.

Satellite provides a modern operational workspace for teams that need:
- authenticated multi-user collaboration
- project and task management
- calendar planning
- administrative tooling
- Earth observation workflows
- map-based satellite visualization

Built with FastAPI, React, PostgreSQL, Redis, Celery, and Copernicus Data Space integrations, the platform combines operational SaaS infrastructure with geospatial analytics capabilities in a single extensible system.

---

# Core Capabilities

- Secure authentication and session management
- Project and task operations
- Calendar and planning workflows
- Notification and activity systems
- Copernicus satellite imagery rendering
- Cached Earth observation asset delivery
- Admin and platform management
- API key and webhook infrastructure
- S3-compatible object storage
- Redis-backed caching and background jobs

> Status: active development platform with production-oriented backend architecture and ongoing deployment and infrastructure hardening.

---

# Why This Platform Exists

Many organizations use disconnected tools for:
- project operations
- team collaboration
- task planning
- notifications
- Earth observation workflows
- satellite imagery delivery
- platform administration

Satellite centralizes these workflows into a single operational platform designed for geospatial products and Earth observation applications.

The goal is to provide a reusable foundation for:
- geospatial SaaS products
- satellite imagery platforms
- operational dashboards
- Earth observation tooling
- internal GIS workspaces
- infrastructure monitoring systems

---

# Screenshots

> Add real screenshots or demo GIFs here.

| Dashboard | Satellite Viewer |
|---|---|
| Add screenshot | Add screenshot |

| Project Board | Admin Panel |
|---|---|
| Add screenshot | Add screenshot |

---

# System Architecture

```text
React + Vite Frontend
            |
            | HTTP + JWT access token
            | Refresh cookie session
            v
FastAPI Backend API (/api/v1)
            |
            +-- Authentication and sessions
            +-- Project and task management
            +-- Notification services
            +-- Satellite imagery workflows
            +-- Platform administration
            |
            +-- PostgreSQL
            +-- Redis cache
            +-- Celery workers
            +-- S3-compatible object storage
            +-- Copernicus Data Space APIs
```

The backend is modularized by domain under `backend/modules`, with independently organized modules for authentication, projects, calendar workflows, satellite integrations, platform management, and administration.

---

# System Design Highlights

- Modular FastAPI backend architecture
- Async PostgreSQL access with SQLAlchemy
- Redis-backed caching and session state
- Celery-based background processing
- Cached Copernicus imagery rendering
- Secure refresh-session authentication
- S3-compatible object storage abstraction
- Configurable platform modules and feature flags
- Containerized local infrastructure stack

---

# Key Features

## Authentication and Security

- Sign-up and sign-in
- Refresh token sessions
- Email verification
- Password reset flows
- Multi-factor authentication
- Session management
- Secure cookie support
- Role-aware administration

## Workspace and Collaboration

- User dashboards
- Profile management
- Avatar uploads
- User directory
- Notification preferences
- Assignment notifications
- Due-date notifications

## Projects and Task Operations

- Project CRUD operations
- Task boards
- Task assignment
- Priority and status tracking
- Due-date management
- Task reordering
- Calendar integration

## Satellite and Geospatial Workflows

- Copernicus Data Space integration
- Satellite imagery rendering
- Latest-image workflows
- XYZ tile serving
- Imagery asset caching
- Satellite asset delivery APIs
- Country and imagery map views

## Platform Infrastructure

- Billing-plan metadata
- Subscription configuration
- API key management
- Webhook management
- Feature flags
- Email templates
- Audit logging
- Platform metrics

---

# Example Use Cases

- Satellite imagery dashboards
- Earth observation portals
- Infrastructure monitoring platforms
- Agricultural monitoring systems
- Internal GIS workspaces
- Project operations systems
- Team collaboration platforms
- Geospatial SaaS products

---

# Tech Stack

| Layer | Technologies |
|---|---|
| Backend API | FastAPI, Uvicorn, Pydantic Settings |
| Database | PostgreSQL, SQLAlchemy async, Alembic |
| Cache & Jobs | Redis, Celery |
| Authentication | JWT, Argon2, MFA, secure refresh sessions |
| Storage | MinIO, S3-compatible object storage |
| Satellite Services | Copernicus Data Space APIs |
| Frontend | React, TypeScript, Vite, MUI |
| Mapping | Leaflet, MapLibre GL, OpenStreetMap |
| Observability | Structured logging, Sentry, OpenTelemetry |
| Testing | unittest, Vitest, Playwright |
| Local Infrastructure | Docker Compose |

---

# Repository Structure

```text
backend/
├── api/                 # FastAPI app and API routing
├── core/                # config, security, storage, telemetry
├── db/                  # database engine and models
├── modules/             # auth, projects, calendar, satellite, admin
├── workers/             # Celery workers and background jobs
├── alembic/             # database migrations
└── tests/               # backend tests

frontend/
├── src/api/             # typed API clients
├── src/app/             # router and providers
├── src/components/      # shared UI components
├── src/features/        # feature modules
├── src/pages/           # application routes
└── package.json

infra/
└── docker-compose.yml   # PostgreSQL, Redis, MinIO
```

---

# Quick Start

## Clone the Repository

```bash
git clone <repo-url>
cd satellite
```

## Start Infrastructure Services

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Run Backend

```bash
uvicorn backend.api.main:app --reload --port 8000
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:
- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`

---

# Local Development Setup

## Backend Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Optional `uv` workflow:

```bash
cd backend
uv sync
```

## Frontend Setup

```bash
cd frontend
npm install
```

## Environment Files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Apply Database Migrations

```bash
alembic -c backend/alembic.ini upgrade head
```

## Start Development Stack

```bash
make local-dev
```

This starts:
- FastAPI backend
- Celery worker
- Redis
- Frontend Vite server

---

# Environment Variables

## Backend

Important backend variables include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL database connection |
| `REDIS_URL` | Redis cache and Celery backend |
| `JWT_SECRET` | JWT signing secret |
| `FRONTEND_URL` | Allowed frontend origin |
| `SMTP_*` | Email delivery configuration |
| `STORAGE_*` | S3/MinIO storage configuration |
| `COPERNICUS_*` | Copernicus credentials and rendering config |
| `SENTRY_DSN` | Optional Sentry monitoring |

## Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Backend API base URL |
| `VITE_SATELLITE_API_BASE` | Satellite API base |
| `VITE_DEFAULT_COUNTRY` | Default map country |
| `VITE_MAP_STYLE_URL` | Optional MapLibre style |
| `VITE_BASEMAP_TILE_URL` | Tile provider URL |

---

# API Overview

Base URL:

```text
/api/v1
```

FastAPI interactive documentation:
- `/docs`
- `/openapi.json`

Main route groups:

| Area | Routes |
|---|---|
| Health | `/live`, `/ready`, `/version` |
| Authentication | `/auth/*` |
| Users | `/users/*` |
| Projects | `/projects/*` |
| Tasks | `/projects/{project_id}/tasks/*` |
| Calendar | `/calendar/*` |
| Notifications | `/notifications/*` |
| Satellite | `/satellite/*` |
| Platform | `/platform/*` |
| Admin | `/admin/*` |

---

# Main Application Routes

| Route | Purpose |
|---|---|
| `/` | Authentication landing page |
| `/dashboard` | Main workspace dashboard |
| `/copernicus` | Satellite imagery workflows |
| `/projects` | Project management |
| `/calendar` | Calendar and planning |
| `/profile` | User profile |
| `/notifications` | Notification center |
| `/admin/users` | User administration |
| `/admin/platform` | Platform administration |

---

# Example Workflows

## Render Copernicus Satellite Imagery

1. Configure `COPERNICUS_*` credentials.
2. Start backend and Redis.
3. Open `/copernicus`.
4. Select imagery parameters and request a render.
5. The backend retrieves, caches, and serves imagery assets.

## Manage Team Projects

1. Create a project.
2. Add tasks and assign team members.
3. Track task progress through status columns.
4. Receive notifications for assignments and due dates.

## Configure Platform Features

1. Create an admin account.
2. Open `/admin/platform`.
3. Configure:
    - feature flags
    - billing metadata
    - webhooks
    - API keys
    - email templates

---

# Current Capabilities

- Secure authentication
- Project and task management
- Calendar planning
- Satellite imagery rendering
- Tile and asset serving
- Notifications and alerts
- Admin management
- Redis-backed caching
- Object storage integration

---

# Planned / Experimental

- Advanced geospatial analytics
- Additional Earth observation providers
- Infrastructure monitoring modules
- AI-assisted imagery analysis
- Multi-tenant deployment workflows
- Production deployment automation
- CI/CD pipelines

---

# Running Tests

## Backend

```bash
python -m unittest discover backend/tests
```

## Frontend

```bash
cd frontend
npx vitest run
```

## Playwright

```bash
cd frontend
npx playwright test
```

---

# Security Notes

- Replace all development secrets before deployment
- Use HTTPS in production
- Keep Copernicus and SMTP credentials outside source control
- Restrict CORS origins in production
- Use secure refresh cookies in deployed environments
- Store storage credentials in managed secret systems
- Disable debug tooling outside local development

---

# Known Limitations

- Docker Compose currently provisions infrastructure services only
- CI/CD workflows are not yet implemented
- Production deployment steps are not yet documented
- Copernicus imagery requires external credentials
- Playwright configuration exists, but end-to-end tests are limited
- Screenshot/demo assets are not yet included
- License and maintainer details are not yet documented

---

# License

License not yet documented.

Add a `LICENSE` file before publishing or distributing the project.

---

# Contact

Add maintainer details, organization information, and support channels before public release.