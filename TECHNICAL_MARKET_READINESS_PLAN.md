# Technical Market Readiness Plan

## 1. What the app is today
- Fact: this is a full-stack monorepo with a FastAPI backend and a React/Vite frontend. The root README describes PostgreSQL, Redis, MinIO, Celery, JWT auth, admin settings, notifications, profile, projects, and optional platform modules for billing, API keys, webhooks, feature flags, and email templates (`README.md`, `backend/pyproject.toml`, `frontend/package.json`).
- Fact: the backend is a modular monolith. FastAPI mounts module routers for `auth`, `calendar`, `users`, `profile`, `projects`, `notifications`, `platform`, `settings`, `satellite`, and `admin` under `/api/v1` (`backend/api/router.py`). Persistence is SQLAlchemy async with Redis cache and token storage, Celery for async jobs, and S3-compatible object storage (`backend/db/session.py`, `backend/core/cache.py`, `backend/workers/celery_app.py`, `backend/core/storage.py`).
- Fact: the frontend is a route-based SPA using React Router, TanStack Query, MUI, React Hook Form, Zod, and Leaflet/MapLibre for geospatial UI (`frontend/src/app/router.tsx`, `frontend/src/config/queryClient.ts`, `frontend/package.json`).
- Fact: the critical user path today is:
  1. sign in or sign up with email/password and refresh-cookie auth (`backend/modules/identity_access/router.py`, `frontend/src/pages/AuthHomePage.tsx`)
  2. land in a dashboard with projects, notifications, account health, and calendar (`frontend/src/pages/DashboardPage.tsx`)
  3. work inside a single-owner project/task workspace (`backend/modules/projects/models.py`, `frontend/src/pages/ProjectDetailPage.tsx`)
  4. optionally use the Copernicus workspace to request latest imagery over a Belgium-first viewport (`frontend/src/features/dashboard/SatelliteDashboard.tsx`, `backend/modules/copernicus/router.py`, `backend/modules/copernicus/service.py`)
  5. optionally configure platform services such as plans, API keys, webhooks, feature flags, and templates (`frontend/src/pages/PlatformPage.tsx`, `frontend/src/pages/AdminPlatformPage.tsx`, `backend/modules/platform/router.py`).
- Fact: the repo still carries strong starter-template DNA. The frontend README is the default Vite template, PWA manifest strings are still `My App`/`App`, and there is no product-specific top-level architectural documentation (`frontend/README.md`, `frontend/vite.config.ts`).
- Current architecture summary: modular monolith backend plus SPA frontend, with Redis-backed auth and Copernicus caches, Celery-backed email, and optional platform primitives exposed through both admin and end-user UI.
- Current maturity level: **MVP**. It has more infrastructure than a prototype, but it is not yet an early-production product because testing, delivery automation, multi-user governance, operational controls, and customer trust features are still incomplete.

## 2. Technical strengths already present
- The backend has a sensible modular shape for an MVP-stage product. Domain modules are separated cleanly enough that future hardening can happen without a rewrite (`backend/modules/*`, `backend/api/router.py`).
- Auth is better than average for this stage: refresh-session rotation, hashed refresh tokens, HTTP-only cookies, password hashing with Argon2, verification flows, password reset, and MFA endpoints already exist (`backend/core/security.py`, `backend/modules/identity_access/service.py`, `backend/modules/identity_access/router.py`).
- The Copernicus integration is not a toy fetch wrapper. It has token caching, search/render/asset caching, scene selection, render profile versioning, and a separate compatibility router (`backend/modules/copernicus/service.py`, `backend/modules/copernicus/repository.py`, `backend/tests/test_copernicus_builder.py`).
- The platform module is strategically useful. Plans, API keys, webhooks, feature flags, email templates, and module packs provide a credible base for packaging, upsell, white-labeling, and future integrations (`backend/modules/platform/service.py`, `backend/modules/platform/models.py`, `frontend/src/pages/PlatformPage.tsx`, `frontend/src/pages/AdminPlatformPage.tsx`).
- The frontend has decent UX fundamentals for an MVP: route-level lazy loading, query caching, mobile-aware layouts, form validation, and a coherent UI system (`frontend/src/app/router.tsx`, `frontend/src/config/queryClient.ts`, `frontend/src/app/theme.ts`).
- Operational hooks exist, even if not fully closed-loop yet: request logging middleware, correlation IDs, Sentry/OpenTelemetry initialization, Redis, Celery retries, and MinIO-backed uploads (`backend/api/middleware/request_logging.py`, `backend/api/middleware/correlation_id.py`, `backend/core/telemetry.py`, `backend/workers/tasks.py`, `backend/core/storage.py`).
- The local developer story is coherent for a small team: Docker Compose for infra, uv-managed backend, Vite frontend, and a small test baseline that passes on the backend (`infra/docker-compose.yml`, `backend/pyproject.toml`, `backend/tests/*`).

## 3. Technical weaknesses and production risks
- Fragile product positioning:
  - Fact: the repo markets itself as `Generic App` while the frontend presents a Belgium-first Copernicus workspace and a generic work-management shell at the same time (`README.md`, `frontend/src/features/dashboard/SatelliteDashboard.tsx`).
  - Risk: this dilutes buyer confidence because the product category is not yet technically committed. It reads like a configurable starter plus a satellite demo rather than a focused market-ready product.
- Frontend trust and production gaps:
  - Fact: frontend testing is effectively absent. There is one Vitest test, no `test` script in `package.json`, no `e2e` specs despite Playwright config, and `npx vitest run` currently fails because `jsdom` is missing (`frontend/src/api/client.test.ts`, `frontend/playwright.config.ts`, `frontend/package.json`).
  - Fact: there is no frontend telemetry, error boundary, analytics, session replay, or customer-visible status/incident surface. A repo-wide search found no Sentry/PostHog/DataDog/browser instrumentation in frontend code.
  - Fact: the build succeeds but produces large chunks, including a `mui` chunk over 500 kB and a `CopernicusPage` chunk around 250 kB, which will hurt first-load performance on mid-range devices (`frontend/vite.config.ts`, build output).
- Security and governance gaps:
  - Fact: MFA exists only as backend endpoints. The frontend merely displays `mfa_enabled` and has no setup, verification, or recovery UX (`backend/modules/identity_access/router.py`, `frontend/src/pages/ProfilePage.tsx`).
  - Fact: API keys are generated and stored, but there is no backend auth path that accepts them for actual API access. They are currently more of an account artifact than a usable integration primitive (`backend/modules/platform/service.py`, repo search for `X-API-Key`/API key verification).
  - Fact: webhook secrets are stored and returned in plaintext to the UI on every fetch, not just at creation time (`backend/modules/platform/models.py`, `backend/modules/platform/router.py`, `frontend/src/pages/PlatformPage.tsx`).
  - Fact: admin config editing writes directly to `backend/.env` at runtime from the app (`backend/modules/settings/service.py`).
  - Risk: serious SMB and enterprise buyers will view plaintext secret exposure and runtime env mutation as unacceptable operational controls.
- Data model and scale risks:
  - Fact: the core work model is single-owner. `projects.owner_id` ties each project to one user, with no organization, team, workspace membership, or RBAC model (`backend/modules/projects/models.py`, `backend/modules/identity_access/models.py`).
  - Fact: user directory endpoints are global, not scoped to an organization (`backend/modules/users/router.py`).
  - Fact: there is no tenant boundary, no workspace isolation, and no role model beyond `is_admin`.
  - Risk: this blocks collaborative usage, enterprise deals, and any credible multi-user go-to-market beyond very small teams.
- Reliability gaps:
  - Fact: there is no formal deployment pipeline, no GitHub Actions, no app containerization, and no production-ready environment promotion flow visible in repo.
  - Fact: only email is offloaded to Celery. Webhooks are test-only and synchronous; there is no durable outbound event pipeline, retry queue, dead-lettering, or delivery history (`backend/workers/tasks.py`, `backend/modules/platform/service.py`).
  - Fact: audit storage exists, but audit logging is barely wired into behavior. The admin API can list audit logs, yet repo evidence shows almost no actual writes through `AuditRepository.log(...)` (`backend/modules/audit/repository.py`, repo search).
  - Fact: error handling is shallow. The global handler only covers `ValueError`, while most failure paths rely on generic FastAPI exceptions (`backend/core/error_handler.py`).
- Operational gaps:
  - Fact: no backup/recovery automation, no migration safety checks, no runbooks, no health dependencies beyond a basic health route, and no visible SLA/incident tooling.
  - Fact: observability is config-driven but optional and unverified. Sentry/OTLP setup is a no-op unless env vars are filled, and there are no dashboards, alerts, or SLOs in repo (`backend/core/telemetry.py`).
- UX/performance gaps:
  - Fact: Copernicus currently returns base64 `data_url` imagery in JSON responses and then renders it in-browser (`backend/modules/copernicus/service.py`, `frontend/src/api/satellite.ts`). That is acceptable for MVP convenience but expensive for repeated serious usage.
  - Fact: the geospatial UI is Belgium-only by default with one predefined country config (`frontend/src/config/countries.ts`).
  - Risk: prospects expecting saved AOIs, multiple geographies, historical comparisons, exports, overlays, and operational workflows will find the feature set thin.

## 4. Market-facing technical expectations
- Product category inference:
  - Fact: the repo combines project/task workflow software with a geospatial Copernicus imagery workspace and platform APIs.
  - Inference: the most plausible market category is an **earth observation operations workspace** or **satellite-enabled vertical SaaS** rather than a generic project management tool.
- What users in this category will expect:
  - Fast imagery loading, tile-based map interaction, and responsive AOI workflows.
  - Saved AOIs/projects, repeatable search criteria, historical comparisons, and export/download paths.
  - Clear integration options: API keys, webhooks, cloud delivery, and documentation.
  - Multi-user collaboration, roles, and account governance.
  - Observable reliability: job status, retries, logs, and traceable failures.
  - Strong trust signals: MFA, audit logs, usage controls, secret hygiene, incident visibility, and reliable support tooling.
- What buyers will use to compare products:
  - Official API surface and integration depth.
  - Reliability of long-running imagery/order/subscription workflows.
  - Team governance and billing/account controls.
  - Performance on real AOIs and real user devices.
  - Time-to-value: onboarding, sample datasets, templates, and guided setup.
- Live market evidence from official docs:
  - Sentinel Hub highlights OGC services, Process API, Catalog API, batch/statistical APIs, and GIS interoperability as normal platform expectations: `https://docs.sentinel-hub.com/api/latest/api/overview/`, `https://docs.sentinel-hub.com/api/latest/api/ogc/`, `https://docs.sentinel-hub.com/api/latest/api/process/`.
  - Planet documents cloud delivery, subscriptions, notifications/webhooks, tile services, usage-oriented APIs, and rate limits as first-class product capabilities: `https://docs.planet.com/develop/apis/`, `https://docs.planet.com/develop/apis/subscriptions/`, `https://docs.planet.com/develop/apis/subscriptions/notifications/`.
  - SkyWatch exposes governance, roles, projects, payment methods, orders, pricing, limits/error handling, webhooks, and API reference as expected buyer-facing surface area: `https://docs.skywatch.com/`.
  - UP42 exposes collection/order APIs and broader developer platform expectations around data access and workflow automation: `https://developer.up42.com/reference/listcollectionsv2`.
- What technical signals increase trust:
  - Team/workspace governance.
  - Documented limits, retries, and delivery guarantees.
  - Usage reports and billing clarity.
  - Immutable audit logs and event history.
  - Real webhook delivery logs and replay.
  - Browser and backend error visibility.
  - Secure secret handling and one-time secret reveal patterns.
- What missing signals reduce confidence:
  - No organization model.
  - No saved AOIs or durable geospatial workflows.
  - No documented reliability contract for webhooks/jobs.
  - No frontend monitoring.
  - No deployment maturity or release automation.
  - No credible end-to-end test suite.

## 5. Competitiveness gaps
| gap | why it matters | customer-visible or internal | likely competitor benchmark | business consequence if ignored |
| --- | --- | --- | --- | --- |
| No organization/workspace membership model | Serious buyers expect teams, not single-owner records | Customer-visible | SkyWatch exposes governance with users, roles, projects, and payment methods; enterprise geospatial tools are organization-centric | Blocks team adoption, procurement, and admin delegation |
| API keys are not a usable auth surface | Buyers value integrations only when they can automate against them | Customer-visible | Planet, SkyWatch, UP42, Sentinel Hub all expose real API programs | Weakens platform story and partner conversations |
| Webhooks are configuration-only, not an operational event system | Production buyers need delivery history, retries, replay, and clear contracts | Customer-visible | Planet documents webhook topics, ordering caveats, and retry behavior | Makes automation feel unsafe and incomplete |
| No saved AOIs, imagery history, or repeatable geospatial workflows | Satellite users need repeatability, not ad hoc single renders | Customer-visible | Sentinel Hub and Planet expose catalog, processing, tiles, subscriptions, and batch workflows | Product looks like a demo instead of an operations platform |
| Sparse tests and broken frontend test setup | Reliability claims are not credible without regression coverage | Internal with customer impact | Competitors may not expose tests, but serious products ship stable behavior | Support burden rises and roadmap velocity falls |
| Weak frontend observability and error handling | Silent UI failures destroy trust fast in operational software | Internal with customer impact | Strong SaaS products instrument browser errors and funnel breakdowns | Harder incidents, slower support, higher churn |
| Runtime `.env` editing from admin UI | Unsafe config mutation undermines security and ops credibility | Customer-visible to admins | Mature products separate secrets/config from app UI or use controlled config services | Enterprise buyers hesitate on security and change management |
| Plaintext webhook secret exposure on every read | Secret hygiene is a direct trust issue | Customer-visible | Mature systems show once, rotate, hash, and redact | Security reviews will flag the product quickly |
| Limited audit logging despite audit table | Compliance and troubleshooting need action trails | Customer-visible to admins | Serious products expose immutable audit trails for key actions | Slower investigations and weaker buyer trust |
| No CI/CD or containerized app deployment story | Deployment maturity is part of product credibility | Internal | Even small B2B products usually have repeatable build/test/deploy automation | Slows releases and increases outage risk |
| Frontend bundle weight is high | First impressions matter; geospatial users often work on constrained field laptops | Customer-visible | Competitors optimize tile/image-heavy apps aggressively | Slower adoption and poorer perceived quality |
| Generic branding/product narrative in repo | The product feels unfocused technically | Customer-visible in demos/docs | Strong competitors present a clear technical point of view | Harder sales conversations and weaker differentiation |

## 6. Recommended technical improvements
| recommendation | exact problem solved | customer impact | competitive necessity | revenue influence | risk reduction | effort | fit with current stack | recommendation priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Add organizations, memberships, and role-based access control | Replaces single-owner project model and global user directory with team-ready governance | 5 | 5 | 5 | 5 | 4 | 4 | P0 |
| Turn API keys into real programmatic authentication and scope them per org/user | Makes developer platform claims real instead of cosmetic | 5 | 5 | 4 | 4 | 3 | 5 | P0 |
| Build a durable outbound event system for webhooks with retries, delivery logs, and replay | Fixes the gap between webhook configuration and reliable automation | 5 | 5 | 4 | 5 | 4 | 4 | P0 |
| Add saved AOIs, imagery sessions, and repeatable Copernicus workflows | Converts the satellite module from one-off rendering into reusable operational value | 5 | 5 | 5 | 3 | 4 | 4 | P0 |
| Establish frontend + backend production observability | Adds browser error capture, request tracing, health metrics, and actionable incident visibility | 4 | 4 | 3 | 5 | 2 | 5 | P0 |
| Fix test discipline: frontend unit setup, API integration tests, and 3-5 critical Playwright journeys | Prevents regressions across auth, projects, Copernicus, and platform admin | 4 | 4 | 3 | 5 | 3 | 5 | P0 |
| Replace runtime `.env` mutation with controlled config management and secret redaction | Removes a major admin/security anti-pattern | 4 | 4 | 4 | 5 | 3 | 4 | P1 |
| Redesign secret handling for webhooks and API keys | Show once, rotate, redact, hash, and audit secret operations | 4 | 5 | 4 | 5 | 2 | 5 | P1 |
| Implement real audit logging for auth, admin, config, billing-plan, webhook, and task actions | Gives admins the trust and troubleshooting surface they expect | 4 | 4 | 4 | 4 | 3 | 5 | P1 |
| Introduce usage metering, quotas, and plan enforcement | Makes plans and commercial packaging credible | 5 | 4 | 5 | 3 | 4 | 4 | P1 |
| Reduce frontend bundle cost and optimize Copernicus payload strategy | Improves perceived speed and field usability | 4 | 4 | 3 | 3 | 2 | 5 | P1 |
| Add status surfaces for asynchronous work | Exposes job progress and failure for emails, imagery processing, and webhook delivery | 4 | 4 | 4 | 4 | 3 | 4 | P1 |
| Create an import/export and portability layer | Reduces switching risk and improves buyer confidence | 4 | 3 | 4 | 2 | 3 | 4 | P2 |
| Add release automation and a minimum containerized deployment path | Creates repeatable environments and lowers operational drag | 3 | 4 | 3 | 5 | 3 | 4 | P2 |

## 7. Customer-convincing feature additions
### 1. Team Workspaces and Roles
- User/buyer concern it addresses: “Can multiple analysts, ops staff, and admins use this safely together?”
- Why it helps win customers: it turns the product from a personal tool into a deployable team system.
- Minimum viable implementation: organizations, workspace membership, `owner/admin/member/viewer` roles, project scoping by org, invite flow, and org-scoped user directory.
- Dependency on technical foundations: RBAC, tenant-aware queries, org-level billing and audit logging.
- Success metric: percentage of active accounts with 2+ members; conversion from trial to paid team workspace.

### 2. Saved AOIs and Monitoring Runs
- User/buyer concern it addresses: “Will my team have to redraw and reconfigure searches every time?”
- Why it helps win customers: repeatability is a core trust signal in geospatial operations.
- Minimum viable implementation: save AOI geometry, date/layer presets, named monitoring views, recent imagery history, and rerun/compare actions.
- Dependency on technical foundations: org/workspace model, persisted AOI data model, Copernicus cache reuse, background processing for heavier jobs.
- Success metric: repeat-run rate per AOI; number of saved AOIs per active workspace.

### 3. Webhook Delivery Console
- User/buyer concern it addresses: “If we automate against this, how do we know deliveries worked?”
- Why it helps win customers: it de-risks integrations and shortens technical due diligence.
- Minimum viable implementation: delivery attempts table, status, latency, response code, payload preview, signature docs, replay button.
- Dependency on technical foundations: queued outbound events, persisted delivery log, retries, secret rotation.
- Success metric: webhook activation rate; support tickets related to failed integrations.

### 4. Real API Program with Docs and SDK Snippets
- User/buyer concern it addresses: “Can we integrate this into our own systems quickly?”
- Why it helps win customers: platform adoption often depends on engineering confidence, not just UI polish.
- Minimum viable implementation: API key auth, OpenAPI exposure, code samples, rate-limit headers, example workflows for projects/AOIs/imagery/webhooks.
- Dependency on technical foundations: API-key auth, quotas, usage logs, docs generation.
- Success metric: number of API keys used in production; API-driven workflows per account.

### 5. Audit Trail and Admin Activity Feed
- User/buyer concern it addresses: “Who changed what, when, and from where?”
- Why it helps win customers: this is a major trust accelerator for regulated and process-heavy buyers.
- Minimum viable implementation: write audit events for auth, user admin, config changes, task changes, webhook changes, and key rotations; expose filters in admin UI.
- Dependency on technical foundations: consistent audit event writes, correlation IDs, actor/resource metadata.
- Success metric: percentage of critical actions audited; mean time to resolve support issues.

### 6. Usage and Plan Controls
- User/buyer concern it addresses: “What happens when usage grows or another team joins?”
- Why it helps win customers: clarifies commercial boundaries and reduces sales friction.
- Minimum viable implementation: workspace usage dashboard, API usage counters, imagery request counts, soft quota warnings, plan entitlements.
- Dependency on technical foundations: org model, metering pipeline, enforceable plan checks.
- Success metric: expansion revenue, plan upgrade rate, quota overrun incidents.

## 8. Minimum credible production architecture
Describe:
- App architecture:
  - Keep the modular monolith. Do not split into microservices now.
  - Make `identity_access`, `projects`, `copernicus`, `platform`, `admin`, and `settings` the primary bounded contexts.
  - Add an `organizations` module and refactor project/platform ownership from `user_id` to `organization_id` with membership tables.
- Data layer:
  - PostgreSQL remains the system of record.
  - Redis remains for short-TTL auth, rate limiting, and Copernicus cache.
  - Add persisted tables for saved AOIs, imagery jobs/history, webhook delivery attempts, usage counters, and organization membership.
- Auth/permissions:
  - Continue JWT access token plus refresh cookie rotation.
  - Add frontend MFA setup/verify flows.
  - Add organization-scoped RBAC and API-key auth with scopes.
  - Redact secrets after creation; support rotation and revocation.
- Background processing:
  - Keep Celery and Redis.
  - Extend background jobs beyond email to webhook delivery, heavy imagery workflows, replay jobs, and usage aggregation.
  - Add explicit job states and failure visibility.
- Caching:
  - Keep Copernicus token/search/render/asset caching in Redis.
  - Move from returning base64 images by default toward asset URLs and tile-based delivery for repeated access.
  - Cache platform metadata and stable reference lists client-side with stronger invalidation semantics.
- Observability:
  - Enable backend Sentry/OTLP in non-local environments.
  - Add frontend error capture and release tagging.
  - Emit structured logs with correlation IDs, actor IDs, organization IDs, and request outcome.
  - Define dashboards for auth failures, imagery latency, webhook delivery success, queue depth, and API 5xx rate.
- Security baseline:
  - Enforce secure cookies in production.
  - Hash or encrypt secrets at rest where appropriate; never return webhook secrets on list/read endpoints after creation.
  - Add stricter validation around URLs, file uploads, and config mutation.
  - Add audit events for privileged actions.
  - Remove runtime `.env` editing from the customer-facing admin plane.
- Deployment approach:
  - Containerize backend, frontend, worker, and infra dependencies for consistent environments.
  - Add CI for lint/build/tests and CD for one staging plus one production environment.
  - Keep infra simple: app server, worker, Postgres, Redis, object storage, telemetry sink.
- Testing approach:
  - Backend: unit tests for service logic, API integration tests for auth/platform/copernicus flows.
  - Frontend: component tests for critical forms/states plus Playwright for auth, project creation, saved AOI flow, and webhook setup.
  - Add contract tests around API-key auth and webhook signatures.
- Failure/retry strategy:
  - All external calls that matter should be queued or explicitly retried with visible state.
  - Webhook delivery should use exponential backoff and replay.
  - Imagery jobs should be resumable or rerunnable, with customer-visible status.
  - Surface correlation IDs in user-visible error messages for support.

## 9. Technical roadmap
### Now (0-30 days)
- Fix frontend testability and add `jsdom`, a real `test` script, and the first critical tests.
  - Why it belongs there: the current frontend test path is broken, and shipping more features without a regression net will compound risk.
  - Dependency notes: none.
  - Expected impact: immediate quality improvement and faster iteration confidence.
- Add frontend/browser observability and error boundaries.
  - Why it belongs there: current customer-facing failures would be hard to diagnose.
  - Dependency notes: choose Sentry or equivalent and align release tagging with build pipeline.
  - Expected impact: lower support cost and faster incident response.
- Secure secrets and config handling.
  - Why it belongs there: plaintext webhook secrets and runtime `.env` editing are direct credibility risks.
  - Dependency notes: minor API/UI changes; admin workflow changes.
  - Expected impact: stronger security posture in sales and diligence conversations.
- Write audit events for high-value admin and auth actions.
  - Why it belongs there: the model already exists and the leverage is high.
  - Dependency notes: minimal schema change if current audit table is sufficient.
  - Expected impact: better trust and troubleshooting.
- Optimize frontend bundle hotspots and Copernicus payload defaults.
  - Why it belongs there: performance is customer-visible immediately.
  - Dependency notes: may require slight API response changes for imagery retrieval.
  - Expected impact: faster initial load and smoother demo experience.

### Next (30-60 days)
- Introduce organizations, memberships, and RBAC.
  - Why it belongs there: this is the biggest gap between MVP and serious product.
  - Dependency notes: requires project/platform ownership refactor and user invitation flows.
  - Expected impact: unlocks team selling and serious SMB adoption.
- Turn API keys into real auth and publish a minimal developer program.
  - Why it belongs there: once org boundaries exist, API usage becomes commercially meaningful.
  - Dependency notes: RBAC, scopes, rate limiting, usage counters.
  - Expected impact: materially stronger integration and partner story.
- Add saved AOIs, imagery history, and named monitoring workflows.
  - Why it belongs there: this makes the geospatial product feel purposeful instead of exploratory.
  - Dependency notes: organization scope and persisted AOI/job tables.
  - Expected impact: higher repeat usage and stronger category fit.
- Build queued webhook delivery with logs and retries.
  - Why it belongs there: current webhook setup UI overpromises relative to backend behavior.
  - Dependency notes: worker pipeline, delivery-attempt schema, audit events.
  - Expected impact: much stronger automation credibility.

### Later (60-120 days)
- Add usage metering, entitlement enforcement, and workspace billing controls.
  - Why it belongs there: after collaboration and integration exist, monetization controls become worth the effort.
  - Dependency notes: organizations, API auth, event logging.
  - Expected impact: better packaging, expansion, and revenue discipline.
- Add export/import and delivery destinations for imagery and project data.
  - Why it belongs there: portability matters more once customers are actively evaluating migration.
  - Dependency notes: saved AOIs, job model, storage strategy.
  - Expected impact: reduces switching anxiety and increases deal confidence.
- Add richer geospatial differentiators: historical compare, AOI templates, notifications on new matching scenes.
  - Why it belongs there: these features matter once baseline production trust exists.
  - Dependency notes: monitoring runs, background jobs, notification/event system.
  - Expected impact: moves the product from credible to compelling.

## 10. Not worth doing yet
- Microservices.
  - The repo is a workable modular monolith. Splitting now would add operational drag without solving the real market gaps.
- A native mobile app.
  - The immediate need is responsive web performance and reliable field-browser behavior, not separate client platforms.
- Advanced ML/AI layers on top of imagery.
  - The product first needs repeatable workflows, governance, and trust features. “Add AI” would be positioning theater today.
- A custom map engine.
  - Leaflet/MapLibre are adequate. The leverage is in workflow/product capability, not rendering engine novelty.
- Full enterprise compliance packaging.
  - SOC 2-style readiness will matter later, but the product first needs team governance, auditability, and secure config handling.

## 11. Final recommendation
- Can this app become technically strong enough to compete?
  - Yes, but only if it narrows into a clear product: a team-ready geospatial operations workspace with credible APIs and automation. The repo already has enough foundation to get there without a rewrite.
- What are the most important technical upgrades?
  - Organizations/RBAC.
  - Real API-key auth.
  - Durable webhook/event delivery.
  - Saved AOI and imagery workflow persistence.
  - Full observability plus a working test discipline.
- What extra features would most help convince customers to choose it?
  - Team workspaces and invite flows.
  - Saved AOIs and repeatable monitoring runs.
  - Webhook delivery console with replay.
  - Real developer API program.
  - Audit trail and usage visibility.
- What should be built first, second, and third?
  - First: fix trust foundations now: tests, observability, secret/config hygiene, audit coverage, and frontend performance.
  - Second: add organization/RBAC and real API/webhook infrastructure so the product can support serious customer workflows.
  - Third: deepen the geospatial product with saved AOIs, history, monitoring, and customer-visible automation that creates a defensible reason to buy.
