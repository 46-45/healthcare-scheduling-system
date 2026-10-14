# Healthcare Scheduling System

A microservices-based healthcare appointment scheduling system built with NestJS, GraphQL, PostgreSQL, Redis, and Bull Queue.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [GraphQL Examples](#graphql-examples)
- [Project Structure](#project-structure)
- [License](#license)

---

## Features

### Core Features
- **User Authentication** - JWT-based authentication system
- **Customer Management** - CRUD operations for patients
- **Doctor Management** - CRUD operations for doctors
- **Schedule Management** - Appointment scheduling with conflict detection
- **Schedule Filtering** - Filter by customer, doctor, or date range

### Bonus Features
- **Email Notifications** - Automated emails for schedule creation/cancellation
- **Redis Caching** - Performance optimization with 5-minute TTL
- **Bull Queue** - Asynchronous email processing with retry mechanism
- **Pagination** - Efficient data loading with page/limit controls
- **Unit Testing** - Comprehensive test coverage with Jest
- **Docker Deployment** - Containerized services with docker-compose

---

## Architecture

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│                                                                      │
└────────────────┬───────────────────────────┬─────────────────────────┘
                 │                           │
                 │ HTTP/GraphQL              │ HTTP/GraphQL
                 ↓                           ↓
       ┌─────────────────┐         ┌─────────────────────┐
       │  Auth Service   │         │  Schedule Service   │
       │   Port: 3001    │         │    Port: 3002       │
       ├─────────────────┤         ├─────────────────────┤
       │ • Register      │◄────────┤ • AuthGuard         │
       │ • Login         │ validate│ • Customers         │
       │ • ValidateToken │  token  │ • Doctors           │
       │                 │         │ • Schedules         │
       │ GraphQL API     │         │ • Notifications     │
       └────────┬────────┘         └──────────┬──────────┘
                │                             │
                │                             │
                ↓                             ↓
       ┌─────────────────┐         ┌─────────────────────┐
       │   PostgreSQL    │         │   PostgreSQL        │
       │   Port: 5432    │         │   Port: 5432        │
       │  (auth schema)  │         │ (schedule schema)   │
       └─────────────────┘         └─────────────────────┘
                                             │
                ┌────────────────────────────┼────────────────┐
                │                            │                │
                ↓                            ↓                ↓
       ┌─────────────────┐         ┌─────────────────┐  ┌─────────────────┐
       │     Redis       │         │   Bull Queue    │  │    Mailpit      │
       │   Port: 6379    │◄────────┤  (notification) │─→│  Port: 1025     │
       ├─────────────────┤ store   ├─────────────────┤  │  SMTP Server    │
       │ • Cache Data    │ jobs    │ • Email Jobs    │  │                 │
       │ • Queue Storage │         │ • Retry Logic   │  │  Web UI: 8025   │
       └─────────────────┘         └─────────────────┘  └─────────────────┘
```

### Service Communication Flow

```
1. User Authentication Flow:
   Client → Auth Service → PostgreSQL (auth) → JWT Token → Client

2. Create Schedule Flow:
   Client → Schedule Service → AuthGuard → Auth Service (validateToken)
       ↓
   Validate Customer & Doctor → PostgreSQL (schedule)
       ↓
   Create Schedule Record
       ↓
   Enqueue Email Job → Bull Queue → Redis
       ↓
   Return Schedule → Client
       ↓
   (Background) Process Email Job → Nodemailer → Mailpit

3. Query with Cache Flow:
   Client → Schedule Service → Check Redis Cache
       ↓
   Cache Hit? → Return Cached Data
       ↓
   Cache Miss? → Query PostgreSQL → Store in Redis → Return Data
```

---

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **GraphQL** - API query language with Apollo Server
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Next-generation ORM

### Database & Caching
- **PostgreSQL** - Relational database
- **Redis** - In-memory caching and message broker

### Queue & Email
- **Bull** - Redis-based queue for job processing
- **Nodemailer** - Email sending library
- **Mailpit** - Email testing tool

### Testing
- **Jest** - Testing framework
- **Supertest** - HTTP assertions

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** >= 24.x
- **Docker Compose** >= 2.x

### Check Versions

```bash
node --version   # Should be v20.x or higher
npm --version    # Should be 10.x or higher
docker --version
docker-compose --version
```

---

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd healthcare-scheduling
```

### 2. Setup Environment Variables

Copy example environment files and configure them:

```bash
# Root .env file
cp .env.example .env

# Auth service .env file
cp auth-service/.env.example auth-service/.env

# Schedule service .env file
cp schedule-service/.env.example schedule-service/.env
```

**Edit each `.env` file with your configuration** (see [Environment Variables](#environment-variables) section below)

### 3. Install Dependencies (Optional - for local development)

```bash
# Auth service
cd auth-service
npm install

# Schedule service
cd ../schedule-service
npm install
```

**Note:** If running with Docker, dependencies are installed automatically in containers.

---

## Environment Variables

### Root `.env` File

```env
# PostgreSQL Configuration
POSTGRES_USER=healthcare_user
POSTGRES_PASSWORD=healthcare_pass_2024
POSTGRES_DB=healthcare_db

# Auth Service
AUTH_SERVICE_PORT=3001
AUTH_JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
AUTH_JWT_EXPIRATION=3600

# Schedule Service
SCHEDULE_SERVICE_PORT=3002

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Mailpit Configuration (Email Testing)
MAILPIT_SMTP_PORT=1025
MAILPIT_HTTP_PORT=8025
```

### Auth Service `.env`

```env
# Database URL
DATABASE_URL=postgresql://healthcare_user:healthcare_pass_2024@postgres:5432/healthcare_db?schema=auth

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRATION=3600

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Schedule Service `.env`

```env
# Database URL
DATABASE_URL=postgresql://healthcare_user:healthcare_pass_2024@postgres:5432/healthcare_db?schema=schedule

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Auth Service URL
AUTH_SERVICE_URL=http://auth-service:3001/graphql

# SMTP Configuration (Mailpit)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM_EMAIL=noreply@healthcare-scheduling.com
SMTP_FROM_NAME=Healthcare Scheduling System

# Server Configuration
PORT=3002
NODE_ENV=development
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=auth` |
| `JWT_SECRET` | Minimum 32 characters, random string | `your-super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRATION` | Token expiration in seconds | `3600` |
| `REDIS_HOST` | Redis server hostname | `redis` |
| `REDIS_PORT` | Redis server port | `6379` |
| `AUTH_SERVICE_URL` | Auth service GraphQL endpoint | `http://auth-service:3001/graphql` |
| `SMTP_HOST` | SMTP server hostname | `mailpit` |
| `SMTP_PORT` | SMTP server port | `1025` |

---

## Running the Application

### Option 1: Docker

#### Start All Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Mailpit (ports 1025, 8025)
- Auth Service (port 3001)
- Schedule Service (port 3002)
- Notification Service (background worker)

#### Check Container Status

```bash
docker-compose ps
```

Expected output:
```
NAME                                          STATUS
healthcare-scheduling-postgres-1              Up
healthcare-scheduling-redis-1                 Up
healthcare-scheduling-mailpit-1               Up
healthcare-scheduling-auth-service-1          Up (healthy)
healthcare-scheduling-schedule-service-1      Up (healthy)
healthcare-scheduling-notification-service-1  Up
```

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f schedule-service
```

#### Stop Services

```bash
docker-compose down
```

#### Reset Database & Start Fresh

```bash
docker-compose down -v  # Remove volumes
docker-compose up -d     # Start fresh
```

---

### Option 2: Local Development

#### 1. Start Infrastructure Services

```bash
docker-compose up -d postgres redis mailpit
```

#### 2. Run Database Migrations

```bash
# Auth service
cd auth-service
npx prisma migrate deploy
npx prisma generate

# Schedule service
cd ../schedule-service
npx prisma migrate deploy
npx prisma generate
```

#### 3. Start Auth Service

```bash
cd auth-service
npm run start:dev
```

#### 4. Start Schedule Service (in another terminal)

```bash
cd schedule-service
npm run start:dev
```

#### 5. Start Notification Worker (optional, in another terminal)

```bash
cd schedule-service
npm run start:worker
```

---

## Testing

### Run Unit Tests

```bash
# Auth service
cd auth-service
npm test

# Schedule service
cd schedule-service
npm test
```

### Run Tests with Coverage

```bash
# Auth service
cd auth-service
npm run test:cov

# Schedule service
cd schedule-service
npm run test:cov
```

### View Coverage Reports

```bash
# Auth service
open auth-service/coverage/index.html

# Schedule service
open schedule-service/coverage/index.html
```

---

## API Documentation

### GraphQL Playground

#### Auth Service
```
http://localhost:3001/graphql
```

#### Schedule Service
```
http://localhost:3002/graphql
```

**Features:**
- Interactive query editor
- Auto-complete (Ctrl+Space)
- Full schema documentation (DOCS tab)
- Query variables support
- HTTP headers support

### Postman Collection

Import the Postman collection for quick testing:

```
File: Healthcare-Scheduling.postman_collection.json
```

**Import Steps:**
1. Open Postman
2. Click **Import**
3. Select `Healthcare-Scheduling.postman_collection.json`
4. Collection includes 21 pre-configured requests

### Health Check Endpoints

```bash
# Auth Service
curl http://localhost:3001/health

# Schedule Service
curl http://localhost:3002/health
```

### Mailpit Web UI (Email Testing)

```
http://localhost:8025
```

---

## GraphQL Examples

### Auth Service Examples

#### 1. Register User

```graphql
mutation {
  register(
    email: "daniel@hospital.com"
    password: "Daniel_123"
  ) {
    id
    email
    createdAt
    updatedAt
  }
}
```

**Response:**
```json
{
  "data": {
    "register": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "daniel@hospital.com",
      "createdAt": "2026-10-13T10:00:00.000Z",
      "updatedAt": "2026-10-13T10:00:00.000Z"
    }
  }
}
```

---

#### 2. Login

```graphql
mutation {
  login(
    email: "daniel@hospital.com"
    password: "Daniel_123"
  ) {
    accessToken
    expiresAt
  }
}
```

**Response:**
```json
{
  "data": {
    "login": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2026-10-13T11:00:00.000Z"
    }
  }
}
```

**Note: Copy the `accessToken` for use in Schedule Service requests!**

---

#### 3. Validate Token

```graphql
query {
  validateToken(token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...") {
    id
    email
    createdAt
  }
}
```

---

### Schedule Service Examples

**Important:** Add Authorization header for all Schedule Service requests:

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 1. Create Customer

```graphql
mutation {
  createCustomer(
    name: "Daniel Silalahi"
    email: "danielsilalahi135@gmail.com"
  ) {
    id
    name
    email
    createdAt
    updatedAt
  }
}
```

**Response:**
```json
{
  "data": {
    "createCustomer": {
      "id": "customer-uuid-here",
      "name": "Daniel Silalahi",
      "email": "danielsilalahi135@gmail.com",
      "createdAt": "2026-10-13T10:05:00.000Z",
      "updatedAt": "2026-10-13T10:05:00.000Z"
    }
  }
}
```

---

#### 2. Create Doctor

```graphql
mutation {
  createDoctor(name: "Dr. Tirta") {
    id
    name
    createdAt
    updatedAt
  }
}
```

---

#### 3. Create Schedule

```graphql
mutation {
  createSchedule(
    createScheduleInput: {
      customerId: "customer-uuid-here"
      doctorId: "doctor-uuid-here"
      scheduledAt: "2026-10-20T14:00:00+07:00"
      objective: "General Checkup"
    }
  ) {
    id
    objective
    scheduledAt
    customer {
      id
      name
      email
    }
    doctor {
      id
      name
    }
    createdAt
    updatedAt
  }
}
```

**Response:**
```json
{
  "data": {
    "createSchedule": {
      "id": "schedule-uuid-here",
      "objective": "General Checkup",
      "scheduledAt": "2026-10-20T07:00:00.000Z",
      "customer": {
        "id": "customer-uuid",
        "name": "Daniel Silalahi",
        "email": "danielsilalahi135@gmail.com"
      },
      "doctor": {
        "id": "doctor-uuid",
        "name": "Dr. Tirta"
      },
      "createdAt": "2026-10-13T10:10:00.000Z",
      "updatedAt": "2026-10-13T10:10:00.000Z"
    }
  }
}
```

**Note: Check Mailpit (http://localhost:8025) for confirmation email!**

---

#### 4. Get All Schedules with Pagination

```graphql
query {
  schedules(
    filters: {
      page: 1
      limit: 10
    }
  ) {
    data {
      id
      objective
      scheduledAt
      customer {
        name
        email
      }
      doctor {
        name
      }
    }
    pagination {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
```

---

#### 5. Filter Schedules by Customer

```graphql
query {
  schedules(
    filters: {
      customerId: "customer-uuid-here"
      page: 1
      limit: 10
    }
  ) {
    data {
      id
      objective
      scheduledAt
      doctor {
        name
      }
    }
    pagination {
      totalCount
    }
  }
}
```

---

#### 6. Filter Schedules by Date Range

```graphql
query {
  schedules(
    filters: {
      scheduledAtFrom: "2026-10-01T00:00:00Z"
      scheduledAtTo: "2026-10-31T23:59:59Z"
      page: 1
      limit: 10
    }
  ) {
    data {
      id
      objective
      scheduledAt
      customer { name }
      doctor { name }
    }
    pagination {
      totalCount
    }
  }
}
```

---

#### 7. Get Schedule by ID

```graphql
query {
  schedule(id: "schedule-uuid-here") {
    id
    objective
    scheduledAt
    customer {
      id
      name
      email
    }
    doctor {
      id
      name
    }
    createdAt
    updatedAt
  }
}
```

---

#### 8. Delete Schedule

```graphql
mutation {
  deleteSchedule(id: "schedule-uuid-here")
}
```

**Response:**
```json
{
  "data": {
    "deleteSchedule": true
  }
}
```

**Note: Check Mailpit for cancellation email!**

---

#### 9. Update Customer

```graphql
mutation {
  updateCustomer(
    id: "customer-uuid-here"
    name: "Daniel Silalahi Updated"
  ) {
    id
    name
    email
    updatedAt
  }
}
```

---

#### 10. Get All Customers (Cached)

```graphql
query {
  customers(page: 1, limit: 10) {
    data {
      id
      name
      email
      createdAt
    }
    pagination {
      currentPage
      totalPages
      totalCount
    }
  }
}
```

**Note:** Results are cached in Redis for 5 minutes

---

## Project Structure

```
healthcare-scheduling/
├── auth-service/
│   ├── prisma/
│   │   ├── migrations/           # Database migrations
│   │   └── schema.prisma         # Auth database schema
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts   # Business logic
│   │   │   ├── auth.resolver.ts  # GraphQL resolver
│   │   │   ├── dto/              # Input DTOs
│   │   │   └── entities/         # GraphQL types
│   │   ├── common/
│   │   │   └── filters/          # Exception filters
│   │   ├── health/               # Health check
│   │   ├── prisma/               # Prisma service
│   │   └── main.ts               # Bootstrap
│   ├── test/                     # Unit tests
│   ├── Dockerfile
│   ├── package.json
│   └── jest.config.js
│
├── schedule-service/
│   ├── prisma/
│   │   ├── migrations/           # Database migrations
│   │   └── schema.prisma         # Schedule database schema
│   ├── src/
│   │   ├── customers/
│   │   │   ├── customers.module.ts
│   │   │   ├── customers.service.ts
│   │   │   ├── customers.resolver.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   ├── doctors/
│   │   │   ├── doctors.module.ts
│   │   │   ├── doctors.service.ts
│   │   │   ├── doctors.resolver.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   ├── schedules/
│   │   │   ├── schedules.module.ts
│   │   │   ├── schedules.service.ts    # Schedule CRUD + conflict detection
│   │   │   ├── schedules.resolver.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   ├── notification/
│   │   │   ├── notification.module.ts
│   │   │   └── notification.processor.ts  # Bull queue processor
│   │   ├── cache/
│   │   │   └── cache.service.ts        # Redis caching
│   │   ├── common/
│   │   │   ├── guards/                 # Auth guard
│   │   │   └── entities/               # Pagination types
│   │   ├── health/                     # Health check
│   │   ├── prisma/                     # Prisma service
│   │   ├── main.ts                     # Bootstrap
│   │   └── worker.ts                   # Queue worker
│   ├── test/                           # Unit tests
│   ├── Dockerfile
│   ├── package.json
│   └── jest.config.js
│
├── docker-compose.yml                  # Multi-container orchestration
├── .env.example                        # Environment template
├── README.md                           # This file
└── Healthcare-Scheduling.postman_collection.json  # Postman collection
```

---

## Quick Start Guide

**Prerequisites:**
- Node.js >= 20.x
- Docker and Docker Compose installed
- Git

**Steps to Run:**

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd healthcare-scheduling
   ```

2. Configure environment variables
   ```bash
   cp .env.example .env
   cp auth-service/.env.example auth-service/.env
   cp schedule-service/.env.example schedule-service/.env
   ```

3. Start all services with Docker
   ```bash
   docker-compose up -d
   ```

4. Verify all containers are running
   ```bash
   docker-compose ps
   ```

5. Access the services
   - Auth Service GraphQL: http://localhost:3001/graphql
   - Schedule Service GraphQL: http://localhost:3002/graphql
   - Mailpit (Email UI): http://localhost:8025

6. Test with Postman
   - Import `Healthcare-Scheduling.postman_collection.json`
   - Run requests in sequence: Register → Login → Create Customer → Create Doctor → Create Schedule

7. Verify email notifications
   - Check Mailpit UI at http://localhost:8025
   - Emails are sent after creating and deleting schedules

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :5432

# Kill the process
taskkill /PID <process-id> /F
```

### Database Connection Issues

```bash
# Check PostgreSQL container
docker logs healthcare-scheduling-postgres-1

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Issues

```bash
# Check Redis container
docker logs healthcare-scheduling-redis-1

# Test Redis connection
docker exec -it healthcare-scheduling-redis-1 redis-cli ping
```

### Container Won't Start

```bash
# View logs
docker-compose logs <service-name>

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v
docker system prune -a

# Start fresh
docker-compose up -d
```

---

**Built using NestJS, GraphQL, PostgreSQL, Redis, and Docker**
