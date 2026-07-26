# URL Shortener System Design & Implementation Guide

> **Project:** URL Shortener (Bitly Clone)
>
> This document serves as the design and implementation guide for the URL Shortener module. The goal is to build a production-ready, scalable URL shortening service while understanding the design decisions behind each component.

---

# Table of Contents

1. Project Overview
2. Requirements
3. High Level Architecture
4. Functional Flow
5. Database Design
6. API Design
7. Short Code Generation
8. Redirect Flow
9. Redis Caching
10. Expiration
11. Custom Alias
12. Click Analytics
13. Scaling Strategy
14. High Availability
15. Security Considerations
16. Future Improvements
17. Development Roadmap

---

# 1. Project Overview

A URL Shortener converts a long URL into a compact URL that is easier to share.

Example:

Long URL

```
https://www.youtube.com/watch?v=7dSJubxFWv0&t=12345
```

Short URL

```
https://short.ly/aB92Xf
```

Whenever someone opens

```
https://short.ly/aB92Xf
```

they are automatically redirected to the original URL.

---

# 2. Requirements

## Functional Requirements

### Create Short URL

Input

```
POST /urls
```

```json
{
  "url":"https://google.com"
}
```

Output

```json
{
   "shortUrl":"https://short.ly/Ab3XQ9"
}
```

---

### Redirect

```
GET /Ab3XQ9
```

Redirect

```
302 Found
Location: https://google.com
```

---

### Custom Alias

Input

```json
{
   "url":"https://google.com",
   "alias":"google"
}
```

Output

```
https://short.ly/google
```

---

### URL Expiration

Input

```json
{
   "expiresAt":"2027-01-01"
}
```

Expired URLs should return

```
404 Not Found
```

or

```
410 Gone
```

---

### User Authentication

Only authenticated users can

- Create URL
- Update URL
- Delete URL
- View Analytics

Anyone can access

```
GET /:shortCode
```

without authentication.

---

# 3. High Level Architecture

```
                    Client
                       │
             HTTP Request
                       │
                       ▼
                Load Balancer
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
    Read Service               Write Service
         │                           │
         │                     Redis Counter
         │                           │
         ▼                           ▼
     Redis Cache              Base62 Encoder
         │                           │
         └─────────────┬─────────────┘
                       ▼
                 PostgreSQL
```

---

# 4. Functional Flow

## URL Creation

```
User

↓

POST /urls

↓

Authentication

↓

Generate Unique ID

↓

Base62 Encode

↓

Save in Database

↓

Return Short URL
```

---

## URL Redirect

```
Browser

↓

GET /abc123

↓

Redis

↓

Cache Hit?

↓

YES → Redirect

NO

↓

Database

↓

Store in Redis

↓

Redirect
```

---

# 5. Database Design

## users

Already implemented.

---

## urls

| Column | Type | Description |
|----------|------|-------------|
| id | BIGINT | Primary Key |
| user_id | UUID | Owner |
| long_url | TEXT | Original URL |
| short_code | VARCHAR(10) | Unique Code |
| custom_alias | VARCHAR(50) | Optional |
| expires_at | TIMESTAMP | Optional |
| clicks | BIGINT | Total Clicks |
| is_active | BOOLEAN | Active Status |
| created_at | TIMESTAMP | Created Time |
| updated_at | TIMESTAMP | Updated Time |

Indexes

```
PRIMARY KEY(id)

UNIQUE(short_code)

INDEX(user_id)

INDEX(created_at)
```

---

# 6. API Design

## Create URL

```
POST /api/v1/urls
```

Request

```json
{
   "url":"https://google.com"
}
```

---

## Create Custom URL

```json
{
   "url":"https://google.com",
   "alias":"google"
}
```

---

## Get User URLs

```
GET /api/v1/urls
```

---

## Get Single URL

```
GET /api/v1/urls/:id
```

---

## Delete URL

```
DELETE /api/v1/urls/:id
```

---

## Redirect

```
GET /abc123
```

Returns

```
302 Redirect
```

---

## Analytics

```
GET /api/v1/urls/:id/analytics
```

---

# 7. Short Code Generation

## Why not Random?

Random generation introduces collisions.

Example

```
abc123
```

might already exist.

Then we need

```
Generate

↓

Check DB

↓

Collision?

↓

Generate Again
```

Not efficient.

---

## Counter Based Approach

Every URL gets a unique number.

```
1

2

3

4

5

6
```

Redis provides

```
INCR
```

which atomically generates

```
1001

1002

1003
```

No collisions.

---

## Base62 Encoding

Characters

```
0-9

a-z

A-Z
```

Total

```
62 Characters
```

Example

```
1001

↓

Base62

↓

G9
```

Result

```
https://short.ly/G9
```

---

## Capacity

```
5 chars

62⁵

≈916 Million
```

```
6 chars

62⁶

≈56 Billion
```

```
7 chars

≈3.5 Trillion
```

We will use

```
6 Characters
```

---

# 8. Redirect Flow

```
Browser

↓

GET /abc123

↓

Redis

↓

Cache Hit?

↓

YES

↓

Return Long URL

↓

302 Redirect
```

Cache Miss

```
Redis

↓

Database

↓

Store in Redis

↓

302 Redirect
```

---

# 9. Redis Cache

Purpose

- Faster lookups
- Reduce DB load
- Handle popular URLs

Redis Key

```
url:abc123
```

Value

```
https://google.com
```

TTL

```
24 Hours
```

Eviction

```
LRU
```

---

# 10. Expiration

Before redirect

Check

```
expires_at
```

If

```
Current Time > expires_at
```

Return

```
410 Gone
```

Otherwise

Continue redirect.

---

# 11. Custom Alias

User requests

```
short.ly/google
```

Check

```
Does "google" exist?
```

If yes

```
409 Conflict
```

Otherwise

Store alias.

---

# 12. Click Analytics

Each redirect increments

```
clicks++
```

Analytics can include

- Total Clicks
- Daily Clicks
- Device
- Browser
- Country
- Referrer

Future Design

```
Redirect

↓

Kafka Queue

↓

Analytics Service

↓

Database
```

This avoids slowing redirects.

---

# 13. Scaling Strategy

## Reads >> Writes

Expected

```
Writes

~3/sec
```

```
Reads

3000/sec
```

Use

```
Redis Cache
```

to handle reads.

---

## Horizontal Scaling

```
           Load Balancer

        /      |      \

Server1 Server2 Server3
```

---

## Read / Write Separation

```
Read Service

↓

Redirects
```

```
Write Service

↓

Create URLs
```

---

## Redis Counter

```
Write Server

↓

Redis

↓

Counter

↓

Base62

↓

Database
```

---

## Counter Batching

Instead of

```
Redis

↓

1001
```

every request

allocate

```
1000 IDs
```

Server owns

```
1001

↓

2000
```

When exhausted

request another batch.

---

# 14. High Availability

## PostgreSQL Replication

```
Primary

↓

Replica

↓

Replica
```

Failover

Automatic.

---

## Redis Sentinel

```
Primary Redis

↓

Replica Redis
```

Automatic promotion.

---

## Backup

Nightly Snapshot

```
Cloud Storage
```

Point-In-Time Recovery.

---

# 15. Security Considerations

## Validate URLs

Only allow

```
http

https
```

Reject

```
javascript:

ftp:

file:
```

---

## Rate Limiting

Prevent abuse.

Example

```
100 URL creations/hour
```

---

## Authentication

JWT Authentication

Protected Endpoints

```
POST

PUT

DELETE
```

Public

```
GET /:shortCode
```

---

## SQL Injection

Use parameterized queries.

---

## XSS

Escape user input.

---

## HTTPS

Always redirect using HTTPS.

---

# 16. Future Improvements

- QR Code Generation
- Password Protected URLs
- Team Workspaces
- URL Tags
- Bulk URL Upload
- REST API Keys
- GraphQL API
- Geo Redirects
- A/B Testing
- Scheduled Activation
- Link Preview
- Webhooks
- Custom Domains
- Analytics Dashboard

---

# 17. Development Roadmap

## Phase 1

✅ Authentication

✅ User Module

---

## Phase 2

- URL Entity
- URL Repository
- URL Service
- URL Controller
- Create URL
- Get URLs
- Delete URL

---

## Phase 3

- Base62 Encoder
- Redis Counter
- Short Code Generator

---

## Phase 4

- Redirect Endpoint
- Redis Cache
- Expiration Logic

---

## Phase 5

- Click Analytics
- Dashboard APIs
- Pagination
- Search
- Sorting

---

## Phase 6

- Rate Limiting
- Background Jobs
- Monitoring
- Logging
- Docker
- CI/CD
- Deployment

---

# Final Tech Stack

| Component | Technology |
|------------|------------|
| Backend | NestJS |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) |
| Cache | Redis |
| Authentication | JWT |
| ORM | Prisma |
| Validation | class-validator |
| API Docs | Swagger |
| Containerization | Docker |
| Deployment | Railway / Render / AWS |
| Monitoring | Grafana + Prometheus |

---

# Learning Objectives

By building this project, we will gain hands-on experience with:

- Production-ready NestJS architecture
- JWT Authentication & Authorization
- PostgreSQL database design
- Redis caching strategies
- Base62 encoding algorithms
- Atomic counters with Redis
- URL redirect mechanisms (302 vs 301)
- API design best practices
- Database indexing
- Horizontal scalability
- Read/Write service separation
- High availability concepts
- System Design fundamentals
- Low-Level Design implementation
- Performance optimization
- Production deployment
- Monitoring and observability

---

> **Goal:** Build a URL Shortener that is not just functional, but designed using the same architectural principles employed by real-world systems like Bitly, TinyURL, and Rebrandly.