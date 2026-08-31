# Project context for Claude Code

## What this project is
An internal web dashboard built by the Data team and deployed to an
on-premises Kubernetes cluster by the DAI Platform team. It runs as a
container. Treat every rule below as non-negotiable.

The rules below are a summary of the Web Dashboard Deployment Workbook:
https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQCKOkUYBmkZRailNr6rKZFVAZjE4jkc7_GlH8EjsOYQ3sU?e=HSlZ7L
(Company sign-in required. If a rule here is ambiguous, the workbook wins.)

## The Container Contract -- always follow these

1. The app must listen on 0.0.0.0, never on 127.0.0.1 or localhost.
   Serve everything on ONE port. Default to 8080, read from the PORT
   environment variable. Any port above 1024 is acceptable, but the
   port the app listens on and the EXPOSE line must be the same number,
   and you must tell me if you change it. Never use a port below 1024:
   those require root, which rule 9 forbids.

2. Expose a GET /healthz endpoint returning HTTP 200 with a small body.
   It must be cheap: never query a database or an external service in it.
   (Streamlit already provides /_stcore/health -- use that instead.)

3. Never hardcode hostnames, usernames, passwords, tokens, API keys,
   account identifiers, IP addresses or absolute file paths. Read them
   from environment variables via os.environ / process.env.

4. Never write a real credential into any file in this repository --
   not in code, comments, notebooks, tests, fixtures or documentation.
   Use placeholders only.

5. Every environment variable the code reads must appear in .env.example
   with a dummy value. Mark sensitive ones as __SECRET__replace_me.
   Update .env.example whenever you add a variable.

6. Keep the app stateless. Do not write files that need to survive a
   restart. Persist to the warehouse or object storage instead.
   Temporary files must go to a path from the TMPDIR env var.

7. Log to stdout/stderr only. Never write to a log file.

8. Pin every dependency to an exact version in requirements.txt or
   package.json. No version ranges, no unpinned packages.

9. Maintain a working Dockerfile at the repository root. It must build
   with a single `docker build .` from a clean checkout, use a slim
   pinned base image, install dependencies before copying source code,
   and switch to a non-root user before the app starts.

10. Maintain a .dockerignore excluding .env, .git, data files,
    notebooks, virtual environments and node_modules.

11. Maintain a .gitignore excluding .env, .venv/, __pycache__/,
    node_modules/, *.csv, *.parquet, *.xlsx and data/.

12. Start quickly and stop cleanly. Do not load large datasets at import
    time -- load them inside a cached function so the app can answer its
    health check immediately. Start the app with exec in the Dockerfile
    CMD (CMD ["sh","-c","exec streamlit run app.py ..."]) so the app,
    not the shell, receives SIGTERM.

## Performance rules
- Do aggregation in SQL in the warehouse, not in pandas in the app.
- Cache query results (for example @st.cache_data with a TTL).
- Never load a full table into memory. Always filter and limit in SQL.

## Project specifics
- Stack: [FILL IN -- e.g. Streamlit 1.4x, Python 3.12]
- Data sources: [FILL IN -- e.g. Snowflake DB_SALES.ANALYTICS]

## When I ask for a change
- Update .env.example if you introduce a new setting.
- Update README.md if you change how it runs locally.
- If a change requires reaching a new external service, say so
  explicitly -- it needs a firewall rule before it will work.
- After any significant change, re-verify all twelve rules above.
