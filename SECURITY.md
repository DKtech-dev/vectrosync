# Security and Deployment Policy

## Supported scope

This repository is a research prototype. Public deployments should expose synthetic demonstration data only. Do not connect it directly to an OT network, PLC, VFD, historian containing sensitive data, or safety instrumented system.

## Implemented safeguards

- same-origin/local CORS allowlist by default;
- optional `CATENARY_API_KEY` (or legacy `VECTROSYNC_API_KEY`) enforcement on simulation, scenario, ingestion, and audit endpoints;
- 2 MiB default CSV request limit (`CATENARY_MAX_CSV_BYTES`);
- bounded WebSocket fan-out (`CATENARY_MAX_WEBSOCKETS`);
- fail-closed telemetry quality checks;
- non-root, capability-dropped, read-only container defaults;
- localhost-only Docker Compose port bindings;
- exact Python and npm dependency versions;
- synthetic WebSocket packets marked `control_valid=false`.

An API key is a demo hardening measure, not complete enterprise identity. Browser deployments should use a reverse proxy or API gateway; do not embed secrets in frontend JavaScript.

## Required production controls

Before a private shadow pilot:

1. mTLS or OIDC at an ingress gateway, RBAC, per-well authorization, and short-lived credentials;
2. OT/IT segmentation, unidirectional/read-only historian path where feasible, and no direct actuator route;
3. durable per-well state and signed append-only audit storage with external checkpoints;
4. gateway rate limiting, request deadlines, malware/content controls, quotas, and bounded worker pools;
5. centralized structured logs, metrics, traces, alerting, time synchronization, backups, and restore drills;
6. SBOM generation, image signing, dependency scanning, secret scanning, SAST/DAST, and penetration testing;
7. incident response, key rotation, vulnerability disclosure, and patch SLAs;
8. independent functional-safety design and management of change.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `CATENARY_API_KEY` | Enables `X-API-Key` checks when non-empty (fallback: `VECTROSYNC_API_KEY`) | disabled for local demo |
| `CATENARY_CORS_ORIGINS` | Comma-separated allowed browser origins | localhost only |
| `CATENARY_MAX_CSV_BYTES` | Maximum upload/text payload | 2 MiB |
| `CATENARY_MAX_WEBSOCKETS` | Concurrent synthetic streams/process | 5 |

## Audit limitation

The SHA-256 chain proves only that the current in-memory sequence has not changed without detection since hashes were calculated. It is not durable, keyed, signed, externally timestamped, independently anchored, or WORM-compliant. Restarts lose the process-local chain.

## Reporting a vulnerability

Do not disclose sensitive findings publicly before the owner has a reasonable opportunity to respond. Include affected version, reproduction steps, impact, and suggested mitigation in a private report to the repository owner through the hosting platform's security contact mechanism.
