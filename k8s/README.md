# Kubernetes deploy

| File | What |
|---|---|
| `deployment.yaml` | Deployment + ConfigMap (`NEXTAUTH_URL`, notification settings) + Service — stateless, probes on `/healthz` |
| `ingress.yaml` | Ingress on `<DOMAIN>` with TLS |
| `cronjob.yaml` | Teams notifications runner every 15 min |
| `secret.example.yaml` | Secret template → copy to `secret.yaml` (git-ignored) |

## Fill in first
- `<REGISTRY>` in `deployment.yaml` — internal image registry (infra team)
- `<DOMAIN>` in `deployment.yaml` (`NEXTAUTH_URL`) and `ingress.yaml` — the DNS record
- `<INGRESS_CLASS>` in `ingress.yaml` — `kubectl get ingressclass`
- `secret.yaml` — values from `.env.local` / Vercel → Settings → Environment Variables
- Azure App Registration → Authentication → add redirect URI `https://<DOMAIN>/api/auth/callback/azure-ad`

## Deploy
```bash
docker build --platform linux/amd64 -t <REGISTRY>/control-tower:latest .
docker push <REGISTRY>/control-tower:latest

kubectl create namespace control-tower
kubectl create secret tls control-tower-tls -n control-tower --cert=cert.pem --key=key.pem
kubectl apply -n control-tower -f k8s/secret.yaml
kubectl apply -n control-tower -f k8s/deployment.yaml -f k8s/ingress.yaml -f k8s/cronjob.yaml

kubectl get pods -n control-tower
kubectl logs -n control-tower deploy/control-tower
```

## Notes
- Data source is ClickHouse (`DATA_SOURCE=clickhouse`, internal IP — reachable from the cluster, not from Vercel). Once the cluster runs on ClickHouse, remove Snowflake: `snowflake-sdk` + `@types/snowflake-sdk`, `lib/snowflake.ts` (move `assertTablesAllowed` out), the fallback in `lib/db.ts`, the two debug routes and `serverComponentsExternalPackages` in `next.config.mjs`. This also clears the snowflake-sdk advisories (toml, uuid, fast-xml-parser).
- Stateless: the notification store is Vercel Blob (`BLOB_READ_WRITE_TOKEN`), the same store production on Vercel uses, so settings and the Teams sender carry over. Needs a firewall rule to `*.blob.vercel-storage.com`. If the platform team prefers internal object storage, `lib/notifications/store.ts` needs a new backend.
- Rate limiting reads `x-forwarded-for`; the ingress controller must pass it (nginx does by default).
- The Teams sender must be reconnected after the move unless `NEXTAUTH_SECRET` (or `NOTIF_STORE_KEY`) matches Vercel and the store data is copied over.
