# Manufacturing Control Tower

Real-time KPI dashboard for PT Paracorp Group manufacturing operations. Built on Next.js 16 with live data from Snowflake and Azure AD authentication.

## What it does

Displays Lead Time, Yield, Right First Time, Output, OEE, OPE, and Productivity across all plants in real time. Includes AI-generated executive summaries, Microsoft Teams alert notifications, an AI diagnostic chatbot, and a fullscreen Monitor Mode for factory floor display.

## Owner

- Business owner: <name, email>
- Technical contact: Dio Arioseno, dio.arioseno@paracorpgroup.com
- Backup contact: <name, email>
- Team: <team>

## Data sources

| System | Object | Refresh |
|---|---|---|
| Snowflake | `MIGRATION.CONTROL_TOWER.CT_MANUF_*` (LEADTIME, E2E, OLAH, KEMAS, TRENDS) | Per ETL load; app cache 1 hour |
| Snowflake | `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG` / `_OLAH` | Per ETL load; app cache 1 hour |
| ClickHouse (internal) | Same tables, used when `DATA_SOURCE=clickhouse` (Kubernetes) | Per ETL load; app cache 1 hour |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Snowflake SDK · NextAuth.js + Azure AD · Groq API · Nivo charts · Framer Motion

## Getting started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in values — see docs/SECURITY.md §9 for the required secrets

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` — use your Azure AD account.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `SNOWFLAKE_ACCOUNT` | Yes | Account identifier (e.g. `yb58945.ap-southeast-3.aws`) |
| `SNOWFLAKE_USER` | Yes | Service account username |
| `SNOWFLAKE_PASSWORD` | Yes | Service account password |
| `SNOWFLAKE_DATABASE` | Yes | e.g. `MIGRATION` |
| `SNOWFLAKE_WAREHOUSE` | Yes | Compute warehouse name |
| `SNOWFLAKE_SCHEMA` | Yes | e.g. `CONTROL_TOWER` |
| `NEXTAUTH_SECRET` | Yes | 32+ char random string |
| `NEXTAUTH_URL` | Yes | Canonical deployment URL |
| `AZURE_AD_CLIENT_ID` | Yes | Azure AD app registration client ID |
| `AZURE_AD_CLIENT_SECRET` | Yes | Azure AD app registration client secret |
| `AZURE_AD_TENANT_ID` | Yes | Azure AD tenant ID |
| `GROQ_API_KEY` | Yes | Groq API key for AI features |
| `TEAMS_WEBHOOK_URL` | No | Power Automate webhook (Teams fallback) |
| `TEAMS_REFRESH_TOKEN` | No | Teams Graph API refresh token |
| `RESEND_API_KEY` | No | Resend API key for email notifications |

## Key commands

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run lint     # ESLint
```

## Documentation

Start with [CLAUDE.md](CLAUDE.md) for the operating manual. Then:

| Document | What's in it |
|---|---|
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Purpose, users, pages, routes |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature inventory |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data flow, API routes, caching, AI |
| [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) | KPI formulas and thresholds |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Snowflake tables and columns |
| [docs/UI_UX.md](docs/UI_UX.md) | Design system and component specs |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, rate limiting, secrets checklist |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Bugs and technical debt |

## Deployment

Production deploys automatically to Vercel from the `main` branch. Snowflake and API credentials are set as Vercel environment variables.

## What is in this repository, and what is not

| Platform Team files (do not delete) | Owner |
|---|---|
| `.gitignore`, `.dockerignore` | Platform Team (project lines added below theirs) |
| `CLAUDE.md` | Platform Team rules + project details |
| `.env.example` | Seeded by Platform Team, extended by this project |
| `.claude/skills/apply-event-tracking/` | Platform Team — usage-tracking standard |

Application code, `package.json` + `pnpm-lock.yaml` (exact pins), `Dockerfile`, `.gitlab-ci.yml` and `k8s/` belong to this project.

## Deploying to Kubernetes

Staging runs at `https://poros-staging.paradev.io/ct-manuf` (push to `staging`; production stays on Vercel). Manifests, the Secret keys and the SSO callback are in [`k8s/README.md`](k8s/README.md). Check the container before pushing:

```bash
PORT=3000 HEALTH_PATH=/healthz PAGE_PATH=/login sh verify.sh
```
Data files, `.env*`, `node_modules/` and the old Git history are not in this repository.
