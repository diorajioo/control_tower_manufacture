# Project context for Claude Code

## What this project is
An internal web dashboard built by the Data team and deployed to an
on-premises Kubernetes cluster by the DAI Platform team. It runs as a
container. Treat every rule below as non-negotiable.

The rules below are a summary of the Web Dashboard Deployment Workbook:
https://paracorpgroup.sharepoint.com/:w:/s/DataEngineering/IQCKOkUYBmkZRailNr6rKZFVAZjE4jkc7_GlH8EjsOYQ3sU?e=HSlZ7L
(Company sign-in required. If a rule here is ambiguous, the workbook wins.)

## The Container Contract -- always follow these

1. Each container listens on 0.0.0.0, never on 127.0.0.1 or localhost,
   and serves on ONE port. This is per container, not per application:
   if this app is a frontend plus a backend, that is two containers with
   two ports, and that is fine.
   Any port above 1024 is acceptable -- 8080 is a convention here, not a
   requirement, and 3000 or 3061 or 8501 are all equally fine. What
   matters is that the port the process listens on, the EXPOSE line in
   its Dockerfile, and what you tell me all agree. Read it from an
   environment variable where the framework allows it.
   Never use a port below 1024: those require root.

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

8. Pin every dependency to an exact version, in whatever file your
   chosen stack uses. All of these are equally acceptable:
     - requirements.txt with == on every line
     - pyproject.toml with a committed uv.lock or poetry.lock
     - package.json with a committed package-lock.json or pnpm-lock.yaml
     - go.mod and go.sum, Cargo.toml and Cargo.lock
   No version ranges, no unpinned packages, and commit the lockfile.

9. CREATE and maintain a Dockerfile at the repository root. This
   repository deliberately ships without one, because a Dockerfile
   depends on this app's real entrypoint, dependencies and system
   packages. Write it alongside the app, and update it whenever the
   app's start command or dependencies change. It must:
     - build with a single `docker build .` from a clean checkout
     - use a slim, version-pinned base image (never :latest)
     - install dependencies BEFORE copying application source
     - create and switch to a non-root user before the app starts
     - EXPOSE the port the app listens on (above 1024)
     - start the app with exec so it receives SIGTERM
   The DAI Platform team reviews the Dockerfile before the first
   deployment and may adjust it. Do not be surprised if it changes.

10. Maintain a .dockerignore excluding .env, .git, data files,
    notebooks, virtual environments and node_modules.

11. Maintain a .gitignore excluding .env, .venv/, __pycache__/,
    node_modules/, *.csv, *.parquet, *.xlsx and data/.

12. Start quickly and stop cleanly. Do not load large datasets at import
    time -- load them inside a cached function so the app can answer its
    health check immediately. Start the app with exec in the Dockerfile
    CMD (CMD ["sh","-c","exec streamlit run app.py ..."]) so the app,
    not the shell, receives SIGTERM.


## Microsoft SSO -- mandatory for every app

13. This app must sign users in with Microsoft Entra ID. Never build a
    username-and-password login, and never leave the app open.
      - read the client ID, tenant ID and client secret from
        configuration. Never hardcode any of them.
      - NEVER put any SSO setting behind a NEXT_PUBLIC_ or VITE_ prefix.
        Those are compiled into the browser bundle and readable by
        anyone with developer tools open. This is the most expensive
        mistake available in this project.
      - the login must run server-side. The browser never holds the
        client secret.
      - add every SSO setting to .env.example, marking the sensitive
        ones __SECRET__replace_me.
      - when you implement or change it, TELL ME the exact OAuth
        callback path, because it has to be registered with IT and it
        is matched character for character.
      - for Streamlit, use the built-in st.login() support. It needs
        streamlit>=1.42 and Authlib>=1.3.2, both pinned, and it reads
        .streamlit/secrets.toml rather than environment variables. That
        file must be git-ignored -- never commit it. The callback path
        is /oauth2callback.

## Performance rules
- Do the aggregation in SQL in the warehouse, not in the application.
- Cache query results with a sensible TTL, using whatever caching your
  chosen framework provides.
- Never load a full table into memory. Always filter and limit in SQL.

## Project specifics
- Stack: [not decided yet -- fill this in once it is, and see
  "Choosing the stack" above]
- Data sources: [FILL IN -- e.g. Snowflake DB_SALES.ANALYTICS]

## When I ask for a change
- Update .env.example if you introduce a new setting.
- Update README.md if you change how it runs locally.
- If a change requires reaching a new external service, say so
  explicitly -- it needs a firewall rule before it will work.
- After any significant change, re-verify all twelve rules above.
