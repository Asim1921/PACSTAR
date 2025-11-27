# PACSTAR CTF Platform - Backend API Documentation

Complete API reference for the PACSTAR CTF Platform backend with
examples in **cURL** and **Node.js**.

## 📋 Table of Contents

1.  [Base Configuration](#base-configuration)
2.  [Authentication](#authentication)
3.  [User Management](#user-management)
4.  [Team Management](#team-management)
5.  [Challenge Management](#challenge-management)
6.  [File Management](#file-management)
7.  [Builder (Docker Image
    Management)](#builder-docker-image-management)
8.  [Error Handling](#error-handling)

## Base Configuration

### Base URL

    http://10.10.101.69:8000/api/v1

### Authentication

All protected endpoints require a JWT token in the `Authorization`
header:

    Authorization: Bearer <access_token>

### Content-Type

-   JSON requests: `Content-Type: application/json`
-   File uploads: `Content-Type: multipart/form-data`

## Authentication

### 1. Register User

**Endpoint:** `POST /auth/register`

**Description:** Register a new user (default role: User). Supports team
registration via `team_code` or `create_team` option.

**Request Body:**

    {
      "username": "john_doe",
      "email": "john@example.com",
      "password": "SecurePass123!",
      "zone": "zone1",
      "team_code": null,
      "create_team": false,
      "team_name": null
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/auth/register" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "john_doe",
        "email": "john@example.com",
        "password": "SecurePass123!",
        "zone": "zone1"
      }'

**Node.js:**

    const axios = require('axios');

    async function registerUser() {
      try {
        const response = await axios.post('http://10.10.101.69:8000/api/v1/auth/register', {
          username: 'john_doe',
          email: 'john@example.com',
          password: 'SecurePass123!',
          zone: 'zone1'
        });
        console.log('User registered:', response.data);
      } catch (error) {
        console.error('Registration failed:', error.response?.data || error.message);
      }
    }

**Response (201 Created):**

    {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "User",
      "is_active": true,
      "zone": "zone1",
      "team_code": null,
      "team_id": null
    }

### 2. Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user and receive access + refresh tokens.

**Request Body:**

    {
      "username": "john_doe",
      "password": "SecurePass123!"
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "john_doe",
        "password": "SecurePass123!"
      }'

**Node.js:**

    async function login() {
      try {
        const response = await axios.post('http://10.10.101.69:8000/api/v1/auth/login', {
          username: 'john_doe',
          password: 'SecurePass123!'
        });
        
        const { access_token, refresh_token } = response.data;
        // Store tokens securely (localStorage, secure cookie, etc.)
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        console.log('Login successful');
      } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer"
    }

### 3. Get Current User

**Endpoint:** `GET /auth/me`

**Description:** Get the profile of the currently authenticated user.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/auth/me" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getCurrentUser() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Current user:', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to get user:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "User",
      "zone": "zone1",
      "team_code": "ABC123",
      "team_id": "507f1f77bcf86cd799439012",
      "is_active": true
    }

### 4. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Description:** Rotate refresh token and get new access + refresh
tokens.

**Request Body:**

    {
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/auth/refresh" \
      -H "Content-Type: application/json" \
      -d '{
        "refresh_token": "YOUR_REFRESH_TOKEN"
      }'

**Node.js:**

    async function refreshToken() {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post('http://10.10.101.69:8000/api/v1/auth/refresh', {
          refresh_token: refreshToken
        });
        
        const { access_token, refresh_token: new_refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', new_refresh_token);
        
        console.log('Token refreshed');
      } catch (error) {
        console.error('Token refresh failed:', error.response?.data || error.message);
      }
    }

### 5. Logout

**Endpoint:** `POST /auth/logout`

**Description:** Revoke refresh token (logout).

**Request Body:**

    {
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/auth/logout" \
      -H "Content-Type: application/json" \
      -d '{
        "refresh_token": "YOUR_REFRESH_TOKEN"
      }'

**Node.js:**

    async function logout() {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        await axios.post('http://10.10.101.69:8000/api/v1/auth/logout', {
          refresh_token: refreshToken
        });
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        console.log('Logged out successfully');
      } catch (error) {
        console.error('Logout failed:', error.response?.data || error.message);
      }
    }

## User Management

### 1. List Users

**Endpoint:** `GET /users/`

**Description:** List all users (Master/Admin only). Zone-restricted for
Admins.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/users/" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function listUsers() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/users/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Users:', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to list users:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    [
      {
        "id": "507f1f77bcf86cd799439011",
        "username": "john_doe",
        "email": "john@example.com",
        "role": "User",
        "zone": "zone1",
        "is_active": true
      }
    ]

### 2. Get User by ID

**Endpoint:** `GET /users/{user_id}`

**Description:** Get a single user profile. Master can get anyone, Admin
can only get users in their zone, Users can only get themselves.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/users/507f1f77bcf86cd799439011" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getUser(userId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(`http://10.10.101.69:8000/api/v1/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to get user:', error.response?.data || error.message);
      }
    }

### 3. Update User

**Endpoint:** `PUT /users/{user_id}`

**Description:** Update user details (role + zone restrictions applied).

**Request Body:**

    {
      "zone": "zone2",
      "is_active": true
    }

**cURL:**

    curl -X PUT "http://10.10.101.69:8000/api/v1/users/507f1f77bcf86cd799439011" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "zone": "zone2"
      }'

**Node.js:**

    async function updateUser(userId, updates) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.put(
          `http://10.10.101.69:8000/api/v1/users/${userId}`,
          updates,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to update user:', error.response?.data || error.message);
      }
    }

## Team Management

### 1. Create Team

**Endpoint:** `POST /teams/`

**Description:** Create a new team. User becomes the team leader.

**Request Body:**

    {
      "name": "Team Alpha",
      "description": "Elite CTF team",
      "max_members": 10,
      "is_active": true
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/teams/" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Team Alpha",
        "description": "Elite CTF team",
        "max_members": 10
      }'

**Node.js:**

    async function createTeam(teamData) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/teams/',
          teamData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Team created:', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to create team:', error.response?.data || error.message);
      }
    }

**Response (201 Created):**

    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Team Alpha",
      "description": "Elite CTF team",
      "team_code": "ABC123",
      "leader_id": "507f1f77bcf86cd799439011",
      "leader_username": "john_doe",
      "members": [
        {
          "user_id": "507f1f77bcf86cd799439011",
          "username": "john_doe",
          "email": "john@example.com",
          "role": "leader",
          "joined_at": "2024-01-15T10:30:00Z"
        }
      ],
      "member_count": 1,
      "max_members": 10,
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }

### 2. Join Team

**Endpoint:** `POST /teams/join`

**Description:** Join a team using team code.

**Request Body:**

    {
      "team_code": "ABC123"
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/teams/join" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "team_code": "ABC123"
      }'

**Node.js:**

    async function joinTeam(teamCode) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/teams/join',
          { team_code: teamCode },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Joined team:', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to join team:', error.response?.data || error.message);
      }
    }

### 3. Get My Team

**Endpoint:** `GET /teams/my-team`

**Description:** Get the current user's team information.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/teams/my-team" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getMyTeam() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/teams/my-team', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to get team:', error.response?.data || error.message);
      }
    }

### 4. List All Teams

**Endpoint:** `GET /teams/`

**Description:** List all active teams.

**Query Parameters:**

-   `skip` (optional): Number of records to skip (default: 0)
-   `limit` (optional): Maximum number of records (default: 100)

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/teams/?skip=0&limit=10" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function listTeams(skip = 0, limit = 100) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/teams/', {
          params: { skip, limit },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to list teams:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "teams": [
        {
          "id": "507f1f77bcf86cd799439012",
          "name": "Team Alpha",
          "team_code": "ABC123",
          "member_count": 5,
          "is_active": true
        }
      ],
      "total": 1
    }

### 5. Get Team by ID

**Endpoint:** `GET /teams/{team_id}`

**Description:** Get team details by ID.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/teams/507f1f77bcf86cd799439012" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getTeam(teamId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/teams/${teamId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to get team:', error.response?.data || error.message);
      }
    }

## Challenge Management

### 1. Create Challenge

**Endpoint:** `POST /challenges/`

**Description:** Create a new challenge (Master role required).

**Request Body (Containerized):**

    {
      "name": "Buffer Overflow Challenge",
      "description": "Exploit a buffer overflow vulnerability",
      "challenge_category": "containerized",
      "config": {
        "challenge_type": "pwn",
        "image": "10.10.101.69:5000/buffer-overflow:latest",
        "ports": [8080],
        "environment_vars": {},
        "resources": {
          "cpu": "500m",
          "memory": "512Mi"
        }
      },
      "flag": "crypto-TRI{flag_here}",
      "points": 500,
      "total_teams": 10,
      "is_active": true,
      "allowed_teams": null
    }

**Request Body (Static):**

    {
      "name": "Reverse Engineering Challenge",
      "description": "Reverse engineer this binary",
      "challenge_category": "static",
      "config": {
        "challenge_type": "reverse",
        "file_path": "uploads/abc123.exe",
        "file_name": "challenge.exe",
        "download_url": "/api/v1/files/serve/abc123"
      },
      "flag": "crypto-TRI{flag_here}",
      "points": 300,
      "total_teams": 10,
      "is_active": true
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Buffer Overflow Challenge",
        "description": "Exploit a buffer overflow",
        "challenge_category": "containerized",
        "config": {
          "challenge_type": "pwn",
          "image": "10.10.101.69:5000/buffer-overflow:latest",
          "ports": [8080]
        },
        "flag": "crypto-TRI{flag_here}",
        "points": 500,
        "total_teams": 10,
        "is_active": true
      }'

**Node.js:**

    async function createChallenge(challengeData) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/challenges/',
          challengeData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to create challenge:', error.response?.data || error.message);
      }
    }

### 2. List Challenges

**Endpoint:** `GET /challenges/`

**Description:** List all challenges visible to the current user's team.

**Query Parameters:**

-   `skip` (optional): Number of records to skip (default: 0)
-   `limit` (optional): Maximum number of records (default: 100)

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/challenges/?skip=0&limit=10" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function listChallenges(skip = 0, limit = 100) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/challenges/', {
          params: { skip, limit },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to list challenges:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "challenges": [
        {
          "id": "507f1f77bcf86cd799439013",
          "name": "Buffer Overflow Challenge",
          "description": "Exploit a buffer overflow",
          "challenge_category": "containerized",
          "status": "pending",
          "flag": "crypto-TRI{flag_here}",
          "points": 500,
          "total_teams": 10,
          "is_active": true,
          "instances": [],
          "created_at": "2024-01-15T10:30:00Z",
          "updated_at": "2024-01-15T10:30:00Z",
          "created_by": "507f1f77bcf86cd799439011"
        }
      ],
      "total": 1
    }

### 3. Get Challenge by ID

**Endpoint:** `GET /challenges/{challenge_id}`

**Description:** Get a specific challenge by ID.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getChallenge(challengeId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to get challenge:', error.response?.data || error.message);
      }
    }

### 4. Update Challenge

**Endpoint:** `PUT /challenges/{challenge_id}`

**Description:** Update a challenge (Master role required).

**Request Body:**

    {
      "description": "Updated description",
      "is_active": false,
      "points": 600
    }

**cURL:**

    curl -X PUT "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "description": "Updated description",
        "is_active": false
      }'

**Node.js:**

    async function updateChallenge(challengeId, updates) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.put(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}`,
          updates,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to update challenge:', error.response?.data || error.message);
      }
    }

### 5. Delete Challenge

**Endpoint:** `DELETE /challenges/{challenge_id}`

**Description:** Delete a challenge and all its instances (Master role
required).

**cURL:**

    curl -X DELETE "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function deleteChallenge(challengeId) {
      try {
        const token = localStorage.getItem('access_token');
        await axios.delete(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        console.log('Challenge deleted');
      } catch (error) {
        console.error('Failed to delete challenge:', error.response?.data || error.message);
      }
    }

### 6. Start Challenge Instance

**Endpoint:** `POST /challenges/{challenge_id}/start`

**Description:** Start/deploy a challenge instance for the current
user's team.

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/start" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function startChallenge(challengeId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/start`,
          {},
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to start challenge:', error.response?.data || error.message);
      }
    }

### 7. Reset Challenge Instance

**Endpoint:** `POST /challenges/{challenge_id}/reset`

**Description:** Reset/redeploy a challenge instance for the current
user's team.

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/reset" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function resetChallenge(challengeId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/reset`,
          {},
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to reset challenge:', error.response?.data || error.message);
      }
    }

### 8. Deploy Challenge

**Endpoint:** `POST /challenges/{challenge_id}/deploy`

**Description:** Deploy a challenge to Kubernetes. Master can deploy for
all teams or specific team. Regular users can only deploy for their own
team.

**Request Body:**

    {
      "force_redeploy": false,
      "team_id": "team-001"
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/deploy" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "force_redeploy": false,
        "team_id": "team-001"
      }'

**Node.js:**

    async function deployChallenge(challengeId, teamId = null, forceRedeploy = false) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/deploy`,
          {
            force_redeploy: forceRedeploy,
            team_id: teamId
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to deploy challenge:', error.response?.data || error.message);
      }
    }

### 9. Stop Challenge

**Endpoint:** `POST /challenges/{challenge_id}/stop`

**Description:** Stop a challenge and optionally remove all instances
(Master role required).

**Request Body:**

    {
      "remove_instances": true
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/stop" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "remove_instances": true
      }'

**Node.js:**

    async function stopChallenge(challengeId, removeInstances = false) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/stop`,
          { remove_instances: removeInstances },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to stop challenge:', error.response?.data || error.message);
      }
    }

### 10. Submit Flag

**Endpoint:** `POST /challenges/{challenge_id}/submit-flag`

**Description:** Submit a flag for a challenge. Awards points if correct
and not previously solved by the team.

**Request Body:**

    {
      "flag": "crypto-TRI{flag_here}"
    }

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/submit-flag" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "flag": "crypto-TRI{flag_here}"
      }'

**Node.js:**

    async function submitFlag(challengeId, flag) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/submit-flag`,
          { flag },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Flag submission failed:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "success": true,
      "message": "Flag is correct! You earned 500 points.",
      "points": 500
    }

**Response (400 Bad Request - Wrong Flag):**

    {
      "success": false,
      "message": "Incorrect flag"
    }

**Response (400 Bad Request - Already Solved):**

    {
      "success": false,
      "message": "Your team has already solved this challenge"
    }

### 11. Get Scoreboard

**Endpoint:** `GET /challenges/scores`

**Description:** Get overall team scoreboard.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/challenges/scores" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getScoreboard() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/challenges/scores', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to get scoreboard:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "scoreboard": [
        {
          "team_id": "team-001",
          "team_name": "Team Alpha",
          "points": 1500,
          "solves": 3
        },
        {
          "team_id": "team-002",
          "team_name": "Team Beta",
          "points": 800,
          "solves": 2
        }
      ]
    }

### 12. Get Challenge Stats

**Endpoint:** `GET /challenges/{challenge_id}/stats`

**Description:** Get statistics for a challenge.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/stats" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getChallengeStats(challengeId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/stats`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to get stats:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "total_instances": 10,
      "running_instances": 8,
      "failed_instances": 2,
      "total_teams": 10,
      "ip_allocation": {
        "team-001": "192.168.250.101",
        "team-002": "192.168.250.102"
      }
    }

### 13. Get Team Access Info

**Endpoint:** `GET /challenges/{challenge_id}/team/{team_id}/access`

**Description:** Get access information for a specific team.

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/challenges/507f1f77bcf86cd799439013/team/team-001/access" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function getTeamAccessInfo(challengeId, teamId) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/challenges/${challengeId}/team/${teamId}/access`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to get access info:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "team_id": "team-001",
      "challenge_name": "Buffer Overflow Challenge",
      "public_ip": "192.168.250.101",
      "ports": [8080],
      "status": "running",
      "access_url": "http://192.168.250.101:8080"
    }

## File Management

### 1. Upload File

**Endpoint:** `POST /files/upload`

**Description:** Upload a challenge file (Master/Admin only).

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/files/upload" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -F "file=@/path/to/challenge.exe"

**Node.js:**

    const FormData = require('form-data');
    const fs = require('fs');

    async function uploadFile(filePath) {
      try {
        const token = localStorage.getItem('access_token');
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/files/upload',
          form,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              ...form.getHeaders()
            }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to upload file:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "file_id": "abc123def456",
      "filename": "challenge.exe",
      "file_path": "uploads/abc123def456.exe",
      "file_size": 1024000,
      "download_url": "/api/v1/files/download/abc123def456"
    }

### 2. Download File

**Endpoint:** `GET /files/download/{file_id}`

**Description:** Download a challenge file (requires authentication).

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/files/download/abc123def456" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -o challenge.exe

**Node.js:**

    const fs = require('fs');

    async function downloadFile(fileId, outputPath) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/files/download/${fileId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'stream'
          }
        );
        
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      } catch (error) {
        console.error('Failed to download file:', error.response?.data || error.message);
      }
    }

### 3. Serve File (Public)

**Endpoint:** `GET /files/serve/{file_id}`

**Description:** Serve a challenge file with a clean URL (no auth
required for public access).

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/files/serve/abc123def456" \
      -o challenge.exe

**Node.js:**

    async function serveFile(fileId, outputPath) {
      try {
        const response = await axios.get(
          `http://10.10.101.69:8000/api/v1/files/serve/${fileId}`,
          {
            responseType: 'stream'
          }
        );
        
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      } catch (error) {
        console.error('Failed to serve file:', error.response?.data || error.message);
      }
    }

### 4. List Files

**Endpoint:** `GET /files/list`

**Description:** List all uploaded files (Master/Admin only).

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/files/list" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function listFiles() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/files/list', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to list files:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "files": [
        {
          "filename": "abc123def456.exe",
          "file_id": "abc123def456",
          "file_size": 1024000,
          "created_at": "2024-01-15T10:30:00Z",
          "download_url": "/api/v1/files/download/abc123def456"
        }
      ]
    }

## Builder (Docker Image Management)

### 1. Build Image from ZIP

**Endpoint:** `POST /builder/build-image`

**Description:** Accept a ZIP bundle, extract it, and build a Docker
image locally (Master/Admin only).

**Request (multipart/form-data):**

-   `file`: ZIP file containing Dockerfile
-   `image_name`: Docker image name (e.g.,
    `10.10.101.69:5000/myimage:latest`)
-   `dockerfile_path`: Path to Dockerfile in ZIP (default: `Dockerfile`)
-   `context_subdir`: Subdirectory for build context (optional)
-   `push_to_registry`: Boolean (default: `false`)
-   `registry`: Registry host:port (e.g., `10.10.101.69:5000`)

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/builder/build-image" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
      -F "file=@/path/to/challenge.zip" \
      -F "image_name=10.10.101.69:5000/buffer-overflow:latest" \
      -F "dockerfile_path=Dockerfile" \
      -F "context_subdir=" \
      -F "push_to_registry=true" \
      -F "registry=10.10.101.69:5000"

**Node.js:**

    async function buildImage(zipPath, imageName, options = {}) {
      try {
        const token = localStorage.getItem('access_token');
        const form = new FormData();
        form.append('file', fs.createReadStream(zipPath));
        form.append('image_name', imageName);
        form.append('dockerfile_path', options.dockerfilePath || 'Dockerfile');
        form.append('context_subdir', options.contextSubdir || '');
        form.append('push_to_registry', options.pushToRegistry || false);
        if (options.registry) {
          form.append('registry', options.registry);
        }
        
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/builder/build-image',
          form,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              ...form.getHeaders()
            },
            timeout: 300000 // 5 minutes
          }
        );
        return response.data;
      } catch (error) {
        console.error('Build failed:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "success": true,
      "image": "10.10.101.69:5000/buffer-overflow:latest",
      "pushed_image": "10.10.101.69:5000/buffer-overflow:latest",
      "logs": [
        "Step 1/5 : FROM ubuntu:20.04",
        "Step 2/5 : RUN apt-get update",
        "...",
        "✅ Successfully pushed: 10.10.101.69:5000/buffer-overflow:latest"
      ]
    }

### 2. List Local Images

**Endpoint:** `GET /builder/images`

**Description:** List local Docker images for selection in UI
(Master/Admin only).

**cURL:**

    curl -X GET "http://10.10.101.69:8000/api/v1/builder/images" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function listImages() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://10.10.101.69:8000/api/v1/builder/images', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
      } catch (error) {
        console.error('Failed to list images:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    [
      {
        "name": "10.10.101.69:5000/buffer-overflow:latest",
        "id": "abc123def456",
        "created": "2 hours ago",
        "size": "512MB"
      }
    ]

### 3. Delete Image

**Endpoint:** `DELETE /builder/images/{image_name}`

**Description:** Delete a Docker image from local registry and local
Docker (Master/Admin only).

**Note:** `image_name` can include path (e.g.,
`10.10.101.69:5000/myimage:latest`)

**cURL:**

    curl -X DELETE "http://10.10.101.69:8000/api/v1/builder/images/10.10.101.69:5000/buffer-overflow:latest" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function deleteImage(imageName) {
      try {
        const token = localStorage.getItem('access_token');
        // URL encode the image name if it contains special characters
        const encodedName = encodeURIComponent(imageName);
        const response = await axios.delete(
          `http://10.10.101.69:8000/api/v1/builder/images/${encodedName}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to delete image:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "success": true,
      "message": "Image 10.10.101.69:5000/buffer-overflow:latest deleted",
      "logs": ["Untagged: 10.10.101.69:5000/buffer-overflow:latest", "Deleted: abc123def456"]
    }

### 4. Kill All Challenges

**Endpoint:** `POST /builder/kill-all`

**Description:** Kill all challenge namespaces and pods (Master only).

**cURL:**

    curl -X POST "http://10.10.101.69:8000/api/v1/builder/kill-all" \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

**Node.js:**

    async function killAllChallenges() {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.post(
          'http://10.10.101.69:8000/api/v1/builder/kill-all',
          {},
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        return response.data;
      } catch (error) {
        console.error('Failed to kill all:', error.response?.data || error.message);
      }
    }

**Response (200 OK):**

    {
      "success": true,
      "message": "Killed 5/5 challenge namespace(s)",
      "logs": [
        "🔍 Found 5 challenge namespace(s)",
        "   Namespaces: challenge-bufferoverflow, challenge-web1, ...",
        "🗑️  Deleting namespace: challenge-bufferoverflow",
        "   ✅ Successfully deleted challenge-bufferoverflow",
        "...",
        "📊 Summary:",
        "   ✅ Successfully deleted: 5",
        "   ❌ Failed: 0",
        "   📦 Total found: 5"
      ],
      "deleted_count": 5,
      "failed_count": 0,
      "total_found": 5
    }

## Error Handling

### Standard Error Response Format

All errors follow this format:

    {
      "detail": "Error message description"
    }

### Common HTTP Status Codes

-   **200 OK**: Request successful
-   **201 Created**: Resource created successfully
-   **204 No Content**: Resource deleted successfully
-   **400 Bad Request**: Invalid request data
-   **401 Unauthorized**: Missing or invalid authentication token
-   **403 Forbidden**: Insufficient permissions
-   **404 Not Found**: Resource not found
-   **500 Internal Server Error**: Server error

### Example Error Responses

**401 Unauthorized:**

    {
      "detail": "Missing or invalid Authorization header"
    }

**403 Forbidden:**

    {
      "detail": "Only Master users can create challenges"
    }

**404 Not Found:**

    {
      "detail": "Challenge not found"
    }

**400 Bad Request:**

    {
      "detail": "Incorrect flag"
    }

### Node.js Error Handling Example

    async function apiCall() {
      try {
        const response = await axios.get('http://10.10.101.69:8000/api/v1/challenges/');
        return response.data;
      } catch (error) {
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          const message = error.response.data.detail || error.response.data.message;
          
          switch (status) {
            case 401:
              console.error('Unauthorized - Token expired or invalid');
              // Redirect to login or refresh token
              break;
            case 403:
              console.error('Forbidden - Insufficient permissions');
              break;
            case 404:
              console.error('Not Found - Resource does not exist');
              break;
            case 500:
              console.error('Server Error - Please try again later');
              break;
            default:
              console.error(`Error ${status}: ${message}`);
          }
        } else if (error.request) {
          // Request made but no response received
          console.error('Network Error - No response from server');
        } else {
          // Error setting up request
          console.error('Error:', error.message);
        }
        throw error;
      }
    }

## Complete Node.js Example

Here's a complete example of a Node.js client for the API:

    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs');

    class PacstarAPI {
      constructor(baseURL = 'http://10.10.101.69:8000/api/v1') {
        this.baseURL = baseURL;
        this.token = null;
      }

      setToken(token) {
        this.token = token;
      }

      getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
      }

      async login(username, password) {
        try {
          const response = await axios.post(`${this.baseURL}/auth/login`, {
            username,
            password
          });
          this.setToken(response.data.access_token);
          return response.data;
        } catch (error) {
          throw new Error(error.response?.data?.detail || 'Login failed');
        }
      }

      async listChallenges() {
        try {
          const response = await axios.get(`${this.baseURL}/challenges/`, {
            headers: this.getHeaders()
          });
          return response.data;
        } catch (error) {
          throw new Error(error.response?.data?.detail || 'Failed to list challenges');
        }
      }

      async startChallenge(challengeId) {
        try {
          const response = await axios.post(
            `${this.baseURL}/challenges/${challengeId}/start`,
            {},
            { headers: this.getHeaders() }
          );
          return response.data;
        } catch (error) {
          throw new Error(error.response?.data?.detail || 'Failed to start challenge');
        }
      }

      async submitFlag(challengeId, flag) {
        try {
          const response = await axios.post(
            `${this.baseURL}/challenges/${challengeId}/submit-flag`,
            { flag },
            { headers: this.getHeaders() }
          );
          return response.data;
        } catch (error) {
          throw new Error(error.response?.data?.detail || 'Flag submission failed');
        }
      }

      async getScoreboard() {
        try {
          const response = await axios.get(`${this.baseURL}/challenges/scores`, {
            headers: this.getHeaders()
          });
          return response.data;
        } catch (error) {
          throw new Error(error.response?.data?.detail || 'Failed to get scoreboard');
        }
      }
    }

    // Usage example
    async function main() {
      const api = new PacstarAPI();
      
      // Login
      await api.login('john_doe', 'SecurePass123!');
      
      // List challenges
      const challenges = await api.listChallenges();
      console.log('Available challenges:', challenges);
      
      // Start a challenge
      if (challenges.challenges.length > 0) {
        const challengeId = challenges.challenges[0].id;
        await api.startChallenge(challengeId);
      }
      
      // Submit a flag
      await api.submitFlag('challenge_id', 'crypto-TRI{flag_here}');
      
      // Get scoreboard
      const scoreboard = await api.getScoreboard();
      console.log('Scoreboard:', scoreboard);
    }

    main().catch(console.error);

## Notes

1.  **Token Management**: Store tokens securely (localStorage, secure
    cookies, or secure storage). Tokens expire after 15 minutes (access)
    or 7 days (refresh).

2.  **Token Refresh**: Implement automatic token refresh before
    expiration to avoid 401 errors.

3.  **File Uploads**: For large files, consider using chunked uploads or
    progress tracking.

4.  **Error Handling**: Always handle errors gracefully and provide user
    feedback.

5.  **Rate Limiting**: The API has rate limiting (100 requests per 60
    seconds). Implement retry logic with exponential backoff.

6.  **Base URL**: Update the base URL if your backend is hosted
    elsewhere.

7.  **CORS**: Ensure your frontend domain is allowed in the backend CORS
    configuration.

## Support

For issues or questions, refer to the main README.md or contact the
development team.

**Last Updated:** 2024-01-15
