# Kubernetes deploy

The cluster manifests live in the **infra repo** (`paragon-is/dai/infra`), which is the source of
truth — not here:

| What | Where (infra repo, `devops/kubernetes-manifest/Control-Tower-Manufacture/staging/`) |
|---|---|
| Deployment + Service | `deployments/staging-control-tower-manufacture.yaml` — rendered by the CI template on the first staging pipeline, then only its image tag is bumped |
| Ingress | `ingress/staging-control-tower-manufacture-ingress.yaml` — `https://poros-staging.paradev.io/ct-manuf`, Kong, `strip-path: "false"` |
| ConfigMap | `secrets/staging-control-tower-manufacture-configmap.yaml` |
| Secret | created by the infra team in the cluster; keys in [`secret.example.yaml`](secret.example.yaml) |

Pipeline: [`.gitlab-ci.yml`](../.gitlab-ci.yml) (push to `staging` → build → manifest bump → infra reconciler).
Production stays on Vercel (`main`).

## Notes
- **Base path.** The image is built for `/ct-manuf` (`NEXT_PUBLIC_BASE_PATH` build arg). Root-relative
  URLs in code go through `withBase()` (`lib/basePath.ts`); `next/link` and `router` add it themselves.
- **SSO callback** (register with IT): `https://poros-staging.paradev.io/ct-manuf/api/auth/callback/azure-ad`.
- **Notifications on staging** use a JSON store in `/tmp` (ConfigMap `NOTIF_STORE_DIR`): ephemeral and
  separate from production's Vercel Blob store, so Settings → Teams starts empty after every restart.
  While it is empty, `TEAMS_RECIPIENTS` (ConfigMap) + `TEAMS_REFRESH_TOKEN` / `TEAMS_WEBHOOK_URL`
  (Secret) are the send path — real Teams messages, also from staging.
  No CronJob on staging; the old one is in git history (`k8s/cronjob.yaml`) for when production moves.
- **One replica.** The rate limiter (`middleware.ts`) and the query cache (`unstable_cache` in
  `.next/cache`) are per pod.
- Rate limiting reads `x-forwarded-for`; Kong passes it.
