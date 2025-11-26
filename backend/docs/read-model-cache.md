## Read-model & cache-aside (Milestone 5)

### What was added
- Cache-aside layer using Redis (`REDIS_URL`, optional `REDIS_TLS=true`) for high-read application data.
- CQRS-lite read model that prefers `application_view` if present; falls back to the primary `Application` table.
- Real-time status stream (SSE) tied to cache refreshes.

### Key services
- `ReadModelModule` (`backend/src/read-model/read-model.module.ts`) wires:
  - `RedisCacheService`: thin Redis client with safe fallbacks.
  - `ApplicationViewService`: reads from `application_view` via `Prisma.$queryRaw`, falls back to `application`.
  - `ApplicationReadService`: cache-aside orchestrator; refresh/evict helpers; emits status updates.
  - `ApplicationStatusStream`: SSE stream for status changes.

### Routes
- `GET /read/applications/:id` — cached read for a single application (404 if missing).
- `GET /read/applications?userId=...` — cached list for a user (CQRS-lite view).
- `POST /read/applications/:id/refresh` — refresh cache + emit status event immediately.
- `SSE /read/applications/stream` — real-time status updates (from refreshes).

### Feature flags (toggle behavior via Admin UI)
- `cache-aside`: when ON use Redis cache-aside; when OFF skip cache and read DB/view directly.
- `cqrs-lite`: when ON prefer `application_view`; when OFF read directly from `Application` table.

### Integration with writes
- `ApplicationsService.createApplication` warms cache after creation.
- `ApplicationsService.updateStatus` refreshes cache and emits a status event after status changes.
- `findAll` now uses the cache-aside read model with graceful fallback to Prisma.

### Environment
```
REDIS_URL=redis://localhost:6379
REDIS_TLS=true                # optional, for TLS Redis
APPLICATION_CACHE_TTL_SECONDS=60
```

### Optional `application_view`
If you want to use a database view for the CQRS-lite read path, create it like:
```sql
CREATE OR REPLACE VIEW application_view AS
SELECT
  id,
  "userId",
  status,
  progress,
  "createdAt",
  "updatedAt"
FROM "Application";
```

### Notes
- If `application_view` is not present, the code logs a debug message and uses the source table automatically.
- Cache failures do not break reads; they fallback to the database.
