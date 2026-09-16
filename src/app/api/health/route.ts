import { NextResponse } from "next/server";

// Deploy pipeline (`deploy.yml`) curls this after `pm2 restart` — pm2 exits
// zero even when the app crash-loops on boot, so this is the only way to
// know the process actually serves HTTP before we mark the deploy green.
// Kept intentionally shallow: don't hit the backend or DB, or a transient
// upstream outage would fail an otherwise valid frontend deploy.
export function GET() {
  return NextResponse.json({ ok: true });
}
