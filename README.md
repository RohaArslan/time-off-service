# Time-Off Microservice
**GitHub Repository:** https://github.com/RohaArslan/time-off-service

## Project Overview

A NestJS-based microservice for managing employee time-off requests with local balance caching and integration with a mock HCM system. It handles request lifecycle, balance validation, and synchronization between internal balances and external HCM data. Designed as a take-home assessment demonstrating clean architecture, error handling, and testing strategies.

## Tech Stack

- **NestJS** (Node.js framework)
- **TypeORM** with **better-sqlite3** (SQLite driver)
- **SQLite** (embedded database)
- **Jest** (unit & e2e testing)
- **Swagger** (API documentation)
- **Express** (standalone mock HCM server)

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

## Setup & Run

1. Install dependencies:
   ```bash
   npm install
Start the mock HCM server (in a separate terminal):

bash
node mock-hcm/server.js
The HCM server runs on http://localhost:4000.

Start the Time-Off microservice:

bash
npm run start:dev
Open Swagger UI: http://localhost:3000/api

Running Tests
Command	Description
npm test	Run unit tests (once)
npm run test:watch	Run unit tests in watch mode
npm run test:e2e	Run end-to-end tests
npm run test:cov	Generate test coverage report
API Endpoints
Method	Path	Description
POST	/time-off	Create a new time-off request
GET	/time-off/:id	Retrieve a request by UUID
GET	/time-off?employeeId=	List all requests for an employee
PATCH	/time-off/:id/cancel	Cancel a request (restores balance if approved)
GET	/balance/:employeeId/:locationId	Get current available balance
POST	/sync/hcm	Trigger manual pull sync from HCM batch endpoint
POST	/sync/batch	Receive batch balance push from HCM
Environment Variables
Variable	Default	Description
PORT	3000	Port the NestJS app listens on
DATABASE_PATH	timeoff.sqlite	Path to SQLite database file
HCM_BASE_URL	http://localhost:4000	Base URL of the mock HCM server
Architecture Decisions
SQLite with synchronize: true: Acceptable for this assessment to auto‑create schema without migrations. Not recommended for production without careful schema versioning.

Defensive local balance check: The service validates balance against the local cache before calling HCM. This reduces unnecessary external calls and provides immediate feedback when balance is insufficient.

PENDING state for HCM downtime: If HCM is unreachable (5xx or network error), the request is saved as PENDING and balance is not deducted. This allows manual or automated retries without data loss.

Batch sync strategy: A separate /sync/hcm endpoint pulls all balances from HCM and upserts them locally. The HCM can also push updates via /sync/batch. This bidirectional sync ensures eventual consistency between systems.