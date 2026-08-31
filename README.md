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

## Run locally

```bash
cp .env.example .env        # then fill in the real values
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

### Run it the way production runs it

```bash
docker build -t myapp:test .
docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 myapp:test
curl -i http://localhost:8080/_stcore/health   # must return 200
```

## Before requesting a deployment

1. Read the [**Web Dashboard Deployment Workbook**](https://paracorpgroup.sharepoint.com/:b:/s/DataEngineering/IQBwxC0b3rK_TJtzqgOvlyRNAWlldVuqDi8qm4SqNwNVn9E?e=44FtEs).
2. Run the test suite in workbook section 2.7 (Claude Code can run it for you).
3. Download and complete the [**Deployment Request & Pre-Flight Checklist**](https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQBY5zjYR9fYTqzk_WlfUeV2AfdOqtgfLCFBCYJpsngclxg?e=Gpjiwk) document,
   or the plain-text copy in `DEPLOYMENT-REQUEST.md`.
4. Send it to the DAI Platform Team.

## Reference documents

| Document | What it is for |
|---|---|
| [**Web Dashboard Deployment Workbook**](https://paracorpgroup.sharepoint.com/:b:/s/DataEngineering/IQBwxC0b3rK_TJtzqgOvlyRNAWlldVuqDi8qm4SqNwNVn9E?e=44FtEs) | Read this first. What to build, and why each rule exists. |
| [**Deployment Request & Pre-Flight Checklist**](https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQBY5zjYR9fYTqzk_WlfUeV2AfdOqtgfLCFBCYJpsngclxg?e=Gpjiwk) | Fill in before you ask for a deployment. <!-- PLATFORM TEAM: add the SharePoint link here --> |

Both live on the Data Engineering SharePoint site and need your company sign-in.

## Files you should not delete

`.gitignore`, `.dockerignore` and the platform rules section of `CLAUDE.md`
are your protection against committing a credential or shipping an image
that will not deploy. Extend them if you need to; do not remove them.
