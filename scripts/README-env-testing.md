# Environment Challenge Testing

## Prerequisites

1. **Docker** — running locally with `docker info` succeeding
2. **PostgreSQL** — `docker compose up -d` from the project root
3. **API server** — `pnpm dev:api` running on port 3001

## Running Tests

```bash
./scripts/test-env-challenges.sh
```

Or with a custom base URL:

```bash
BASE_URL=http://localhost:3001 ./scripts/test-env-challenges.sh
```

## What It Tests

For each environment challenge (`lighthouse-incident`, `reef-rescue`, `pipeline-breach`, `phantom-registry`):

1. Challenge exists in the database
2. Workspace tarball downloads successfully
3. Docker service definitions are present

## Environment Challenges

| Challenge | Time Limit | Description |
|-----------|-----------|-------------|
| lighthouse-incident | 90 min | Distributed system incident response |
| reef-rescue | 45 min | Subsystem diagnosis and recovery |
| pipeline-breach | 75 min | CI/CD supply chain forensics |
| phantom-registry | 60 min | Package registry investigation |

These challenges use `requires_environment: true` in the database. When Docker is unavailable, `reef-rescue` can still operate in degraded mode (workspace-only) via the `environmentOptional` flag.
