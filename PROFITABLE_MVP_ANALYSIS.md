# Profitable MVP Analysis

## 1. What this product appears to be
- Fact: The repo started as a reusable full-stack SaaS starter, but it now contains a real geospatial workflow centered on Copernicus/Sentinel imagery. Evidence: `README.md`, `backend/modules/copernicus/*`, `frontend/src/features/dashboard/SatelliteDashboard.tsx`, `frontend/src/components/map/*`.
- Fact: The live product surface is a browser-based satellite workspace with auth, projects, task boards, notifications, profile/admin controls, and a Belgium-first satellite map experience. Evidence: `frontend/src/app/router.tsx`, `frontend/src/pages/ProjectsPage.tsx`, `frontend/src/pages/ProjectDetailPage.tsx`, `frontend/src/pages/NotificationsPage.tsx`, `frontend/src/pages/CopernicusPage.tsx`.
- Fact: The satellite flow lets a signed-in user frame an AOI on a map, choose date range/layer/cloud threshold, and fetch backend-proxied Copernicus imagery plus scene/cache metadata. Evidence: `frontend/src/features/dashboard/SatelliteDashboard.tsx`, `frontend/src/api/satellite.ts`, `backend/modules/copernicus/router.py`, `backend/modules/copernicus/service.py`.
- Fact: The product is explicitly localized to Belgium today. Evidence: `backend/.env.example` sets `COPERNICUS_DEFAULT_COUNTRY=BE`; `frontend/src/config/countries.ts` only defines `BE`; `SatelliteDashboard` says "Belgium-first Copernicus workspace"; the map offers a Flanders orthophoto basemap.
- Inference: This is best understood as an early vertical geospatial monitoring app built on top of a generic SaaS shell, not a general-purpose project management tool.
- Inference: The likely current target is a professional user, not consumer: GIS-light operators, analysts, environmental/public-sector teams, land/infrastructure monitors, or specialist consultancies that need quick satellite checks without standing up a full EO stack.

## 2. Current state assessment
- Maturity level: early MVP / advanced prototype.
- Strengths:
  - Real backend architecture: FastAPI, PostgreSQL, Redis, MinIO, Celery, modular monolith, auth, telemetry hooks, object storage, migrations, admin config.
  - Real end-to-end satellite feature: authenticated imagery retrieval, caching, rendering, asset proxying, viewport-driven UI.
  - Reusable account/platform foundation: plans, feature flags, API keys, webhooks, email templates, admin settings.
  - Team workflow primitives already exist: projects, tasks, calendar, notifications.
- Weaknesses:
  - Product positioning is still split between "generic app starter" and "satellite workspace".
  - Billing is not real monetization yet; users can switch plans in-app, but there is no payment processor, invoicing, usage metering, entitlements enforcement, or billing operations.
  - The satellite feature is still a viewer, not a workflow product: no saved AOIs, no change detection, no alerts, no exports, no report generation, no collaboration on findings.
  - Very light test coverage: only a small API client test and two backend Copernicus tests.
  - Frontend still has template residue (`frontend/README.md` is the default Vite README).
- Missing monetization foundations:
  - No sharp ICP-specific onboarding.
  - No "first value" flow beyond manually loading imagery.
  - No sticky recurring job such as scheduled monitoring or alerts.
  - No buying trigger such as compliance evidence, incident workflow, reporting, or tasking/order workflow.
  - No trust layer for professional buyers: audit trail of analysis, saved history, exportable evidence, data provenance, SLA/admin controls.

## 3. Likely target users and jobs-to-be-done
- Primary ICP:
  - Belgium/Flanders-based environmental, infrastructure, land, forestry, public-sector, or consulting teams that need fast AOI-based satellite monitoring without heavy GIS tooling.
- Secondary ICP:
  - SMB geospatial consultancies and operational teams that need a lightweight monitoring workspace for clients or internal sites.
  - Developers or technical analysts who want a thin Copernicus front-end plus API/webhook surface.
- Core user pain points:
  - Accessing EO data is still operationally messy and quota/tooling-heavy.
  - Raw imagery is not the same as an operational decision.
  - Non-GIS stakeholders need alerts, evidence, and reports, not just map layers.
  - Many teams monitor the same places repeatedly and do not want to redraw, re-filter, and manually compare imagery every time.
- Why they would care:
  - Faster time-to-answer than QGIS/GEE/custom pipelines.
  - Lower training burden than full EO platforms.
  - Localized basemap/context for Belgium is already a differentiator.
  - The repo already has enough account/project/notification infrastructure to become a recurring operational tool instead of a one-off viewer.

## 4. Competitive landscape
- Direct competitors:
  - [Planet Insights Platform / Sentinel Hub](https://docs.planet.com/platform/) offers hosted EO analysis, streaming, custom scripts, change detection, zonal statistics, and object-detection feeds; Planet’s monitoring subscriptions are sold as annual area-under-management contracts with near-daily coverage and archive access ([Planet support](https://support.planet.com/hc/en-us/articles/27016165868957-What-s-the-Difference-Between-Monitoring-and-Tasking-Subscriptions)).
  - [EOSDA LandViewer](https://eos.com/products/landviewer/) offers browser-based imagery search, 20+ indices, change detection, time series, clustering, exports, notifications, and optional high-resolution imagery/tasking.
  - [UP42](https://up42.com/pricing) sells geospatial data/processing with instant AOI pricing, tasking/catalog orders, and a credits model rather than a seat subscription.
- Indirect competitors / substitutes:
  - Google Earth Engine, QGIS + plugins/scripts, ArcGIS, Copernicus Browser/Data Space APIs, Microsoft Planetary Computer, bespoke analyst workflows.
  - Open-source or low-cost substitutes matter because public Sentinel/Landsat data is available; buyers mainly pay for speed, workflow, support, convenience, and actionability.
- Notable patterns in the market:
  - Buyers pay for complete workflows, not raw map viewers.
  - Vendors differentiate with one or more of: alerts, change detection, time series, exports/reports, high-res ordering/tasking, industry templates, and API automation.
  - Platforms increasingly bundle browser UX with API/programmatic access.
  - Monitoring products often monetize by area under management, credits, or annual contracts rather than simple per-seat SaaS.
- Pricing patterns:
  - Planet positions monitoring as annual subscriptions based on area under management ([Planet support](https://support.planet.com/hc/en-us/articles/27016165868957-What-s-the-Difference-Between-Monitoring-and-Tasking-Subscriptions)).
  - UP42 uses prepaid credits and no mandatory subscription; its docs state `100 credits = €1`, minimum purchase `10,000 credits (€100)`, plus compliance checks for commercial buying ([UP42 docs](https://docs.up42.com/getting-started/purchase)).
  - EOSDA mixes free access plus subscriptions for platform features, while charging separately for high-resolution imagery/tasking; its public pricing page lists archive/tasking prices roughly from `$1.7-$30` per sq km depending on resolution ([EOSDA pricing](https://eos.com/products/high-resolution-images/)).
- Feature expectations:
  - AOI saving and repeat monitoring.
  - Change detection and time series.
  - Alerts/notifications when new imagery or threshold changes occur.
  - Export to GIS/report formats.
  - Historical archive access and cloud filtering.
  - Optional high-resolution ordering/tasking for higher-value use cases.
- Market gaps:
  - There is room below heavyweight EO platforms for "GIS-light operational monitoring" for specific verticals and geographies.
  - Belgium/Flanders-localized monitoring is less crowded than generic global EO tooling.
  - A wedge exists in turning Copernicus imagery into evidence-ready workflows for teams that do not want to operate a remote-sensing stack.
  - Since February 12, 2025, EO Browser’s anonymous access was disabled and EOSDA argues the transition has left users looking for easier alternatives; whether or not EOSDA overstates this, it is a real signal that lightweight browser workflows are in flux ([EOSDA transition guide](https://eos.com/blog/sentinel-hub-eo-browser-alternatives/)).

## 5. Commercial risks
- Why this may fail to monetize in current form:
  - The product currently looks like "a starter kit plus a satellite viewer", not a must-buy workflow.
  - Free/open alternatives are good enough for image viewing; users pay when the product saves recurring labor or creates decision-grade outputs.
  - The in-app plans create false confidence because there is no actual payment, entitlement, or procurement path.
- Trust / onboarding / retention / differentiation risks:
  - No persistent AOI setup means weak activation.
  - No scheduled monitoring means weak retention.
  - No evidence/reporting means weak willingness-to-pay for regulated or operational users.
  - No collaboration layer means weak team adoption.
  - No vertical workflow means weak differentiation versus general EO tools.
- Market timing risks:
  - The EO market is crowded; generic "satellite imagery in a browser" is not enough.
  - Public-data viewers and open tooling keep baseline willingness-to-pay low.
  - High-value commercial imagery/tasking is attractive, but introducing it too early would increase operational and sales complexity.
- Overbuilding risks:
  - Expanding generic SaaS modules further would likely be waste.
  - Building a full analytics platform, ML detection engine, or broad multi-country product now would outrun validation.
  - Shipping webhooks/API keys before a sticky monitoring workflow exists would optimize for the wrong user too early.

## 6. Feature opportunities ranked
| opportunity | user problem solved | why demand likely exists | competitor benchmark | demand score | revenue score | differentiation score | effort score | MVP fit score | recommendation |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Saved AOIs + watchlists | Users should not redraw/filter the same places every session | Repeated monitoring is the core recurring behavior in EO workflows | Planet monitoring, EOSDA AOI workflows | 5 | 4 | 3 | 2 | 5 | Must-build |
| Scheduled change alerts | Users need to know when something changed, not manually check maps | Alerts create retention and operational relevance | EOSDA notifications; Planet monitoring subscriptions | 5 | 5 | 4 | 3 | 5 | Must-build |
| Side-by-side change detection with thresholded diff summary | A viewer does not explain what changed | Change detection is a standard buying feature in this category | Planet analysis features, EOSDA compare/change tools | 5 | 4 | 4 | 3 | 5 | Must-build |
| Exportable evidence reports (PDF/PNG + metadata) | Teams need shareable proof for clients, audits, and decisions | Reporting shortens the distance from image to action | Many competitors support exports; market expects it | 4 | 5 | 4 | 2 | 5 | Must-build |
| AOI history / time series timeline | Users need historical context, not one image | Time series is a strong expectation in EO tools | EOSDA time series; Planet spectral analytics | 4 | 4 | 3 | 3 | 4 | Nice-to-have |
| Issue/case workflow per AOI | Teams need to turn findings into follow-up work | Existing projects/tasks infra makes this commercially useful | Adjacent ops software, not core EO tools | 4 | 4 | 5 | 3 | 4 | Nice-to-have |
| Belgium-specific layers (cadastre/admin/parcel overlays) | Users need real operational context, not a bare basemap | Local context is hard to replicate and increases daily utility | Few generic global tools localize deeply | 4 | 4 | 5 | 3 | 4 | Nice-to-have |
| Multi-user comments and review trail | Teams need shared interpretation and auditability | Collaboration helps team expansion and retention | Common in enterprise tools; rarer in lightweight EO tools | 3 | 4 | 4 | 3 | 3 | Nice-to-have |
| High-resolution imagery ordering/tasking | Some customers need better revisit/resolution than Sentinel | Buyers pay directly for tasking/archive when use case justifies it | EOSDA hi-res ordering; UP42 tasking; Planet | 3 | 5 | 3 | 5 | 2 | Later |
| Full billing/payment automation | Needed for real SaaS monetization | Necessary eventually, but not the next wedge | Standard SaaS hygiene | 3 | 5 | 1 | 4 | 2 | Later |
| Generic API-first developer platform push | Appeals to technical buyers | Current product lacks a proven core workflow to automate | UP42 / Sentinel Hub already strong here | 2 | 3 | 2 | 3 | 1 | Not now |
| Build custom AI detections now | Sounds differentiated but is risky before workflow validation | Users first need reliable monitoring basics | Planet analytics feeds; many niche vendors | 3 | 3 | 4 | 5 | 1 | Not now |

- Top 3 must-build additions:
  - Saved AOIs + watchlists
  - Scheduled change alerts
  - Exportable evidence reports
- Top 3 nice-to-have additions:
  - AOI history / time series timeline
  - Issue/case workflow per AOI
  - Belgium-specific operational overlays
- 3 things NOT to build now:
  - Generic developer platform expansion
  - Custom AI/object-detection roadmap
  - High-resolution tasking procurement workflow

## 7. Top recommendations
- Feature / product change name: Saved AOIs and watchlists
  - Exact problem solved: repeated manual setup makes the product feel like a demo instead of a monitoring tool.
  - Target user: analysts and operators who revisit the same sites weekly.
  - Why this matters commercially: this is the foundation for recurring usage, alerts, team workflows, and any area-based pricing.
  - Why now: the current map flow already computes bbox, scene, and request settings; persistence is the missing bridge to real monitoring.
  - What in the current repo makes it feasible or difficult: feasible because projects/tasks/auth already exist; difficult only because there is no AOI model yet.
  - MVP version of the feature: save named AOIs with bbox, layer, date preset, cloud threshold, project link, and last image metadata.
  - Success metric: 60%+ of activated users save at least one AOI; median weekly return visits increase.

- Feature / product change name: Scheduled change alerts
  - Exact problem solved: users should be notified when a site changes instead of manually checking imagery.
  - Target user: environmental monitors, infrastructure/site operators, consultancies, municipal teams.
  - Why this matters commercially: alerts create habit and budget justification; they move the product from "viewer" to "monitoring service".
  - Why now: Celery, Redis, email delivery, notifications, and preferences already exist.
  - What in the current repo makes it feasible or difficult: technically feasible due to async jobs and notification plumbing; difficult because change heuristics and alert thresholds need a narrow first use case.
  - MVP version of the feature: daily/weekly job per AOI that compares latest valid scene vs prior baseline using simple index or RGB delta thresholds and sends an alert with image snapshots.
  - Success metric: alert open rate, percentage of watchlists with active alerts, and % of alerted AOIs that users inspect.

- Feature / product change name: Change detection compare view
  - Exact problem solved: imagery alone leaves too much interpretation work to the user.
  - Target user: GIS-light operators and non-technical stakeholders reviewing land/site changes.
  - Why this matters commercially: creates visible product value in the first session and supports demos/sales.
  - Why now: current render pipeline already supports date ranges, layers, and scene metadata; UI already supports a side panel.
  - What in the current repo makes it feasible or difficult: feasible because the Copernicus service and map UI are modular; difficult because UX must be simple enough for non-experts.
  - MVP version of the feature: choose "baseline" and "latest" dates, render both, add swipe/side-by-side comparison and a simple summarized "change likely / no significant change" badge.
  - Success metric: share of new users who complete a comparison in the first session; reduction in time-to-first-insight.

- Feature / product change name: Evidence report export
  - Exact problem solved: users need something they can send to a client, teammate, regulator, or manager.
  - Target user: consultants, public-sector teams, insurers, infrastructure operators.
  - Why this matters commercially: evidence artifacts turn usage into procurement value and justify paid plans.
  - Why now: the product already has scene metadata, bbox, timestamps, projects, and notifications.
  - What in the current repo makes it feasible or difficult: feasible because needed data is already returned by the backend; difficult mainly in defining a clean report template.
  - MVP version of the feature: export a PDF/PNG with AOI, before/after imagery, date range, cloud threshold, scene IDs, bbox, and operator notes.
  - Success metric: exports per active AOI, percentage of exported reports tied to retained accounts, and sales-call conversion when reports are shown.

- Feature / product change name: Belgium-specific operational overlays
  - Exact problem solved: generic imagery lacks the local context needed for real decisions.
  - Target user: Belgian/Flemish land, forestry, municipal, permitting, and infrastructure teams.
  - Why this matters commercially: local specificity is harder to copy than generic EO UI and makes the product feel purpose-built.
  - Why now: the app is already Belgium-first and already includes a Flanders orthophoto toggle.
  - What in the current repo makes it feasible or difficult: feasible because the country/config abstraction exists; difficult because sourcing and normalizing public boundary layers takes product discipline.
  - MVP version of the feature: add selectable admin boundaries / parcel overlays for Belgium plus AOI snapping and overlay labels.
  - Success metric: percentage of sessions using overlays, saved AOIs linked to official boundaries, and demo-to-trial conversion in Belgium.

## 8. Best MVP to build from here
- Recommended target customer:
  - Belgium/Flanders-based environmental, land, infrastructure, and public-sector monitoring teams with repeated site checks but limited GIS capacity.
- Recommended product wedge:
  - "A Belgium-first satellite change-monitoring workspace for recurring sites, with alerts and evidence-ready reports."
- Recommended v1 feature set:
  - Saved AOIs/watchlists.
  - Scheduled imagery refresh + threshold-based alerts.
  - Before/after compare view with simple change summary.
  - Report export with metadata and notes.
  - Project linkage so each AOI can have follow-up tasks/owners.
  - Belgium/Flanders context overlays.
- Not doing list:
  - No broad multi-country expansion.
  - No high-resolution imagery ordering/tasking in v1.
  - No custom AI detections.
  - No generic developer platform push.
  - No enterprise platform sprawl.
- Monetization hypothesis:
  - Customers pay for recurring monitoring of known areas, especially when the product reduces manual checks and produces shareable evidence.
  - The monetization unit should be tied to operational value: number of monitored AOIs / hectares / municipalities / sites, not generic seats alone.
- Pricing hypothesis:
  - Starter: €99-€199/month for a small number of watchlisted AOIs and basic report exports.
  - Pro: €399-€999/month for more AOIs, scheduled alerts, team access, audit history, and priority support.
  - Custom/public-sector: annual contracts priced by area under monitoring, number of sites, or reporting volume.
- Launch strategy:
  - Sell narrowly into Belgium-first use cases: land monitoring, environmental compliance, municipal oversight, infrastructure corridor/site review, or consultant client reporting.
  - Demo with one live AOI, one change alert, and one exported report.
  - Use founder-led outreach to a small number of agencies/consultancies instead of self-serve first.

## 9. 30-day execution plan
- Week 1
  - Remove positioning ambiguity from the product and README.
  - Define one ICP and one use case in plain language.
  - Add AOI persistence model and CRUD.
  - Replace generic dashboard copy with monitoring-specific onboarding.
- Week 2
  - Build watchlists and first-run "save your first monitored area" flow.
  - Add compare view and baseline/latest imagery workflow.
  - Add report template with exportable metadata.
- Week 3
  - Implement scheduled monitoring jobs with email + in-app alerts.
  - Add simple threshold configuration per watchlist.
  - Add Belgium/Flanders overlays needed for the chosen use case.
- Week 4
  - Run 5-10 discovery/demo calls with target users.
  - Instrument activation: AOI saved, first compare, first alert, first export.
  - Package pricing around monitored sites/AOIs.
  - Cut non-essential generic platform work and prepare a narrow launch page/demo deck.

## 10. Final verdict
- Is this worth pursuing?
  - Yes, but only as a narrow vertical monitoring product. No, if it remains a generic starter plus satellite viewer.
- What kind of profitable MVP can this realistically become?
  - A Belgium-first geospatial monitoring SaaS for repeated AOIs, change alerts, and evidence-ready reporting for professional teams that need operational answers without heavy GIS tooling.
- What is the single most important feature or change to add next?
  - Saved AOIs + watchlists, because that is the prerequisite for activation, retention, alerts, reporting, and area-based monetization.
