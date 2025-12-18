# PACSTAR Challenge Management API Documentation

## Overview
This document provides comprehensive API documentation for the PACSTAR Challenge Management System. The system allows Master users to create, deploy, and manage challenges for multiple teams on Kubernetes with unique public IP addresses.

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication
All endpoints (except registration and login) require a Bearer token in the Authorization header:
```bash
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication APIs

### 1. User Registration
Register a new user with default role "User".

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "user@example.com",
  "password": "string (min 8 chars)",
  "zone": "string (2-50 chars)"
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "zone": "zone1"
  }'
```

**Response:**
```json
{
  "id": "user_id",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "User",
  "is_active": true,
  "zone": "zone1"
}
```

### 2. Master Admin Registration
Register a Master admin user (requires existing Master role or special setup).

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "master_admin",
    "email": "admin@pacstar.com",
    "password": "AdminPass123",
    "zone": "master_zone"
  }'
```

### 3. User Login
Authenticate user and get access tokens.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "master_admin",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

### 4. Refresh Token
Get new access token using refresh token.

**Endpoint:** `POST /auth/refresh`

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your_refresh_token_here"
  }'
```

---

## 🎯 Challenge Management APIs

### 1. Create Challenge
Create a new challenge (Master role required).

**Endpoint:** `POST /challenges/`

**Request Body:**
```json
{
  "name": "challenge-name",
  "description": "Challenge description (10-500 chars)",
  "config": {
    "challenge_type": "web|jwt|crypto|reverse|pwn",
    "image": "nginx:alpine",
    "ports": [80],
    "environment_vars": {
      "FLAG": "CTF{flag_here}",
      "SECRET_KEY": "secret123"
    },
    "resources": {
      "requests": {"cpu": "100m", "memory": "128Mi"},
      "limits": {"cpu": "500m", "memory": "512Mi"}
    },
    "health_check_path": "/",
    "flag_format": "CTF{}"
  },
  "total_teams": 4,
  "is_active": true
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/challenges/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "nginx-hello-world",
    "description": "Simple Nginx Hello World challenge for teams",
    "config": {
      "challenge_type": "web",
      "image": "nginx:alpine",
      "ports": [80],
      "environment_vars": {
        "FLAG": "CTF{nginx_hello_world_flag}",
        "SECRET_KEY": "challenge-secret-key-123"
      },
      "resources": {
        "requests": {"cpu": "100m", "memory": "128Mi"},
        "limits": {"cpu": "500m", "memory": "512Mi"}
      },
      "health_check_path": "/",
      "flag_format": "CTF{}"
    },
    "total_teams": 4,
    "is_active": true
  }'
```

**Response:**
```json
{
  "id": "challenge_id",
  "name": "nginx-hello-world",
  "description": "Simple Nginx Hello World challenge for teams",
  "config": { ... },
  "total_teams": 4,
  "is_active": true,
  "status": "pending",
  "instances": [],
  "created_at": "2025-10-20T06:00:00Z",
  "updated_at": "2025-10-20T06:00:00Z",
  "created_by": "user_id"
}
```

### 2. List Challenges
Get all challenges with pagination.

**Endpoint:** `GET /challenges/?skip=0&limit=100`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/challenges/?skip=0&limit=100" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "challenges": [
    {
      "id": "challenge_id",
      "name": "nginx-hello-world",
      "description": "Simple Nginx Hello World challenge",
      "status": "running",
      "total_teams": 4,
      "instances": [...],
      "created_at": "2025-10-20T06:00:00Z",
      "updated_at": "2025-10-20T06:00:00Z",
      "created_by": "user_id"
    }
  ],
  "total": 1
}
```

### 3. Get Challenge by ID
Get a specific challenge by ID.

**Endpoint:** `GET /challenges/{challenge_id}`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Deploy Challenge
Deploy a challenge to Kubernetes with unique IPs for each team.

**Endpoint:** `POST /challenges/{challenge_id}/deploy`

**Request Body:**
```json
{
  "force_redeploy": false
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161/deploy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "force_redeploy": false
  }'
```

**Response:**
```json
{
  "id": "challenge_id",
  "name": "nginx-hello-world",
  "status": "running",
  "instances": [
    {
      "team_id": "team-001",
      "instance_id": "instance_id",
      "public_ip": "192.168.250.101",
      "internal_ip": "10.42.0.1",
      "status": "running",
      "created_at": "2025-10-20T06:00:00Z",
      "pod_name": "nginx-hello-world-team-001-pod",
      "service_name": "nginx-hello-world-team-001-svc",
      "namespace": "challenge-nginx-hello-world"
    },
    {
      "team_id": "team-002",
      "instance_id": "instance_id",
      "public_ip": "192.168.250.102",
      "internal_ip": "10.42.0.2",
      "status": "running",
      "created_at": "2025-10-20T06:00:00Z",
      "pod_name": "nginx-hello-world-team-002-pod",
      "service_name": "nginx-hello-world-team-002-svc",
      "namespace": "challenge-nginx-hello-world"
    }
  ],
  "total_teams": 4,
  "created_at": "2025-10-20T06:00:00Z",
  "updated_at": "2025-10-20T06:00:00Z",
  "created_by": "user_id"
}
```

### 5. Stop Challenge
Stop a running challenge and optionally remove instances.

**Endpoint:** `POST /challenges/{challenge_id}/stop`

**Request Body:**
```json
{
  "remove_instances": false
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161/stop" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "remove_instances": false
  }'
```

### 6. Update Challenge
Update challenge configuration.

**Endpoint:** `PUT /challenges/{challenge_id}`

**cURL Example:**
```bash
curl -X PUT "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "description": "Updated challenge description",
    "total_teams": 6,
    "is_active": true
  }'
```

### 7. Delete Challenge
Delete a challenge and all its instances.

**Endpoint:** `DELETE /challenges/{challenge_id}`

**cURL Example:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 8. Get Challenge Statistics
Get statistics for a specific challenge.

**Endpoint:** `GET /challenges/{challenge_id}/stats`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "total_instances": 4,
  "running_instances": 4,
  "failed_instances": 0,
  "total_teams": 4,
  "ip_allocation": {
    "team-001": "192.168.250.101",
    "team-002": "192.168.250.102",
    "team-003": "192.168.250.103",
    "team-004": "192.168.250.104"
  }
}
```

### 9. Get Team Access Information
Get access information for a specific team.

**Endpoint:** `GET /challenges/{challenge_id}/teams/{team_id}/access`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/challenges/68f5d9b6983236415a345161/teams/team-001/access" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "team_id": "team-001",
  "public_ip": "192.168.250.101",
  "access_url": "http://192.168.250.101/",
  "ports": [80],
  "status": "running",
  "created_at": "2025-10-20T06:00:00Z"
}
```

---

## 👥 User Management APIs

### 1. List Users
Get all users (Admin/Master role required).

**Endpoint:** `GET /users/`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/users/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Get User by ID
Get a specific user by ID.

**Endpoint:** `GET /users/{user_id}`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/users/user_id" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Update User
Update user information (Admin/Master role required).

**Endpoint:** `PUT /users/{user_id}`

**cURL Example:**
```bash
curl -X PUT "http://localhost:8000/api/v1/users/user_id" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "newemail@example.com",
    "role": "Admin",
    "is_active": true,
    "zone": "new_zone"
  }'
```

---

## 🔧 System APIs

### 1. Health Check
Check system health.

**Endpoint:** `GET /health`

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/health"
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T06:00:00Z"
}
```

---

## 📋 Complete Workflow Example

### Step 1: Register Master Admin
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "master_admin",
    "email": "admin@pacstar.com",
    "password": "AdminPass123",
    "zone": "master_zone"
  }'
```

### Step 2: Login as Master Admin
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "master_admin",
    "password": "AdminPass123"
  }'
```

### Step 3: Create a Challenge
```bash
curl -X POST "http://localhost:8000/api/v1/challenges/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "flask-hello-world",
    "description": "Flask Hello World challenge for 4 teams",
    "config": {
      "challenge_type": "web",
      "image": "python:3.9-slim",
      "ports": [5000],
      "environment_vars": {
        "FLAG": "CTF{flask_hello_world_flag}",
        "SECRET_KEY": "challenge-secret-key-123"
      },
      "resources": {
        "requests": {"cpu": "100m", "memory": "128Mi"},
        "limits": {"cpu": "500m", "memory": "512Mi"}
      },
      "health_check_path": "/",
      "flag_format": "CTF{}"
    },
    "total_teams": 4,
    "is_active": true
  }'
```

### Step 4: Deploy Challenge
```bash
curl -X POST "http://localhost:8000/api/v1/challenges/CHALLENGE_ID/deploy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "force_redeploy": false
  }'
```

### Step 5: Access Team Instances
After deployment, each team gets a unique public IP:
- Team 1: `http://192.168.250.101/`
- Team 2: `http://192.168.250.102/`
- Team 3: `http://192.168.250.103/`
- Team 4: `http://192.168.250.104/`

---

## 🚨 Error Responses

### Common Error Codes:
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

### Example Error Response:
```json
{
  "detail": "Only Master users can create challenges"
}
```

---

## 🔐 Role-Based Access Control

### Roles:
- **Master**: Can create, deploy, and manage all challenges
- **Admin**: Can manage users and view challenges
- **User**: Can view challenges and access team information

### Required Roles for Endpoints:
- **Challenge Creation**: Master only
- **Challenge Deployment**: Master only
- **Challenge Management**: Master only
- **User Management**: Admin/Master only
- **Challenge Viewing**: All authenticated users

---

## 📝 Notes

1. **IP Allocation**: Each team gets a unique public IP from the MetalLB pool (192.168.250.100-192.168.250.130)
2. **Kubernetes Integration**: Challenges are deployed as Kubernetes deployments with LoadBalancer services
3. **Authentication**: All endpoints require valid JWT tokens except registration and login
4. **Rate Limiting**: Consider implementing rate limiting for production use
5. **Monitoring**: Monitor Kubernetes resources and MetalLB IP allocation

---

## 🚀 Quick Start Commands

```bash
# 1. Register and login
curl -X POST "http://localhost:8000/api/v1/auth/register" -H "Content-Type: application/json" -d '{"username":"admin","email":"admin@test.com","password":"AdminPass123","zone":"zone1"}'
curl -X POST "http://localhost:8000/api/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"AdminPass123"}'

# 2. Create and deploy challenge (replace TOKEN with actual JWT)
curl -X POST "http://localhost:8000/api/v1/challenges/" -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"name":"test-challenge","description":"Test challenge","config":{"challenge_type":"web","image":"nginx:alpine","ports":[80]},"total_teams":2,"is_active":true}'
curl -X POST "http://localhost:8000/api/v1/challenges/CHALLENGE_ID/deploy" -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"force_redeploy":false}'

# 3. Access deployed challenge
curl http://192.168.250.101/
curl http://192.168.250.102/
```
