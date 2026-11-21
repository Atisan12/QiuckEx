# Backend

## Health and readiness

The backend exposes two distinct probes so that traffic routing can react to
dependency state without taking a live process out of rotation prematurely.

- **Liveness** (`/health/live`): reports whether the process itself is running.
  It stays available (HTTP 200) during dependency outages, including a Supabase
  outage, so orchestrators do not restart a healthy process.
- **Readiness** (`/health/ready`): reports whether the process can serve traffic.
  It reflects the state of critical dependencies. When Supabase (the critical
  persistence dependency) is unavailable, readiness reports `degraded` and
  returns a non-ready status so traffic is not routed to the instance until the
  dependency recovers.

Readiness output lists each critical dependency with an explicit state
(`ok` / `degraded`) and never includes connection strings, credentials, signing
material, or other secrets. Only the dependency name and its state are exposed.
