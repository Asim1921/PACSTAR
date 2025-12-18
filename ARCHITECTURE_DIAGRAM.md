# PACSTAR - Detailed Design Diagrams
## Platform for Advanced Cybersecurity Training and Assessment Resource

---

## Table of Contents
1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Component Architecture](#2-component-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Database Schema](#5-database-schema)
6. [API Flow Diagrams](#6-api-flow-diagrams)
7. [Authentication Flow](#7-authentication-flow)
8. [Challenge Deployment Flow](#8-challenge-deployment-flow)
9. [Infrastructure Integration](#9-infrastructure-integration)
10. [Docker Deployment Architecture](#10-docker-deployment-architecture)
11. [Network Architecture](#11-network-architecture)
12. [Security Architecture](#12-security-architecture)

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PACSTAR CTF PLATFORM                                    │
│                         High-Level System Architecture                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   Users     │
                                    │ (Browser)   │
                                    └──────┬──────┘
                                           │
                                           │ HTTPS (Port 3505)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                       │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Next.js 14 Frontend (TypeScript)                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │  │
│  │  │   Auth UI    │  │  Dashboard   │  │   Admin UI   │  │  User UI     │       │  │
│  │  │ Login/Signup │  │   Profile    │  │  Challenges  │  │ Challenges   │       │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │  │
│  │                                                                                 │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Reusable UI Components                               │   │  │
│  │  │   Button | Input | Select | Toast | InfoBox | RadioGroup               │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ REST API (via Proxy /api/proxy)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         FastAPI Backend (Python)                     Port 8000 │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                           API Endpoints                                 │   │  │
│  │  │  /auth  │ /users │ /teams │ /challenges │ /files │ /builder │/openstack│   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                           Services Layer                                │   │  │
│  │  │  AuthService | UserService | TeamService | ChallengeService | ...      │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                           Middleware                                    │   │  │
│  │  │           RBAC | Audit | Error Handler | Rate Limiter                  │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ MongoDB Wire Protocol
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATA LAYER                                           │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           MongoDB 7.0                              Port 27017  │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │  │
│  │  │   users    │ │   teams    │ │ challenges │ │submissions │ │   files    │   │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘   │  │
│  │  ┌────────────────────────────┐  ┌────────────────────────────┐              │  │
│  │  │  challenge_instances      │  │          events             │              │  │
│  │  └────────────────────────────┘  └────────────────────────────┘              │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                      │
                        ▼                                      ▼
┌────────────────────────────────┐      ┌────────────────────────────────────────────┐
│     KUBERNETES CLUSTER         │      │              OPENSTACK CLOUD               │
│  ┌──────────────────────────┐  │      │  ┌──────────────────────────────────────┐  │
│  │   Container Challenges   │  │      │  │         VM-based Challenges          │  │
│  │  ┌──────┐  ┌──────┐     │  │      │  │  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │ Pod  │  │ Pod  │ ... │  │      │  │  │   VM   │  │   VM   │  │   VM   │ │  │
│  │  └──────┘  └──────┘     │  │      │  │  └────────┘  └────────┘  └────────┘ │  │
│  │  Services | LoadBalancer │  │      │  │  Nova | Neutron | Heat | Glance    │  │
│  └──────────────────────────┘  │      │  └──────────────────────────────────────┘  │
└────────────────────────────────┘      └────────────────────────────────────────────┘
```

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          PACSTAR Component Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                           │
│                              (Next.js 14 + React)                                    │
│                                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │
│  │   app/          │    │  components/    │    │     lib/        │                  │
│  │  ├── page.tsx   │    │  ├── admin/     │    │  └── api.ts     │                  │
│  │  ├── layout.tsx │    │  ├── auth/      │    │      (Axios     │                  │
│  │  ├── globals.css│    │  ├── ui/        │    │       Client)   │                  │
│  │  └── dashboard/ │    │  └── user/      │    │                 │                  │
│  │      └── page   │    │                 │    │                 │                  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘                  │
│           │                      │                      │                            │
│           └──────────────────────┼──────────────────────┘                            │
│                                  │                                                   │
│                                  ▼                                                   │
│                    ┌─────────────────────────┐                                       │
│                    │   API Proxy Layer       │                                       │
│                    │  /api/proxy/[...path]   │                                       │
│                    │  (Bypasses CORS)        │                                       │
│                    └─────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP/HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   BACKEND                                            │
│                           (FastAPI + Python 3.12)                                    │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              app/main.py                                      │   │
│  │                         (FastAPI Application)                                 │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                               │
│         ┌────────────────────────────┼────────────────────────────┐                 │
│         │                            │                            │                 │
│         ▼                            ▼                            ▼                 │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐            │
│  │  api/v1/     │           │  services/   │           │  middleware/ │            │
│  │  endpoints/  │           │              │           │              │            │
│  │  ├── auth    │──────────▶│ auth_service │           │ ├── audit    │            │
│  │  ├── user    │           │ user_service │           │ ├── rbac     │            │
│  │  ├── team    │           │ team_service │           │ └── error    │            │
│  │  ├── challenge│          │ challenge_svc│           │    handler   │            │
│  │  ├── files   │           │ k8s_service  │           │              │            │
│  │  ├── builder │           │ openstack_svc│           │              │            │
│  │  ├── openstack│          │ event_service│           │              │            │
│  │  └── event   │           │              │           │              │            │
│  └──────────────┘           └──────────────┘           └──────────────┘            │
│         │                            │                                               │
│         │                            ▼                                               │
│         │                    ┌──────────────┐                                       │
│         │                    │    core/     │                                       │
│         │                    │  ├── config  │                                       │
│         │                    │  ├── security│                                       │
│         │                    │  └── logging │                                       │
│         │                    └──────────────┘                                       │
│         │                            │                                               │
│         ▼                            ▼                                               │
│  ┌──────────────┐           ┌──────────────┐                                       │
│  │   schemas/   │           │  db/models/  │                                       │
│  │  (Pydantic)  │           │  (MongoDB)   │                                       │
│  │  ├── auth    │           │  ├── user    │                                       │
│  │  ├── user    │           │  ├── challenge│                                      │
│  │  ├── team    │           │  ├── role    │                                       │
│  │  ├── challenge│          │  └── token   │                                       │
│  │  └── openstack│          │              │                                       │
│  └──────────────┘           └──────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND COMPONENT HIERARCHY                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   layout.tsx     │
                              │ (Root Layout)    │
                              │ + ToastProvider  │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
          │   page.tsx      │  │  dashboard/     │  │  api/proxy/     │
          │ (Home/Auth)     │  │  page.tsx       │  │  [...path]/     │
          │                 │  │                 │  │  route.ts       │
          └────────┬────────┘  └────────┬────────┘  └─────────────────┘
                   │                    │
                   ▼                    │
          ┌─────────────────┐           │
          │   AuthLayout    │           │
          │  ┌───────────┐  │           │
          │  │ LoginForm │  │           │
          │  └───────────┘  │           │
          │  ┌───────────┐  │           │
          │  │RegisterForm│ │           │
          │  └───────────┘  │           │
          │  ┌───────────┐  │           │
          │  │Particle   │  │           │
          │  │Background │  │           │
          │  └───────────┘  │           │
          └─────────────────┘           │
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
┌────────────────────────────────────┐    ┌────────────────────────────────────┐
│          USER VIEW                 │    │          ADMIN VIEW (Master)       │
│  ┌─────────────────────────────┐   │    │  ┌─────────────────────────────┐   │
│  │     UserChallenges.tsx      │   │    │  │     Challenges.tsx          │   │
│  │  - List Available Challenges│   │    │  │  - CRUD Operations          │   │
│  │  - Start/Stop/Submit Flags  │   │    │  │  - Deploy/Stop/Reset        │   │
│  │  - View Access Info         │   │    │  │  ┌─────────────────────┐    │   │
│  └─────────────────────────────┘   │    │  │  │ ChallengeList.tsx   │    │   │
│  ┌─────────────────────────────┐   │    │  │  │ ChallengeView.tsx   │    │   │
│  │     Scoreboard.tsx          │   │    │  │  │ ChallengeDeleteView │    │   │
│  │  - Real-time Rankings       │   │    │  │  └─────────────────────┘    │   │
│  │  - Team Scores              │   │    │  └─────────────────────────────┘   │
│  └─────────────────────────────┘   │    │  ┌─────────────────────────────┐   │
│                                    │    │  │   DockerfileToK8s.tsx       │   │
│                                    │    │  │  - Build Docker Images      │   │
│                                    │    │  │  - Manage K8s Deployments   │   │
│                                    │    │  └─────────────────────────────┘   │
│                                    │    │  ┌─────────────────────────────┐   │
│                                    │    │  │   OpenStack.tsx             │   │
│                                    │    │  │  - Deploy VM Snapshots      │   │
│                                    │    │  │  - Heat Template Deploy     │   │
│                                    │    │  │  ┌─────────────────────┐    │   │
│                                    │    │  │  │HeatTemplates.tsx    │    │   │
│                                    │    │  │  │SnapshotDevelopment  │    │   │
│                                    │    │  │  └─────────────────────┘    │   │
│                                    │    │  └─────────────────────────────┘   │
└────────────────────────────────────┘    └────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SHARED UI COMPONENTS                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   Button    │ │   Input     │ │   Select    │ │   Toast     │ │   InfoBox   │   │
│  │   .tsx      │ │   .tsx      │ │   .tsx      │ │   .tsx      │ │   .tsx      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────────────────┐                                        │
│  │ RadioGroup  │ │   ToastProvider.tsx     │                                        │
│  │   .tsx      │ │   (Context Provider)    │                                        │
│  └─────────────┘ └─────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Backend Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVICE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                API ENDPOINTS LAYER                                   │
│                                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  /auth   │  │  /users  │  │  /teams  │  │/challenges│ │  /files  │              │
│  │  ├─login │  │  ├─GET / │  │  ├─GET / │  │  ├─CRUD   │  │ ├─upload│              │
│  │  ├─register│ │  ├─GET/:id│ │  ├─POST  │  │  ├─start │  │ ├─download│            │
│  │  ├─logout│  │  ├─PUT/:id│  │  ├─join  │  │  ├─stop  │  │ └─list  │              │
│  │  └─me    │  │  └─DELETE │  │  └─my-team│ │  ├─submit│  │         │              │
│  └──────────┘  └──────────┘  └──────────┘  │  └─deploy │  └──────────┘              │
│                                             └──────────┘                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                             │
│  │ /builder │  │/openstack│  │  /events │  │  /roles  │                             │
│  │ ├─build  │  │ ├─summary│  │  ├─CRUD  │  │  ├─list  │                             │
│  │ ├─images │  │ ├─deploy │  │  ├─scores│  │  └─assign│                             │
│  │ └─kill   │  │ ├─heat   │  │  └─stats │  │         │                             │
│  │          │  │ └─instances│ │         │  │         │                             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                SERVICES LAYER                                        │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                            auth_service.py                                   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │ authenticate()  │  │  create_user()  │  │ verify_token()  │              │    │
│  │  │ login()         │  │  get_user()     │  │ refresh_token() │              │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          challenge_service.py                                │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │ create_challenge│  │ deploy_challenge│  │ submit_flag()   │              │    │
│  │  │ update_challenge│  │ stop_challenge()│  │ get_scores()    │              │    │
│  │  │ delete_challenge│  │ reset_challenge │  │ get_stats()     │              │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐     │
│  │  kubernetes_service.py │  │  openstack_service.py  │  │ event_service.py   │     │
│  │  ┌──────────────────┐  │  │  ┌──────────────────┐  │  │ ┌──────────────┐   │     │
│  │  │create_deployment │  │  │  │deploy_snapshot() │  │  │ │create_event()│   │     │
│  │  │create_service()  │  │  │  │deploy_heat()     │  │  │ │get_events()  │   │     │
│  │  │delete_deployment │  │  │  │list_instances()  │  │  │ │update_event()│   │     │
│  │  │get_pod_logs()    │  │  │  │delete_stack()    │  │  │ │delete_event()│   │     │
│  │  └──────────────────┘  │  │  └──────────────────┘  │  │ └──────────────┘   │     │
│  └────────────────────────┘  └────────────────────────┘  └────────────────────┘     │
│                                                                                      │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐     │
│  │   team_service.py     │  │   user_service.py      │  │  role_service.py   │     │
│  │  ┌──────────────────┐  │  │  ┌──────────────────┐  │  │ ┌──────────────┐   │     │
│  │  │ create_team()    │  │  │  │ get_user()       │  │  │ │list_roles()  │   │     │
│  │  │ join_team()      │  │  │  │ update_user()    │  │  │ │assign_role() │   │     │
│  │  │ get_my_team()    │  │  │  │ list_users()     │  │  │ │check_perms() │   │     │
│  │  │ leave_team()     │  │  │  │ delete_user()    │  │  │ │             │   │     │
│  │  └──────────────────┘  │  │  └──────────────────┘  │  │ └──────────────┘   │     │
│  └────────────────────────┘  └────────────────────────┘  └────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MIDDLEWARE LAYER                                        │
│                                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │    rbac.py          │  │    audit.py         │  │  error_handler.py   │          │
│  │  Role-Based Access  │  │  Request/Response   │  │  Exception Handling │          │
│  │  Control Middleware │  │  Logging Middleware │  │  & Error Formatting │          │
│  │                     │  │                     │  │                     │          │
│  │  Master > Admin     │  │  - Request logging  │  │  - HTTP Exceptions  │          │
│  │     > User          │  │  - Response logging │  │  - Validation Errs  │          │
│  │                     │  │  - Timing metrics   │  │  - Custom Errors    │          │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘          │
│                                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                                   │
│  │  rate_limiter.py    │  │    security.py      │                                   │
│  │  - Request throttle │  │  - JWT validation   │                                   │
│  │  - IP-based limits  │  │  - Password hashing │                                   │
│  │  - Lockout policy   │  │  - Token generation │                                   │
│  └─────────────────────┘  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB DATABASE SCHEMA                                 │
│                                   pacstar_db                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┐      ┌────────────────────────────────────┐
│           USERS COLLECTION         │      │          TEAMS COLLECTION          │
├────────────────────────────────────┤      ├────────────────────────────────────┤
│ _id: ObjectId (PK)                 │      │ _id: ObjectId (PK)                 │
│ username: String (unique, indexed) │◄────┐│ name: String                       │
│ email: String (unique, indexed)    │     ││ description: String                │
│ hashed_password: String            │     ││ team_code: String (unique, indexed)│
│ role: String (Master/Admin/User)   │     ││ leader_id: ObjectId (FK→users)────┼┐
│ zone: String (indexed)             │     ││ members: [                         ││
│ team_id: ObjectId (FK→teams)───────┼─────┘│   {                                ││
│ is_active: Boolean                 │      │     user_id: ObjectId,             ││
│ last_login: DateTime               │      │     username: String,              ││
│ created_at: DateTime               │      │     email: String,                 │◄┘
│ updated_at: DateTime               │      │     role: String (leader/member),  │
└────────────────────────────────────┘      │     joined_at: DateTime            │
                                            │   }                                │
                                            │ ]                                  │
                                            │ member_count: Number               │
                                            │ max_members: Number (default: 10)  │
                                            │ is_active: Boolean                 │
                                            │ created_at: DateTime               │
                                            │ updated_at: DateTime               │
                                            └────────────────────────────────────┘

┌────────────────────────────────────┐      ┌────────────────────────────────────┐
│       CHALLENGES COLLECTION        │      │   CHALLENGE_INSTANCES COLLECTION   │
├────────────────────────────────────┤      ├────────────────────────────────────┤
│ _id: ObjectId (PK)                 │◄────┐│ _id: ObjectId (PK)                 │
│ name: String (unique, indexed)     │     ││ challenge_id: ObjectId (FK)────────┘
│ description: String                │     ││ team_id: ObjectId (FK→teams)       │
│ category: String                   │     ││ instance_id: String (unique)       │
│   (containerized/static/openstack) │     ││ public_ip: String (unique, indexed)│
│ flag: String (hashed)              │     ││ ssh_port: Number                   │
│ points: Number                     │     ││ ssh_username: String               │
│ difficulty: String (easy/med/hard) │     ││ ssh_password: String               │
│ status: String (indexed)           │     ││ access_url: String                 │
│   (draft/active/archived)          │     ││ status: String                     │
│ created_by: ObjectId (FK→users)    │     ││   (pending/running/stopped/error)  │
│ docker_image: String               │     ││ created_at: DateTime               │
│ port_mapping: Object               │     ││ expires_at: DateTime               │
│ heat_template: String              │     ││ metadata: Object                   │
│ file_ids: [ObjectId] (FK→files)    │     │└────────────────────────────────────┘
│ teams_solved: [ObjectId]           │
│ total_solves: Number               │      ┌────────────────────────────────────┐
│ hints: [String]                    │      │       SUBMISSIONS COLLECTION       │
│ max_attempts: Number               │      ├────────────────────────────────────┤
│ created_at: DateTime (indexed)     │      │ _id: ObjectId (PK)                 │
│ updated_at: DateTime               │      │ user_id: ObjectId (FK→users)       │
└────────────────────────────────────┘      │ team_id: ObjectId (FK→teams)       │
                                            │ challenge_id: ObjectId(FK→challenges)
                                            │ submitted_flag: String             │
                                            │ is_correct: Boolean                │
                                            │ points_awarded: Number             │
                                            │ timestamp: DateTime (indexed)      │
                                            │ ip_address: String                 │
                                            └────────────────────────────────────┘

┌────────────────────────────────────┐      ┌────────────────────────────────────┐
│         FILES COLLECTION           │      │         EVENTS COLLECTION          │
├────────────────────────────────────┤      ├────────────────────────────────────┤
│ _id: ObjectId (PK)                 │      │ _id: ObjectId (PK)                 │
│ filename: String                   │      │ name: String                       │
│ original_filename: String          │      │ description: String                │
│ file_path: String                  │      │ start_time: DateTime               │
│ file_size: Number                  │      │ end_time: DateTime                 │
│ mime_type: String                  │      │ status: String (upcoming/active/   │
│ challenge_id: ObjectId (FK)        │      │         completed/cancelled)       │
│ uploaded_by: ObjectId (FK→users)   │      │ challenges: [ObjectId]             │
│ created_at: DateTime               │      │ teams: [ObjectId]                  │
│ is_public: Boolean                 │      │ scoring_type: String               │
└────────────────────────────────────┘      │ created_by: ObjectId (FK→users)    │
                                            │ created_at: DateTime               │
                                            │ updated_at: DateTime               │
                                            └────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE INDEXES                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ users:                                                                               │
│   - username_1 (unique)                                                             │
│   - email_1 (unique)                                                                │
│   - zone_1                                                                          │
│                                                                                      │
│ teams:                                                                               │
│   - team_code_1 (unique)                                                            │
│                                                                                      │
│ challenges:                                                                          │
│   - name_1 (unique)                                                                 │
│   - created_by_1                                                                    │
│   - status_1                                                                        │
│   - created_at_1                                                                    │
│                                                                                      │
│ challenge_instances:                                                                 │
│   - challenge_id_1                                                                  │
│   - team_id_1                                                                       │
│   - instance_id_1 (unique)                                                          │
│   - public_ip_1 (unique)                                                            │
│                                                                                      │
│ submissions:                                                                         │
│   - user_id_1                                                                       │
│   - challenge_id_1                                                                  │
│   - timestamp_1                                                                     │
│   - (user_id_1, challenge_id_1) compound index                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Flow Diagrams

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              API REQUEST FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌───────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Browser  │────▶│  Next.js    │────▶│  FastAPI    │────▶│  MongoDB    │
│  (React)  │     │  API Proxy  │     │  Backend    │     │  Database   │
└───────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                  │                    │                   │
     │  1. User Action  │                    │                   │
     │  (e.g., Login)   │                    │                   │
     │ ──────────────▶  │                    │                   │
     │                  │  2. Proxy Request  │                   │
     │                  │    to Backend      │                   │
     │                  │ ────────────────▶  │                   │
     │                  │                    │  3. Query DB      │
     │                  │                    │ ────────────────▶ │
     │                  │                    │                   │
     │                  │                    │  4. Return Data   │
     │                  │                    │ ◀──────────────── │
     │                  │  5. JSON Response  │                   │
     │                  │ ◀──────────────── │                   │
     │  6. Update UI    │                    │                   │
     │ ◀────────────── │                    │                   │
     │                  │                    │                   │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         API ENDPOINTS OVERVIEW                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              /api/v1
                                 │
        ┌────────────┬───────────┼───────────┬────────────┐
        │            │           │           │            │
        ▼            ▼           ▼           ▼            ▼
    ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐
    │ /auth │   │/users │   │/teams │   │/chall.│   │/files │
    └───┬───┘   └───┬───┘   └───┬───┘   └───┬───┘   └───┬───┘
        │           │           │           │           │
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │POST     │ │GET /    │ │GET /    │ │GET /    │ │POST     │
   │/login   │ │GET /:id │ │POST /   │ │POST /   │ │/upload  │
   │POST     │ │PUT /:id │ │POST/join│ │GET /:id │ │GET      │
   │/register│ │DELETE   │ │GET      │ │PUT /:id │ │/download│
   │POST     │ │/:id     │ │/my-team │ │DELETE   │ │GET /list│
   │/logout  │ │         │ │         │ │/:id     │ │GET/serve│
   │GET /me  │ │         │ │         │ │POST/:id/│ │         │
   └─────────┘ └─────────┘ └─────────┘ │start    │ └─────────┘
                                       │POST/:id/│
                                       │stop     │
                                       │POST/:id/│
                                       │submit   │
                                       │POST/:id/│
                                       │deploy   │
                                       │GET      │
                                       │/scores  │
                                       └─────────┘

        ┌────────────┬────────────┬────────────┐
        │            │            │            │
        ▼            ▼            ▼            ▼
    ┌───────┐   ┌────────┐   ┌───────┐   ┌───────┐
    │/builder│  │/openstack│  │/events│   │/roles │
    └───┬───┘   └────┬───┘   └───┬───┘   └───┬───┘
        │            │           │           │
   ┌────┴────┐  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │POST     │  │GET      │ │GET /    │ │GET /    │
   │/build   │  │/summary │ │POST /   │ │POST     │
   │GET      │  │GET      │ │GET /:id │ │/assign  │
   │/images  │  │/snapshots││PUT /:id │ │         │
   │DELETE   │  │POST     │ │DELETE   │ │         │
   │/images  │  │/deploy  │ │/:id     │ │         │
   │POST     │  │POST     │ │GET/:id/ │ │         │
   │/kill-all│  │/heat    │ │scores   │ │         │
   │         │  │GET      │ │         │ │         │
   │         │  │/instances│ │        │ │         │
   └─────────┘  └─────────┘ └─────────┘ └─────────┘
```

---

## 7. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              USER REGISTRATION
                              ═════════════════

┌─────────┐        ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  User   │        │  Frontend   │        │   Backend   │        │  MongoDB    │
└────┬────┘        └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
     │                    │                      │                      │
     │ 1. Fill Form       │                      │                      │
     │ ────────────────▶  │                      │                      │
     │ (username, email,  │                      │                      │
     │  password, zone)   │                      │                      │
     │                    │                      │                      │
     │                    │ 2. POST /auth/register                      │
     │                    │ ─────────────────────▶                      │
     │                    │                      │                      │
     │                    │                      │ 3. Check unique      │
     │                    │                      │ ─────────────────────▶
     │                    │                      │                      │
     │                    │                      │ 4. Hash password     │
     │                    │                      │    (bcrypt)          │
     │                    │                      │                      │
     │                    │                      │ 5. Create user       │
     │                    │                      │ ─────────────────────▶
     │                    │                      │                      │
     │                    │                      │ 6. Generate JWT      │
     │                    │                      │    tokens            │
     │                    │                      │                      │
     │                    │ 7. Return tokens     │                      │
     │                    │ ◀────────────────── │                      │
     │                    │                      │                      │
     │                    │ 8. Store in localStorage                    │
     │                    │    (auth_token)      │                      │
     │                    │                      │                      │
     │ 9. Redirect to     │                      │                      │
     │    Dashboard       │                      │                      │
     │ ◀───────────────── │                      │                      │


                                USER LOGIN
                                ══════════

┌─────────┐        ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  User   │        │  Frontend   │        │   Backend   │        │  MongoDB    │
└────┬────┘        └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
     │                    │                      │                      │
     │ 1. Enter Creds     │                      │                      │
     │ ────────────────▶  │                      │                      │
     │                    │                      │                      │
     │                    │ 2. POST /auth/login  │                      │
     │                    │ ─────────────────────▶                      │
     │                    │                      │                      │
     │                    │                      │ 3. Find user         │
     │                    │                      │ ─────────────────────▶
     │                    │                      │                      │
     │                    │                      │ 4. Verify password   │
     │                    │                      │    (bcrypt.verify)   │
     │                    │                      │                      │
     │                    │                      │ 5. Check rate limit  │
     │                    │                      │    & lockout         │
     │                    │                      │                      │
     │                    │                      │ 6. Generate JWT      │
     │                    │                      │    access_token      │
     │                    │                      │    refresh_token     │
     │                    │                      │                      │
     │                    │                      │ 7. Update last_login │
     │                    │                      │ ─────────────────────▶
     │                    │                      │                      │
     │                    │ 8. Return tokens +   │                      │
     │                    │    user info         │                      │
     │                    │ ◀────────────────── │                      │
     │                    │                      │                      │
     │ 9. Dashboard       │                      │                      │
     │ ◀───────────────── │                      │                      │


                           JWT TOKEN STRUCTURE
                           ════════════════════

     ┌─────────────────────────────────────────────────────────────────┐
     │                         ACCESS TOKEN                            │
     │  ┌──────────────────────────────────────────────────────────┐   │
     │  │ Header:                                                   │   │
     │  │   { "alg": "HS256", "typ": "JWT" }                       │   │
     │  ├──────────────────────────────────────────────────────────┤   │
     │  │ Payload:                                                  │   │
     │  │   {                                                       │   │
     │  │     "sub": "user_id",                                    │   │
     │  │     "username": "john_doe",                              │   │
     │  │     "role": "User",                                      │   │
     │  │     "exp": 1702123456,  // 30 min expiry                 │   │
     │  │     "iat": 1702121656                                    │   │
     │  │   }                                                       │   │
     │  ├──────────────────────────────────────────────────────────┤   │
     │  │ Signature:                                                │   │
     │  │   HMACSHA256(base64(header) + "." + base64(payload),     │   │
     │  │              JWT_SECRET_KEY)                              │   │
     │  └──────────────────────────────────────────────────────────┘   │
     └─────────────────────────────────────────────────────────────────┘


                          ROLE-BASED ACCESS CONTROL
                          ══════════════════════════

     ┌─────────────────────────────────────────────────────────────────┐
     │                     PERMISSION MATRIX                           │
     ├─────────────────┬─────────────┬─────────────┬─────────────────┤
     │   Endpoint      │   Master    │   Admin     │   User          │
     ├─────────────────┼─────────────┼─────────────┼─────────────────┤
     │ GET /users      │     ✓       │     ✓       │     ✗           │
     │ POST /challenges│     ✓       │     ✓       │     ✗           │
     │ DELETE /users   │     ✓       │     ✗       │     ✗           │
     │ POST /deploy    │     ✓       │     ✓       │     ✗           │
     │ GET /challenges │     ✓       │     ✓       │     ✓           │
     │ POST /submit    │     ✓       │     ✓       │     ✓           │
     │ GET /scores     │     ✓       │     ✓       │     ✓           │
     │ GET /my-team    │     ✓       │     ✓       │     ✓           │
     │ POST /openstack │     ✓       │     ✗       │     ✗           │
     │ POST /builder   │     ✓       │     ✓       │     ✗           │
     └─────────────────┴─────────────┴─────────────┴─────────────────┘
```

---

## 8. Challenge Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         CHALLENGE DEPLOYMENT FLOWS                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

                      CONTAINERIZED CHALLENGE (KUBERNETES)
                      ════════════════════════════════════

┌─────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│  Admin  │      │  Frontend │      │  Backend  │      │Kubernetes │      │  MongoDB  │
└────┬────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
     │                 │                  │                  │                  │
     │ 1. Create       │                  │                  │                  │
     │    Challenge    │                  │                  │                  │
     │ ───────────────▶│                  │                  │                  │
     │                 │ 2. POST /challenges                 │                  │
     │                 │ ────────────────▶│                  │                  │
     │                 │                  │                  │                  │
     │                 │                  │ 3. Save challenge│                  │
     │                 │                  │ ─────────────────────────────────────▶
     │                 │                  │                  │                  │
     │ 4. Deploy       │                  │                  │                  │
     │ ───────────────▶│                  │                  │                  │
     │                 │ 5. POST /challenges/:id/deploy      │                  │
     │                 │ ────────────────▶│                  │                  │
     │                 │                  │                  │                  │
     │                 │                  │ 6. Create        │                  │
     │                 │                  │    Namespace     │                  │
     │                 │                  │ ─────────────────▶                  │
     │                 │                  │                  │                  │
     │                 │                  │ 7. Create        │                  │
     │                 │                  │    Deployment    │                  │
     │                 │                  │ ─────────────────▶                  │
     │                 │                  │   (Pod with      │                  │
     │                 │                  │    Docker image) │                  │
     │                 │                  │                  │                  │
     │                 │                  │ 8. Create        │                  │
     │                 │                  │    LoadBalancer  │                  │
     │                 │                  │    Service       │                  │
     │                 │                  │ ─────────────────▶                  │
     │                 │                  │                  │                  │
     │                 │                  │ 9. Get External  │                  │
     │                 │                  │    IP (MetalLB)  │                  │
     │                 │                  │ ◀────────────────│                  │
     │                 │                  │                  │                  │
     │                 │                  │ 10. Save instance│                  │
     │                 │                  │ ─────────────────────────────────────▶
     │                 │                  │    (IP, port,    │                  │
     │                 │                  │     credentials) │                  │
     │                 │                  │                  │                  │
     │                 │ 11. Return access info              │                  │
     │                 │ ◀───────────────│                  │                  │
     │ 12. Display     │                  │                  │                  │
     │ ◀──────────────│                  │                  │                  │


                      OPENSTACK VM CHALLENGE (HEAT)
                      ══════════════════════════════

┌─────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│  Admin  │      │  Frontend │      │  Backend  │      │ OpenStack │      │  MongoDB  │
└────┬────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
     │                 │                  │                  │                  │
     │ 1. Select Heat  │                  │                  │                  │
     │    Template     │                  │                  │                  │
     │ ───────────────▶│                  │                  │                  │
     │                 │                  │                  │                  │
     │                 │ 2. POST /openstack/heat/deploy      │                  │
     │                 │ ────────────────▶│                  │                  │
     │                 │   (template,     │                  │                  │
     │                 │    parameters,   │                  │                  │
     │                 │    stack_name)   │                  │                  │
     │                 │                  │                  │                  │
     │                 │                  │ 3. Authenticate  │                  │
     │                 │                  │    with Keystone │                  │
     │                 │                  │ ─────────────────▶                  │
     │                 │                  │                  │                  │
     │                 │                  │ 4. Create Heat   │                  │
     │                 │                  │    Stack         │                  │
     │                 │                  │ ─────────────────▶                  │
     │                 │                  │                  │                  │
     │                 │                  │            ┌─────┴─────┐            │
     │                 │                  │            │  Heat     │            │
     │                 │                  │            │ Orchestrates:          │
     │                 │                  │            │ - Nova VM │            │
     │                 │                  │            │ - Neutron │            │
     │                 │                  │            │   Network │            │
     │                 │                  │            │ - Security│            │
     │                 │                  │            │   Groups  │            │
     │                 │                  │            │ - Floating│            │
     │                 │                  │            │   IP      │            │
     │                 │                  │            └─────┬─────┘            │
     │                 │                  │                  │                  │
     │                 │                  │ 5. Get Stack     │                  │
     │                 │                  │    Outputs       │                  │
     │                 │                  │ ◀────────────────│                  │
     │                 │                  │   (instance_ip,  │                  │
     │                 │                  │    credentials)  │                  │
     │                 │                  │                  │                  │
     │                 │                  │ 6. Save to DB    │                  │
     │                 │                  │ ─────────────────────────────────────▶
     │                 │                  │                  │                  │
     │                 │ 7. Return access │                  │                  │
     │                 │ ◀───────────────│                  │                  │
     │ 8. Display      │                  │                  │                  │
     │ ◀──────────────│                  │                  │                  │


                         FLAG SUBMISSION FLOW
                         ════════════════════

┌─────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│  User   │      │  Frontend │      │  Backend  │      │  MongoDB  │
└────┬────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
     │                 │                  │                  │
     │ 1. Enter Flag   │                  │                  │
     │ ───────────────▶│                  │                  │
     │                 │                  │                  │
     │                 │ 2. POST /challenges/:id/submit-flag │
     │                 │ ────────────────▶│                  │
     │                 │                  │                  │
     │                 │                  │ 3. Get challenge │
     │                 │                  │ ─────────────────▶
     │                 │                  │                  │
     │                 │                  │ 4. Hash submitted│
     │                 │                  │    flag and      │
     │                 │                  │    compare       │
     │                 │                  │                  │
     │                 │                  │ 5. Check if      │
     │                 │                  │    already solved│
     │                 │                  │ ─────────────────▶
     │                 │                  │                  │
     │                 │                  │ 6. Record        │
     │                 │                  │    submission    │
     │                 │                  │ ─────────────────▶
     │                 │                  │                  │
     │                 │                  │ 7. Update team   │
     │                 │                  │    score         │
     │                 │                  │ ─────────────────▶
     │                 │                  │                  │
     │                 │ 8. Return result │                  │
     │                 │ ◀───────────────│                  │
     │                 │   {correct: true,│                  │
     │                 │    points: 100}  │                  │
     │                 │                  │                  │
     │ 9. Show Toast   │                  │                  │
     │    & Update UI  │                  │                  │
     │ ◀──────────────│                  │                  │
```

---

## 9. Infrastructure Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE INTEGRATION                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

                           KUBERNETES INTEGRATION
                           ══════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           KUBERNETES CLUSTER                                         │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        Namespace: pacstar-challenges                         │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │  Deployment 1   │  │  Deployment 2   │  │  Deployment N   │              │    │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │              │    │
│  │  │ │    Pod      │ │  │ │    Pod      │ │  │ │    Pod      │ │              │    │
│  │  │ │ ┌─────────┐ │ │  │ │ ┌─────────┐ │ │  │ │ ┌─────────┐ │ │              │    │
│  │  │ │ │Container│ │ │  │ │ │Container│ │ │  │ │ │Container│ │ │              │    │
│  │  │ │ │(Docker) │ │ │  │ │ │(Docker) │ │ │  │ │ │(Docker) │ │ │              │    │
│  │  │ │ └─────────┘ │ │  │ │ └─────────┘ │ │  │ │ └─────────┘ │ │              │    │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │              │    │
│  │  │        │        │  │        │        │  │        │        │              │    │
│  │  │        ▼        │  │        ▼        │  │        ▼        │              │    │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │              │    │
│  │  │ │   Service   │ │  │ │   Service   │ │  │ │   Service   │ │              │    │
│  │  │ │(LoadBalancer│ │  │ │(LoadBalancer│ │  │ │(LoadBalancer│ │              │    │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │              │    │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │    │
│  └───────────┼────────────────────┼────────────────────┼───────────────────────┘    │
│              │                    │                    │                            │
│              └────────────────────┼────────────────────┘                            │
│                                   │                                                  │
│                                   ▼                                                  │
│                    ┌──────────────────────────┐                                     │
│                    │        MetalLB           │                                     │
│                    │   (Load Balancer)        │                                     │
│                    │   IP Pool: 10.10.100.x   │                                     │
│                    └──────────────────────────┘                                     │
│                                   │                                                  │
└───────────────────────────────────┼──────────────────────────────────────────────────┘
                                    │
                                    ▼
                              External Access
                          (Public IP per challenge)


                           OPENSTACK INTEGRATION
                           ═════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OPENSTACK CLOUD                                         │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐     │
│  │                             KEYSTONE                                        │     │
│  │                     (Identity & Authentication)                             │     │
│  │            ┌───────────────────────────────────────┐                        │     │
│  │            │  Token-based Authentication           │                        │     │
│  │            │  Project: pacstar-ctf                 │                        │     │
│  │            └───────────────────────────────────────┘                        │     │
│  └────────────────────────────────────────────────────────────────────────────┘     │
│                                      │                                               │
│         ┌────────────────────────────┼────────────────────────────┐                 │
│         │                            │                            │                 │
│         ▼                            ▼                            ▼                 │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐            │
│  │     NOVA     │           │   NEUTRON    │           │    HEAT      │            │
│  │  (Compute)   │           │  (Networking)│           │(Orchestration)            │
│  │              │           │              │           │              │            │
│  │ ┌──────────┐ │           │ ┌──────────┐ │           │ ┌──────────┐ │            │
│  │ │   VM 1   │ │           │ │ Network  │ │           │ │  Stack   │ │            │
│  │ │(Team A)  │ │◀──────────│ │pacstar-net│◀──────────│ │ Template │ │            │
│  │ └──────────┘ │           │ └──────────┘ │           │ └──────────┘ │            │
│  │ ┌──────────┐ │           │ ┌──────────┐ │           │              │            │
│  │ │   VM 2   │ │           │ │ Subnet   │ │           │ Parameters:  │            │
│  │ │(Team B)  │ │◀──────────│ │10.0.0.0/24│           │ - flavor     │            │
│  │ └──────────┘ │           │ └──────────┘ │           │ - image      │            │
│  │ ┌──────────┐ │           │ ┌──────────┐ │           │ - network    │            │
│  │ │   VM N   │ │           │ │ Router   │ │           │ - key_name   │            │
│  │ │(Team N)  │ │◀──────────│ │          │ │           │              │            │
│  │ └──────────┘ │           │ └──────────┘ │           │              │            │
│  └──────────────┘           └──────────────┘           └──────────────┘            │
│         │                            │                                               │
│         │                            │                                               │
│         ▼                            ▼                                               │
│  ┌──────────────┐           ┌──────────────┐                                        │
│  │    GLANCE    │           │  Floating IP │                                        │
│  │   (Images)   │           │    Pool      │                                        │
│  │              │           │              │                                        │
│  │ ┌──────────┐ │           │ External     │                                        │
│  │ │ Snapshot │ │           │ Network      │                                        │
│  │ │ Image    │ │           │ Access       │                                        │
│  │ └──────────┘ │           │              │                                        │
│  └──────────────┘           └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Docker Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE ARCHITECTURE                                  │
│                              (docker-compose.yml)                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            pacstar-network (bridge)                                  │
│                               172.28.0.0/16                                          │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                              │    │
│  │  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │    │
│  │  │   FRONTEND      │     │    BACKEND      │     │    MONGODB      │        │    │
│  │  │   (Next.js)     │────▶│   (FastAPI)     │────▶│    (Mongo 7)    │        │    │
│  │  │                 │     │                 │     │                 │        │    │
│  │  │ Port: 3505      │     │ Port: 8000      │     │ Port: 27017     │        │    │
│  │  │                 │     │                 │     │                 │        │    │
│  │  │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │        │    │
│  │  │ │ Dockerfile  │ │     │ │ Dockerfile  │ │     │ │ mongo:7.0   │ │        │    │
│  │  │ │ (root)      │ │     │ │ (backend/)  │ │     │ │ (official)  │ │        │    │
│  │  │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │        │    │
│  │  │                 │     │                 │     │                 │        │    │
│  │  │ Env:            │     │ Env:            │     │ Env:            │        │    │
│  │  │ - NODE_ENV      │     │ - MONGODB_URI   │     │ - MONGO_INITDB_ │        │    │
│  │  │ - PORT          │     │ - JWT_SECRET    │     │   ROOT_USERNAME │        │    │
│  │  │ - BACKEND_URL   │     │ - OPENSTACK_*   │     │ - MONGO_INITDB_ │        │    │
│  │  │                 │     │ - RATE_LIMIT_*  │     │   ROOT_PASSWORD │        │    │
│  │  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘        │    │
│  │           │                       │                       │                 │    │
│  │           │                       │                       │                 │    │
│  │           ▼                       ▼                       ▼                 │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │    │
│  │  │                           VOLUMES                                    │   │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │    │
│  │  │  │ mongodb_data │  │backend_uploads│ │ backend_logs │               │   │    │
│  │  │  │ /data/db     │  │ /app/uploads │  │ /app/logs    │               │   │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │    │
│  │  │  ┌──────────────┐                                                    │   │    │
│  │  │  │mongodb_config│                                                    │   │    │
│  │  │  │/data/configdb│                                                    │   │    │
│  │  │  └──────────────┘                                                    │   │    │
│  │  └─────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                              │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                    OPTIONAL: MONGO EXPRESS (dev profile)                     │    │
│  │                                                                              │    │
│  │  ┌─────────────────┐                                                        │    │
│  │  │  MONGO-EXPRESS  │  Port: 8081                                            │    │
│  │  │  (Admin UI)     │  Profile: dev                                          │    │
│  │  │                 │  docker-compose --profile dev up                       │    │
│  │  └─────────────────┘                                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              CONTAINER HEALTHCHECKS
                              ═══════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│  MongoDB:   mongosh --eval "db.adminCommand('ping')"                                │
│             Interval: 10s | Timeout: 5s | Retries: 5 | Start: 30s                   │
│                                                                                      │
│  Backend:   curl -f http://localhost:8000/health                                    │
│             Interval: 30s | Timeout: 10s | Retries: 3 | Start: 40s                  │
│                                                                                      │
│  Frontend:  wget --spider http://localhost:3505                                     │
│             Interval: 30s | Timeout: 10s | Retries: 3 | Start: 30s                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NETWORK ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                   EXTERNAL
                                   NETWORK
                                      │
                                      │
                    ┌─────────────────┴─────────────────┐
                    │           FIREWALL               │
                    │    (Allow: 3505, 8000, 27017)    │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
        ┌───────────┴───────────┐       ┌──────────────┴───────────┐
        │                       │       │                          │
        ▼                       ▼       ▼                          ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────────────────┐
│   Internet    │      │   Corporate   │      │      Cloud Services       │
│   Users       │      │   Network     │      │   (OpenStack/K8s API)     │
│               │      │               │      │                           │
│  Port 3505    │      │  Port 8081    │      │  OpenStack: 5000, 8774,   │
│  (Frontend)   │      │  (Mongo-Exp)  │      │            8776, 9696,    │
│               │      │  [dev only]   │      │            8004           │
└───────────────┘      └───────────────┘      │                           │
        │                       │              │  Kubernetes: 6443         │
        │                       │              └───────────────────────────┘
        │                       │                           │
        └───────────────────────┴───────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────────┐
                    │     Docker Network        │
                    │    (pacstar-network)      │
                    │     172.28.0.0/16         │
                    └───────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    Frontend     │   │    Backend      │   │    MongoDB      │
│   172.28.0.x    │   │   172.28.0.y    │   │   172.28.0.z    │
│   :3505 ──────────▶│   :8000 ──────────▶│   :27017          │
└─────────────────┘   └─────────────────┘   └─────────────────┘


                           PORT MAPPINGS
                           ═════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Service        │  Internal Port  │  External Port  │  Purpose                      │
├─────────────────┼─────────────────┼─────────────────┼──────────────────────────────┤
│  Frontend       │     3505        │     3505        │  Web Application              │
│  Backend        │     8000        │     8000        │  REST API                     │
│  MongoDB        │     27017       │     27017       │  Database                     │
│  Mongo Express  │     8081        │     8081        │  DB Admin (dev only)          │
│                 │                 │                 │                               │
│  K8s Challenges │     varies      │  10.10.100.x    │  Challenge Instances (LB)     │
│  OpenStack VMs  │     22, 80, etc │  Floating IPs   │  Challenge VMs                │
└─────────────────────────────────────────────────────────────────────────────────────┘


                           DATA FLOW
                           ═════════

    User Browser ──(HTTPS:3505)──▶ Next.js Frontend
                                         │
                                         │ (Internal: /api/proxy)
                                         ▼
                                   FastAPI Backend
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
               MongoDB           Kubernetes API        OpenStack API
          (Data Storage)      (Container Mgmt)       (VM Management)
```

---

## 12. Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

                         SECURITY LAYERS
                         ════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: NETWORK SECURITY                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  • TLS/HTTPS encryption for all external traffic                            │    │
│  │  • Docker network isolation (pacstar-network)                               │    │
│  │  • Firewall rules limiting exposed ports                                    │    │
│  │  • Trusted Host Middleware (whitelist allowed hosts)                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: APPLICATION SECURITY                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  • CORS Middleware (restrict allowed origins)                               │    │
│  │  • Rate Limiting (100 requests/60 seconds)                                  │    │
│  │  • Account Lockout (5 failed attempts = 15 min lockout)                    │    │
│  │  • Input Validation & Sanitization                                          │    │
│  │  • Security Headers (CSP, X-Frame-Options, HSTS, etc.)                     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: AUTHENTICATION & AUTHORIZATION                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  • JWT Token-based Authentication                                           │    │
│  │    - Access Token: 30 min expiry (configurable)                            │    │
│  │    - Refresh Token: 7 day expiry (configurable)                            │    │
│  │  • Password Hashing: bcrypt with cost factor 12                            │    │
│  │  • Role-Based Access Control (RBAC)                                         │    │
│  │    - Master: Full system access                                             │    │
│  │    - Admin: Challenge & team management                                     │    │
│  │    - User: Participation only                                               │    │
│  │  • Session Management with Secure Cookies                                   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: DATA SECURITY                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  • MongoDB Authentication Required                                          │    │
│  │  • Database user credentials in environment variables                       │    │
│  │  • Sensitive data encryption at rest                                        │    │
│  │  • Flag values stored as hashed values                                      │    │
│  │  • Password complexity requirements enforced                                │    │
│  │  • Audit logging for all sensitive operations                              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 5: AUDIT & MONITORING                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  • Audit Middleware logs all requests/responses                             │    │
│  │  • Authentication events logged                                             │    │
│  │  • Administrative actions tracked                                           │    │
│  │  • Challenge submissions recorded                                           │    │
│  │  • Error logging with stack traces (dev only)                              │    │
│  │  • Container health monitoring                                              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘


                    SECURITY HEADERS CONFIGURATION
                    ══════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Header                    │  Value                                                 │
├────────────────────────────┼─────────────────────────────────────────────────────────
│  Content-Security-Policy   │  default-src 'self'; script-src 'self'                │
│  X-Content-Type-Options    │  nosniff                                              │
│  X-Frame-Options           │  DENY                                                  │
│  Referrer-Policy           │  no-referrer                                          │
│  Strict-Transport-Security │  max-age=31536000; includeSubDomains                  │
└─────────────────────────────────────────────────────────────────────────────────────┘


                    ENVIRONMENT VARIABLE SECURITY
                    ═════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SENSITIVE VARIABLES (Must be changed in production):                               │
│                                                                                      │
│  • JWT_SECRET_KEY            - Used for signing access tokens                       │
│  • JWT_REFRESH_SECRET_KEY    - Used for signing refresh tokens                      │
│  • SESSION_SECRET_KEY        - Used for session encryption                          │
│  • MONGO_ROOT_PASSWORD       - MongoDB admin password                               │
│  • MASTER_ADMIN_PASSWORD     - Initial master admin password                        │
│  • OPENSTACK_PASSWORD        - OpenStack service account password                   │
│                                                                                      │
│  Storage: .env file (NOT committed to version control)                              │
│  Template: env.template (committed, contains placeholders)                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              TECHNOLOGY STACK SUMMARY                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND                        │  BACKEND                                         │
├──────────────────────────────────┼──────────────────────────────────────────────────┤
│  • Next.js 14                    │  • FastAPI (Python 3.12)                         │
│  • React 18                      │  • Pydantic v2                                   │
│  • TypeScript                    │  • Motor (Async MongoDB)                         │
│  • Tailwind CSS                  │  • PyJWT                                         │
│  • Axios                         │  • bcrypt                                        │
│  • Lucide React Icons            │  • openstacksdk                                  │
│                                  │  • kubernetes-client                             │
├──────────────────────────────────┼──────────────────────────────────────────────────┤
│  DATABASE                        │  INFRASTRUCTURE                                  │
├──────────────────────────────────┼──────────────────────────────────────────────────┤
│  • MongoDB 7.0                   │  • Docker & Docker Compose                       │
│  • Mongo Express (dev)           │  • Kubernetes (challenges)                       │
│                                  │  • OpenStack (VM challenges)                     │
│                                  │  • MetalLB (Load Balancer)                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Author:** PACSTAR Development Team
