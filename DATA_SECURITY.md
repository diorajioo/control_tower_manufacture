# Data Security Framework

> Reusable across all Control Tower dashboards (Manufacturing, Supply Chain, Finance, etc.)
> Last updated: 2026-09-04

---

## 1. Threat Model

| Actor | Vector | Risk |
|-------|--------|------|
| Unauthenticated browser | Direct API call | Reads live KPI data |
| Authenticated user (wrong plant) | URL manipulation | Cross-plant data leakage |
| Prompt injection via chat | Crafted user message | AI runs unauthorized SQL |
| Compromised AI API key | Leaked GROQ_API_KEY | Unauthorized LLM usage, cost explosion |
| Snowflake credential leak | Leaked .env | Full warehouse read access |
| Log aggregation | Server logs | PII or sensitive values in plaintext |

---

## 2. Authentication & Authorization

### Rules

- **Every API route** must call `getServerSession(authOptions)` before touching data.
- Session check must be the **first** statement in the handler body.
- Return `401 Unauthorized` (not 403) — do not confirm resource existence to unauthenticated callers.

### Plant-level isolation

- The `plant` filter from the query string must be sanitized before hitting Snowflake:
  ```ts
  function sanitizePlant(p?: string): string {
    if (!p || p === "All Plant") return "";
    return p.replace(/['"\\;]/g, "");
  }
  ```
- All Snowflake queries use **parameterized bindings** (`?` placeholders) — never string interpolation for user-supplied values.

### Role mapping (future)

When Azure AD groups are configured, map group membership to plant access:
```ts
// Example — add to authOptions callbacks
session.allowedPlants = user.groups.includes("CT-PLANT-A") ? ["PLANT-A"] : [];
```

---

## 3. API Security

### Query parameter validation

Always validate date formats before passing to Snowflake:
```ts
function validateDate(d?: string): string | undefined {
  if (!d) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}
```

### Rate limiting (deploy)

Add Next.js middleware or an edge-function rate limiter before dashboard routes.
Recommended limits:
- `/api/dashboard/*`: 60 req/min per session
- `/api/chat`: 20 req/min per session (Groq cost protection)
- `/api/dashboard/kpi`: effectively rate-limited by the 1-hour cache

### Response headers

Add to `next.config.mjs` for all API routes:
```js
headers: [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
]
```

---

## 4. Snowflake Credentials

### Storage

| Environment | Where to store |
|-------------|---------------|
| Local dev   | `.env.local` (git-ignored) |
| Vercel      | Environment Variables (encrypted at rest) |
| Self-hosted | OS-level secrets manager (e.g. Azure Key Vault) |

### Principle of least privilege

The Snowflake service account should have:
- `SELECT` on `MIGRATION.CONTROL_TOWER.*`
- `SELECT` on `DATAMART.MANUFACTURE.*`
- No `INSERT`, `UPDATE`, `DELETE`, `DROP`, or `CREATE` privileges
- No access to other schemas/databases

### Rotation

Rotate `SNOWFLAKE_PASSWORD` (or private key) every 90 days.
Document the rotation in the internal runbook — not in this file.

---

## 5. AI / LLM Security

### Prompt injection mitigation

The chat system prompt includes strict instructions, but also:
- The `get_kpi_data` tool only accepts whitelisted `kpi_type` values (enforced by enum in tool schema).
- `plant` values are sanitized before being embedded in SQL.
- All SQL in `executeGetKpiData` and `executeGetWeeklyTrend` uses **literal switch-case templates** — user input never reaches the SQL string directly.

### API key protection

- `GROQ_API_KEY` is server-only — never imported in client components.
- The chat route is server-side (`/app/api/chat/route.ts`) — the key is never exposed to the browser.
- If the key is compromised: rotate immediately via Groq console, update the env var, redeploy.

### Cost controls

- `max_tokens: 1500` cap on tool-calling rounds, `800` on final answer streaming.
- `MAX_TOOL_ROUNDS = 3` prevents infinite tool loops.
- Agent router selects cheaper models for simple questions — reduces daily token spend.

---

## 6. Data in Transit

- All traffic is HTTPS (enforced by Vercel / reverse proxy).
- Snowflake driver uses TLS 1.2+ by default.
- Teams webhook calls are HTTPS.

---

## 7. Data at Rest

- No PII is stored by this dashboard — all data is manufacturing KPIs (quantities, times, rates).
- Chat history (`lib/chat-history.ts`) is stored in browser `localStorage` by default.
  - It contains user questions and AI responses — no raw KPI row data.
  - Users can clear it via the chat panel "New Session" button.
  - If switching to `ServerChatHistory`, apply the same Snowflake credential and auth rules to the history API route.
- The Next.js `unstable_cache` stores serialized JSON of KPI query results on the server for up to 1 hour.
  - The cache key includes plant + date range — no cross-user data bleeding.
  - Cache is in-memory per server instance (not shared across edge nodes without a Redis adapter).

---

## 8. Logging & Observability

- Do **not** log raw Snowflake rows or AI responses to stdout — log only counts and errors.
- `console.error` in API routes is acceptable for error diagnosis; strip before production if a log aggregator (Datadog, Loki) is configured.
- Never log: passwords, API keys, session tokens, or user chat content.

---

## 9. Secrets Checklist (per deployment)

- [ ] `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_SCHEMA` set in env
- [ ] `NEXTAUTH_SECRET` set (32+ char random string)
- [ ] `NEXTAUTH_URL` set to the canonical deployment URL
- [ ] `GROQ_API_KEY` set, not exposed to client
- [ ] `TEAMS_WEBHOOK_URL` set if Teams alerts are enabled
- [ ] `.env.local` is in `.gitignore`
- [ ] Snowflake service account has SELECT-only privileges
- [ ] HTTPS enforced at edge/proxy layer

---

## 10. Incident Response

1. **Suspected key leak** → rotate immediately, audit Groq/Snowflake usage logs
2. **Unauthorized data access** → check NextAuth session logs, review plant filter bypass
3. **Prompt injection in chat** → redeploy with tighter system prompt; add output validation
4. **Cache poisoning** → call `revalidateTag("kpi")` / `revalidateTag("trends")` via a protected admin route