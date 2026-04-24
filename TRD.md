# 📄 Technical Requirements Document: Time-Off Microservice

---

## 1. Overview

The Time-Off Microservice enables ReadyOn employees to request time off while maintaining a local cache of leave balances sourced from the external HCM system (Workday/SAP). It handles request lifecycle, balances as a cache, and graceful degradation when HCM is unavailable.

---

## 2. Problem Statement

Two systems (ReadyOn and HCM) can update employee leave balances independently. HCM is the source of truth, but its real-time and batch APIs may be unreliable (e.g., 500 errors, network timeouts). Balance is scoped per employee and per location, and HCM may change balances without notice (work anniversaries, year resets).

ReadyOn must be defensive: validate locally, handle HCM failures without losing requests, and support both pull and push sync strategies.

---

## 3. Stakeholders & User Needs

**Employee**
Needs accurate, up-to-date balance display and immediate feedback when submitting a request. Cannot wait indefinitely for HCM responses.

**Manager**
Needs confidence that approved requests are based on valid balances and that the data presented reflects HCM truth after eventual synchronization.

---

## 4. Functional Requirements

| ID | Description |
|---|---|
| FR1 | Employee can submit a time-off request with `employeeId`, `locationId`, `startDate`, `endDate`, `daysRequested`. |
| FR2 | System validates the local balance cache before calling HCM. |
| FR3 | System submits the request to HCM for final approval (real-time validation). |
| FR4 | If HCM approves, the local balance is deducted and request status becomes `APPROVED`. |
| FR5 | If HCM rejects (4xx), request status becomes `REJECTED` and balance is unchanged. |
| FR6 | If HCM is unavailable (5xx or network error), request status becomes `PENDING` for later retry; balance unchanged. |
| FR7 | Employee can cancel a `PENDING` or `APPROVED` request; cancellation of an `APPROVED` request restores the local balance. |
| FR8 | Manager/system can trigger a full batch pull sync from HCM, overwriting the local Balance table. |
| FR9 | HCM can push batch balance updates to ReadyOn via `POST /sync/batch`. |
| FR10 | System exposes a GET endpoint to read current balance per employee and location. |

---

## 5. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| **Availability** | Service must remain operational even when HCM is down; pending requests are stored for later processing. |
| **Data Consistency** | Local balance is a cache that may lag behind HCM. Batch sync (pull or push) brings eventual consistency. Balance deductions are idempotent per request ID. |
| **Defensive Validation** | Always check local balance before calling HCM to avoid unnecessary requests and provide immediate user feedback. |
| **Idempotency of Sync** | Repeated batch sync calls overwrite balances; duplicate entries in the same batch are handled by upsert. |
| **Performance** | SQLite acceptable for assessment scope (<1M records). Expected latency under 100ms for balance reads and request submission. |
| **Security** | Input validation via `class-validator`. No sensitive data in logs. Logged fields: method, path, status, `employeeId`, `locationId` (not days unless debug). |

---

## 6. System Architecture

The microservice follows a layered architecture:

```
Client
│
▼
TimeOffController        ← HTTP interface (NestJS)
│
▼
TimeOffService           ← Orchestration (request lifecycle, sync logic)
│
├──────► BalanceService  ← Local cache operations (upsert, deduct, batch)
│            │
│            ▼
│        SQLite via TypeORM (Balance, TimeOffRequest)
│
└──────► HcmService      ← HTTP client to external HCM system
             │
             ▼
         Mock HCM Server (Express on port 4000)
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **TimeOffController** | Exposes REST endpoints, Swagger documentation, request validation. |
| **TimeOffService** | Orchestrates balance checks, HCM calls, status transitions, and cancellations. |
| **BalanceService** | Manages local Balance table — get, upsert, deduct, batch sync. |
| **HcmService** | HTTP client with error classification: 4xx → reject, 5xx/unreachable → pending. |
| **SQLite + TypeORM** | Local state storage. `synchronize: true` (acceptable for assessment). |
| **Mock HCM Server** | Standalone Express server simulating HCM behavior (seed data, random 5xx, batch endpoints, reset endpoint). |

---

## 7. Data Model

### Table: `TimeOffRequest`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `employeeId` | string | NOT NULL, indexed |
| `locationId` | string | NOT NULL, indexed |
| `startDate` | string (ISO date) | NOT NULL |
| `endDate` | string (ISO date) | NOT NULL |
| `daysRequested` | decimal(10,2) | NOT NULL |
| `status` | enum | `PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELLED`; default `PENDING` |
| `createdAt` | datetime | Auto |
| `updatedAt` | datetime | Auto |

### Table: `Balance`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `employeeId` | string | NOT NULL |
| `locationId` | string | NOT NULL |
| `availableDays` | decimal(10,2) | NOT NULL, default `0` |
| `lastSyncedAt` | datetime | NULLable |
| `createdAt` | datetime | Auto |
| `updatedAt` | datetime | Auto |

> **Unique constraint:** `(employeeId, locationId)`

---

## 8. API Design

| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/time-off` | Submit new request | `{ employeeId, locationId, startDate, endDate, daysRequested }` | `TimeOffRequest` |
| `GET` | `/time-off/:id` | Get request by ID | — | `TimeOffRequest` |
| `GET` | `/time-off?employeeId=X` | List all requests for employee | — | `TimeOffRequest[]` |
| `PATCH` | `/time-off/:id/cancel` | Cancel request | — | `TimeOffRequest` |
| `GET` | `/balance/:employeeId/:locationId` | Get current cached balance | — | `Balance` |
| `POST` | `/sync/hcm` | Trigger pull batch sync from HCM | — | `{ message }` |
| `POST` | `/sync/batch` | HCM pushes batch update | `{ balances: HcmBalanceDto[] }` | `{ message }` |

> All endpoints return appropriate HTTP status codes: `201` for POST create, `200` otherwise. Validation errors return `400`. Missing resources return `404`.

---

## 9. Key Design Decisions & Challenges

### 9.1 Defensive Local Balance Check

**Decision:** Always validate against local balance before invoking HCM.

**Rationale:** HCM error responses are not guaranteed (network timeouts, 5xx). This prevents unnecessary outbound calls and gives immediate feedback to the user.

**Alternative Considered:** Trust HCM entirely for every request. Rejected because HCM flakiness would cause user frustration and failed requests.

---

### 9.2 `PENDING` State for HCM Downtime

**Decision:** When HCM is unreachable (5xx or network error), save request as `PENDING` instead of failing.

**Rationale:** Preserves user intent and allows background retry (out of scope but feasible). Avoids data loss.

**Alternative Considered:** Fail immediately with `503`. Rejected because the request would be lost and the user would need to resubmit.

---

### 9.3 Local Balance as Cache, HCM as Source of Truth

**Decision:** Local balance is a cache that can be completely overwritten by batch sync. HCM remains the sole authority.

**Rationale:** HCM can update balances independently (anniversaries, year resets). ReadyOn cannot be authoritative.

**Alternative Considered:** Bidirectional sync (ReadyOn pushes deductions to HCM and also accepts HCM updates). Rejected due to complexity and conflict resolution overhead.

---

### 9.4 Sync Strategy: Pull + Push

**Decision:** Support both HCM-initiated push (`POST /sync/batch`) and ReadyOn-initiated pull (`POST /sync/hcm`).

**Rationale:** The HCM batch endpoint covers bulk updates (e.g., overnight jobs). Pull enables manual triggers (e.g., after an outage).

**Alternative Considered:** Polling only. Rejected because it adds latency and unnecessary load.

---

### 9.5 SQLite for Assessment Scope

**Decision:** Use SQLite with the `better-sqlite3` driver.

**Rationale:** Zero configuration, file-based, sufficient for assessment scale.

**Alternative Considered:** PostgreSQL. Preferred for production due to better concurrency, transactions, and connection pooling — but overkill for this assessment.

---

## 10. Test Strategy

### Unit Tests (Jest)

| Module | Coverage |
|---|---|
| `TimeOffService` | 8 test cases: approval, rejection, PENDING, cancellation with balance restore, insufficient local balance, sync orchestration. |
| `BalanceService` | 7 test cases: get, upsert (create/update), deduct (sufficient/insufficient), batch sync. |

### Integration / E2E Tests (Supertest + Nock)

- Full HTTP lifecycle using `@nestjs/testing` and in-memory SQLite (`:memory:`).
- Nock intercepts calls to `http://localhost:4000` to simulate HCM responses.
- Scenarios covered: successful request creation, HCM rejection, 500 error → `PENDING`, cancellation, batch sync pull, and balance endpoint.

### Mock HCM Server (Standalone Express)

- Runs on port 4000, seeded with three balance records.
- Simulates realistic HCM behavior: 10% random 500 error on `/hcm/time-off`, validation, deduction.
- Provides `/hcm/reset` for test teardown and `/hcm/anniversary-bonus` to simulate independent HCM balance updates.
- Used in e2e tests via nock (not live server) but can be run manually for local exploration.

---

## 11. Out of Scope

- Authentication and authorization *(assumed to be handled by API gateway)*
- Multi-tenancy
- Leave type categories *(sick, vacation, personal)*
- Frontend user interface
- Production database migration strategy *(PostgreSQL recommended)*
- Retry queue implementation *(PENDING state is created; automatic retry mechanism not required)*
- Real HCM integration *(assessment uses a mock server)*
