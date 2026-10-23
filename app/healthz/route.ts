// Liveness/readiness check for Kubernetes (platform Container Contract rule 2).
// Cheap on purpose: no database, no external call, no session.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
