# Manufacturing Control Tower

Real-time KPI dashboard for PT Paracorp Group manufacturing operations. Built on Next.js 14 with live data from Snowflake and Azure AD authentication.

## What it does

Displays Lead Time, Yield, Right First Time, Output, OEE, OPE, and Productivity across all plants in real time. Includes AI-generated executive summaries, Microsoft Teams alert notifications, an AI diagnostic chatbot, and a fullscreen Monitor Mode for factory floor display.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Snowflake SDK · NextAuth.js + Azure AD · Groq API · Nivo charts · Framer Motion

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
