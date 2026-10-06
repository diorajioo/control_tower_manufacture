# <project-slug>

> Replace this whole file for your own project. Keep the four sections.

## What this is

One paragraph, in business language. Who uses this dashboard and what
decision does it support?

## Owner

- Business owner: <name, email>
- Technical contact: <name, email>
- Backup contact: <name, email>
- Team: <team>

## Data sources

| System | Object | Refresh |
|---|---|---|
| Snowflake | `DB_X.SCHEMA_Y.TABLE_Z` | Hourly |

## What is in this repository, and what is not

This repository is **scaffolding**, not a starter app. The DAI Platform Team
owns the files that protect you; you own the application and its Dockerfile.

| Already here (do not delete) | Owner |
|---|---|
| `.gitignore` | Platform Team — stops `.env` and data files reaching Git |
| `.dockerignore` | Platform Team — stops them reaching the image |
| `.gitlab-ci.yml` | Platform Team — includes the shared pipeline |
| `CLAUDE.md` | Platform Team (the rules) + you (project details) |
| `.env.example` | Seeded by us, **extended by you** |
| `CODEOWNERS` | Platform Team |
| `.claude/skills/apply-event-tracking/` | Platform Team — the usage-tracking standard (OpenPanel). Claude Code loads it automatically; ask it to "add tracking". Copied from `paragon-is/dai/infra` `skills/apply-event-tracking` at commit `780bf21`: change it there, not here |

| You create this | Notes |
|---|---|
| Your application code | Whatever your app needs |
| `requirements.txt` / `package.json` | Exact pinned versions |
| **`Dockerfile`** | **Written alongside your app**, by you or Claude Code. We deliberately do not ship one — a Dockerfile depends on your real entrypoint, your dependencies and any system packages you need, so a generic one would be wrong for most apps. We review it before the first deployment and may adjust it; after that we help maintain it. |
| `README.md` content | Replace this file with your own |

## Run locally

> Replace this block with the real commands once the stack is chosen. It is
> left generic on purpose — this repository does not assume a language.

```bash
cp .env.example .env        # then fill in the real values
# ... install dependencies for your stack
# ... start the app
```

### Run it the way production runs it

Whatever the stack, this is the test that matters, because it is what the
pipeline does:

```bash
docker build -t myapp:test .
docker run --rm -p 8080:8080 --env-file .env myapp:test
curl -i http://localhost:8080/<your-health-path>   # must return 200
```

Substitute your own port and health path. Neither has to be 8080 or
`/healthz` — they only have to match what your Dockerfile and your app
actually use.

## Before requesting a deployment

1. Read the [**Web Dashboard Deployment Workbook**](https://paracorpgroup.sharepoint.com/:b:/s/DataEngineering/IQBwxC0b3rK_TJtzqgOvlyRNAWlldVuqDi8qm4SqNwNVn9E?e=qQdRTD).
2. Run the test suite in workbook section 2.7 (Claude Code can run it for you).
3. Download and complete the [**Deployment Request & Pre-Flight Checklist**](https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQBY5zjYR9fYTqzk_WlfUeV2AfdOqtgfLCFBCYJpsngclxg?e=Gpjiwk) document.
4. Send it to the DAI Platform Team through submiting a ticket in [**DAI Platform Squad JIRA**](https://paracorpgroup.atlassian.net/jira/software/projects/IDE/boards/1465).

## Reference documents

| Document | What it is for |
|---|---|
| [**Web Dashboard Deployment Workbook**](https://paracorpgroup.sharepoint.com/:b:/s/DataEngineering/IQBwxC0b3rK_TJtzqgOvlyRNAWlldVuqDi8qm4SqNwNVn9E?e=qQdRTD) | Read this first. What to build, and why each rule exists. |
| [**Deployment Request & Pre-Flight Checklist**](https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQBY5zjYR9fYTqzk_WlfUeV2AfdOqtgfLCFBCYJpsngclxg?e=Gpjiwk) | Fill in before you ask for a deployment. <!-- PLATFORM TEAM: add the SharePoint link here --> |

Both live on the Data Engineering SharePoint site and need your company sign-in.

## Moving in an app you already built

Normal case, not an exception. Do not merge your old Git history into this
repository — copy the files across instead.

```bash
# from inside this repository
cp ~/projects/my-old-folder/app.py           .
cp ~/projects/my-old-folder/requirements.txt .
cp ~/projects/my-old-folder/.env             .   # copied, never committed
git checkout -b staging
git add -A && git status      # read the list before committing
git commit -m "Move dashboard in from local development"
git push -u origin staging
```

**Bring your `Dockerfile` with you** if you already have one — it belongs with
your app. If you do not have one yet, ask Claude Code to write it (see the
rules in `CLAUDE.md`).

**Keep the files already in this repository** — `.gitignore`, `.dockerignore`,
`CLAUDE.md` and `.gitlab-ci.yml`. Do not overwrite them with your old versions.
**Leave behind** your `.venv/` or `node_modules/`, any data files, notebooks,
and your old `.git` folder.

Easiest route: paste the migration prompt from section 2.2 of the workbook
into Claude Code and let it do the copying and the readiness check.

The pipeline will then tell you exactly what still needs fixing. Two or three
failures on the first push is normal for an app built before reading the
contract.

## Files you should not delete

`.gitignore`, `.dockerignore`, `.gitlab-ci.yml` and the platform rules section
of `CLAUDE.md` are your protection against committing a credential or shipping
an image that will not deploy. Extend them if you need to; do not remove them.
