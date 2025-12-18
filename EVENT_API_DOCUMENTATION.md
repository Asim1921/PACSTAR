# Event Module API Documentation

Complete API reference for the PACSTAR Event Module with examples in **cURL** and **JavaScript/TypeScript**.

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [Event CRUD Operations](#event-crud-operations)
3. [Approval Workflow](#approval-workflow)
4. [Event Control](#event-control)
5. [Challenge Visibility](#challenge-visibility)
6. [Registration](#registration)
7. [Flag Submission](#flag-submission)
8. [Hints](#hints)
9. [Statistics and Dashboard](#statistics-and-dashboard)

---

## Base Configuration

### Base URL

**Backend Direct:**
```
http://192.168.15.248:8000/api/v1
```

**Via Next.js Proxy (Frontend):**
```
/api/proxy/events
```

### Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```bash
Authorization: Bearer <token>
```

**JavaScript Implementation:**
```javascript
const token = localStorage.getItem('auth_token');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Response Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `204 No Content` - Success (usually for DELETE)
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Event CRUD Operations

### 1. Create Event

Create a new CTF event or Cyber Exercise.

**Endpoint:** `POST /api/v1/events/`

**Permissions:** Master Admin, Zone Admin

**Request Body:**
```json
{
  "name": "Summer CTF 2024",
  "description": "Annual summer cybersecurity competition",
  "event_type": "ctf",
  "participation_type": "team_based",
  "zone": "zone1",
  "start_time": "2024-07-01T10:00:00",
  "end_time": "2024-07-03T18:00:00",
  "max_participants": 100,
  "is_public": true,
  "challenges": [
    {
      "challenge_id": "challenge_id_123",
      "visibility": "visible",
      "points_override": 150,
      "order": 1,
      "unlock_after": null,
      "max_attempts": 10,
      "hints": [
        {
          "content": "Check the source code",
          "hint_type": "toast",
          "cost": 10,
          "order": 1
        }
      ]
    }
  ]
}
```

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Summer CTF 2024",
    "description": "Annual summer cybersecurity competition",
    "event_type": "ctf",
    "participation_type": "team_based",
    "zone": "zone1",
    "start_time": "2024-07-01T10:00:00",
    "end_time": "2024-07-03T18:00:00",
    "max_participants": 100,
    "is_public": true,
    "challenges": []
  }'
```

**JavaScript/TypeScript:**
```typescript
import apiClient from '@/lib/api';

const createEvent = async (eventData: {
  name: string;
  description: string;
  event_type: 'ctf' | 'cyber_exercise';
  participation_type: 'user_based' | 'team_based';
  zone: string;
  start_time: string; // ISO 8601 format
  end_time: string; // ISO 8601 format
  max_participants?: number;
  is_public?: boolean;
  challenges?: Array<{
    challenge_id: string;
    visibility?: 'visible' | 'hidden';
    points_override?: number;
    order?: number;
    unlock_after?: string;
    max_attempts?: number;
    hints?: Array<{
      content: string;
      hint_type?: 'alert' | 'background' | 'toast';
      cost?: number;
      order?: number;
    }>;
  }>;
}) => {
  const response = await apiClient.post('/events/', eventData);
  return response.data;
};

// Usage
const newEvent = await createEvent({
  name: "Summer CTF 2024",
  description: "Annual summer cybersecurity competition",
  event_type: "ctf",
  participation_type: "team_based",
  zone: "zone1",
  start_time: "2024-07-01T10:00:00",
  end_time: "2024-07-03T18:00:00",
  max_participants: 100,
  is_public: true,
  challenges: []
});
```

---

### 2. List Events

List all events visible to the current user.

**Endpoint:** `GET /api/v1/events/`

**Permissions:** All authenticated users

**Query Parameters:**
- `status_filter` (optional): Filter by status (`draft`, `pending_approval`, `approved`, `rejected`, `scheduled`, `running`, `paused`, `completed`, `cancelled`)
- `event_type` (optional): Filter by type (`ctf`, `cyber_exercise`)
- `skip` (optional, default: 0): Number of events to skip
- `limit` (optional, default: 100, max: 500): Maximum events to return

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/?status_filter=running&event_type=ctf&skip=0&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const listEvents = async (filters?: {
  status_filter?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  event_type?: 'ctf' | 'cyber_exercise';
  skip?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.status_filter) params.append('status_filter', filters.status_filter);
  if (filters?.event_type) params.append('event_type', filters.event_type);
  if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
  if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
  
  const response = await apiClient.get(`/events/?${params.toString()}`);
  return response.data;
};

// Usage
const events = await listEvents({
  status_filter: 'running',
  event_type: 'ctf',
  skip: 0,
  limit: 50
});
```

---

### 3. Get Available Challenges

Get all active challenges that can be added to events.

**Endpoint:** `GET /api/v1/events/available-challenges`

**Permissions:** Master Admin, Zone Admin

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/available-challenges" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getAvailableChallenges = async () => {
  const response = await apiClient.get('/events/available-challenges');
  return response.data;
};

// Usage
const challenges = await getAvailableChallenges();
```

---

### 4. Get Pending Approvals

Get all events pending Master Admin approval.

**Endpoint:** `GET /api/v1/events/pending-approvals`

**Permissions:** Master Admin only

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/pending-approvals" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getPendingApprovals = async () => {
  const response = await apiClient.get('/events/pending-approvals');
  return response.data;
};

// Usage
const pendingEvents = await getPendingApprovals();
```

---

### 5. Get Event Details

Get detailed information about a specific event.

**Endpoint:** `GET /api/v1/events/{event_id}`

**Permissions:** All authenticated users (zone-based access control)

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getEvent = async (eventId: string) => {
  const response = await apiClient.get(`/events/${eventId}`);
  return response.data;
};

// Usage
const event = await getEvent('event_id_123');
```

---

### 6. Update Event

Update an existing event.

**Endpoint:** `PUT /api/v1/events/{event_id}`

**Permissions:** Master Admin, Zone Admin

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Event Name",
  "description": "Updated description",
  "start_time": "2024-07-01T10:00:00",
  "end_time": "2024-07-03T18:00:00",
  "max_participants": 150,
  "is_public": false,
  "challenges": []
}
```

**cURL:**
```bash
curl -X PUT "http://192.168.15.248:8000/api/v1/events/event_id_123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Updated Event Name",
    "max_participants": 150
  }'
```

**JavaScript/TypeScript:**
```typescript
const updateEvent = async (eventId: string, updateData: {
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  max_participants?: number;
  is_public?: boolean;
  challenges?: any[];
}) => {
  const response = await apiClient.put(`/events/${eventId}`, updateData);
  return response.data;
};

// Usage
const updatedEvent = await updateEvent('event_id_123', {
  name: "Updated Event Name",
  max_participants: 150
});
```

---

### 7. Delete Event

Delete an event and all related data.

**Endpoint:** `DELETE /api/v1/events/{event_id}`

**Permissions:** Master Admin, Zone Admin

**cURL:**
```bash
curl -X DELETE "http://192.168.15.248:8000/api/v1/events/event_id_123" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const deleteEvent = async (eventId: string) => {
  const response = await apiClient.delete(`/events/${eventId}`);
  return response.data;
};

// Usage
await deleteEvent('event_id_123');
```

---

## Approval Workflow

### 8. Submit Event for Approval

Submit a draft event for Master Admin approval.

**Endpoint:** `POST /api/v1/events/{event_id}/submit-for-approval`

**Permissions:** Master Admin, Zone Admin

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/submit-for-approval" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const submitForApproval = async (eventId: string) => {
  const response = await apiClient.post(`/events/${eventId}/submit-for-approval`);
  return response.data;
};

// Usage
const event = await submitForApproval('event_id_123');
```

---

### 9. Approve or Reject Event

Approve or reject an event pending approval.

**Endpoint:** `POST /api/v1/events/{event_id}/approve`

**Permissions:** Master Admin only

**Request Body:**
```json
{
  "approved": true,
  "comments": "Looks good, approved for launch"
}
```

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "approved": true,
    "comments": "Looks good, approved for launch"
  }'
```

**JavaScript/TypeScript:**
```typescript
const approveEvent = async (eventId: string, approved: boolean, comments?: string) => {
  const response = await apiClient.post(`/events/${eventId}/approve`, {
    approved,
    comments
  });
  return response.data;
};

// Usage - Approve
const approvedEvent = await approveEvent('event_id_123', true, 'Looks good');

// Usage - Reject
const rejectedEvent = await approveEvent('event_id_123', false, 'Needs more challenges');
```

---

## Event Control

### 10. Start Event

Start an approved/scheduled event.

**Endpoint:** `POST /api/v1/events/{event_id}/start`

**Permissions:** Master Admin, Zone Admin

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/start" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const startEvent = async (eventId: string) => {
  const response = await apiClient.post(`/events/${eventId}/start`);
  return response.data;
};

// Usage
const event = await startEvent('event_id_123');
```

---

### 11. Pause or Resume Event

Pause a running event or resume a paused event.

**Endpoint:** `POST /api/v1/events/{event_id}/pause`

**Permissions:** Master Admin, Zone Admin

**Request Body:**
```json
{
  "paused": true,
  "reason": "Maintenance window"
}
```

**cURL:**
```bash
# Pause event
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/pause" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "paused": true,
    "reason": "Maintenance window"
  }'

# Resume event
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/pause" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "paused": false,
    "reason": "Maintenance complete"
  }'
```

**JavaScript/TypeScript:**
```typescript
const pauseEvent = async (eventId: string, paused: boolean, reason?: string) => {
  const response = await apiClient.post(`/events/${eventId}/pause`, {
    paused,
    reason
  });
  return response.data;
};

// Usage - Pause
await pauseEvent('event_id_123', true, 'Maintenance window');

// Usage - Resume
await pauseEvent('event_id_123', false, 'Maintenance complete');
```

---

### 12. End Event

End a running or paused event.

**Endpoint:** `POST /api/v1/events/{event_id}/end`

**Permissions:** Master Admin, Zone Admin

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/end" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const endEvent = async (eventId: string) => {
  const response = await apiClient.post(`/events/${eventId}/end`);
  return response.data;
};

// Usage
const event = await endEvent('event_id_123');
```

---

## Challenge Visibility

### 13. Update Challenge Visibility

Show or hide a challenge within an event.

**Endpoint:** `PUT /api/v1/events/{event_id}/challenges/{challenge_id}/visibility`

**Permissions:** Master Admin, Zone Admin

**Request Body:**
```json
{
  "challenge_id": "challenge_id_123",
  "visibility": "hidden"
}
```

**cURL:**
```bash
curl -X PUT "http://192.168.15.248:8000/api/v1/events/event_id_123/challenges/challenge_id_123/visibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "challenge_id": "challenge_id_123",
    "visibility": "hidden"
  }'
```

**JavaScript/TypeScript:**
```typescript
const updateChallengeVisibility = async (
  eventId: string,
  challengeId: string,
  visibility: 'visible' | 'hidden'
) => {
  const response = await apiClient.put(
    `/events/${eventId}/challenges/${challengeId}/visibility`,
    {
      challenge_id: challengeId,
      visibility
    }
  );
  return response.data;
};

// Usage
await updateChallengeVisibility('event_id_123', 'challenge_id_123', 'hidden');
```

---

## Registration

### 14. Register for Event

Register the current user/team for an event.

**Endpoint:** `POST /api/v1/events/{event_id}/register`

**Permissions:** All authenticated users

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/register" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const registerForEvent = async (eventId: string) => {
  const response = await apiClient.post(`/events/${eventId}/register`);
  return response.data;
};

// Usage
const registration = await registerForEvent('event_id_123');
// Response: { success: true, message: "...", participant_id: "...", registered_at: "..." }
```

---

## Flag Submission

### 15. Submit Flag

Submit a flag for a challenge in an event.

**Endpoint:** `POST /api/v1/events/{event_id}/challenges/{challenge_id}/submit`

**Permissions:** All authenticated users (must be registered for event)

**Request Body:**
```json
{
  "flag": "FLAG{example_flag_12345}"
}
```

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/challenges/challenge_id_123/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "flag": "FLAG{example_flag_12345}"
  }'
```

**JavaScript/TypeScript:**
```typescript
const submitFlag = async (eventId: string, challengeId: string, flag: string) => {
  const response = await apiClient.post(
    `/events/${eventId}/challenges/${challengeId}/submit`,
    { flag }
  );
  return response.data;
};

// Usage
const result = await submitFlag('event_id_123', 'challenge_id_123', 'FLAG{example_flag_12345}');
// Response: {
//   status: "correct" | "incorrect" | "already_solved" | "max_attempts_reached",
//   points_awarded: 100,
//   message: "...",
//   attempts_remaining: 9
// }
```

---

## Hints

### 16. Unlock Hint

Unlock a hint for a challenge. May cost points.

**Endpoint:** `POST /api/v1/events/{event_id}/challenges/{challenge_id}/hints/unlock`

**Permissions:** All authenticated users (must be registered for event)

**Request Body:**
```json
{
  "hint_id": "hint_id_123"
}
```

**cURL:**
```bash
curl -X POST "http://192.168.15.248:8000/api/v1/events/event_id_123/challenges/challenge_id_123/hints/unlock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "hint_id": "hint_id_123"
  }'
```

**JavaScript/TypeScript:**
```typescript
const unlockHint = async (eventId: string, challengeId: string, hintId: string) => {
  const response = await apiClient.post(
    `/events/${eventId}/challenges/${challengeId}/hints/unlock`,
    { hint_id: hintId }
  );
  return response.data;
};

// Usage
const result = await unlockHint('event_id_123', 'challenge_id_123', 'hint_id_123');
// Response: {
//   success: true,
//   hint_content: "Check the source code",
//   points_deducted: 10,
//   message: "Hint unlocked successfully"
// }
```

---

## Statistics and Dashboard

### 17. Get Live Statistics

Get live statistics for event dashboard.

**Endpoint:** `GET /api/v1/events/{event_id}/stats`

**Permissions:** All authenticated users (zone-based access control)

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getLiveStats = async (eventId: string) => {
  const response = await apiClient.get(`/events/${eventId}/stats`);
  return response.data;
};

// Usage
const stats = await getLiveStats('event_id_123');
// Response includes:
// - total_participants, total_users, total_teams
// - total_submissions, correct_submissions, incorrect_submissions
// - most_solved_challenge, least_solved_challenge
// - top_users, top_teams
// - category_proficiency_distribution
// - submissions_timeline
// - time_remaining_seconds, etc.
```

---

### 18. Get Scoreboard

Get event scoreboard with rankings.

**Endpoint:** `GET /api/v1/events/{event_id}/scoreboard`

**Permissions:** All authenticated users (zone-based access control)

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123/scoreboard" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getScoreboard = async (eventId: string) => {
  const response = await apiClient.get(`/events/${eventId}/scoreboard`);
  return response.data;
};

// Usage
const scoreboard = await getScoreboard('event_id_123');
// Response: {
//   event_id: "...",
//   event_name: "...",
//   participation_type: "user_based" | "team_based",
//   scoreboard: [
//     {
//       rank: 1,
//       participant_id: "...",
//       participant_name: "...",
//       zone: "...",
//       total_points: 500,
//       challenges_solved: 5,
//       last_solve_time: "...",
//       first_bloods: 2
//     },
//     ...
//   ],
//   total_entries: 50,
//   last_updated: "..."
// }
```

---

### 19. Get User Statistics

Get detailed statistics for a specific user in an event.

**Endpoint:** `GET /api/v1/events/{event_id}/users/{user_id}/stats`

**Permissions:** All authenticated users (zone-based access control)

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123/users/user_id_123/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getUserStats = async (eventId: string, userId: string) => {
  const response = await apiClient.get(`/events/${eventId}/users/${userId}/stats`);
  return response.data;
};

// Usage
const userStats = await getUserStats('event_id_123', 'user_id_123');
// Response includes:
// - user_id, username, zone
// - total_points, challenges_solved
// - total_submissions, correct_submissions, incorrect_submissions
// - first_bloods
// - category_proficiency
// - ip_addresses
// - last_submission_at
```

---

### 20. Get Team Statistics

Get detailed statistics for a specific team in an event.

**Endpoint:** `GET /api/v1/events/{event_id}/teams/{team_id}/stats`

**Permissions:** All authenticated users (zone-based access control)

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123/teams/team_id_123/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getTeamStats = async (eventId: string, teamId: string) => {
  const response = await apiClient.get(`/events/${eventId}/teams/${teamId}/stats`);
  return response.data;
};

// Usage
const teamStats = await getTeamStats('event_id_123', 'team_id_123');
// Response includes:
// - team_id, team_name, zone
// - total_points, challenges_solved
// - total_submissions, correct_submissions, incorrect_submissions
// - first_bloods
// - member_count, members[]
// - category_proficiency
// - ip_addresses
// - last_submission_at
```

---

### 21. Get My Statistics

Get the current user's statistics in an event.

**Endpoint:** `GET /api/v1/events/{event_id}/my-stats`

**Permissions:** All authenticated users

**cURL:**
```bash
curl -X GET "http://192.168.15.248:8000/api/v1/events/event_id_123/my-stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**JavaScript/TypeScript:**
```typescript
const getMyStats = async (eventId: string) => {
  const response = await apiClient.get(`/events/${eventId}/my-stats`);
  return response.data;
};

// Usage
const myStats = await getMyStats('event_id_123');
// Response: Same format as getUserStats but for current user
```

---

## Complete JavaScript API Module

Here's a complete event API module you can add to your `lib/api.ts`:

```typescript
// Event API endpoints
export const eventAPI = {
  // Create event
  createEvent: async (eventData: any) => {
    const response = await apiClient.post('/events/', eventData);
    return response.data;
  },

  // List events
  listEvents: async (filters?: {
    status_filter?: string;
    event_type?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status_filter) params.append('status_filter', filters.status_filter);
    if (filters?.event_type) params.append('event_type', filters.event_type);
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
    
    const response = await apiClient.get(`/events/?${params.toString()}`);
    return response.data;
  },

  // Get available challenges
  getAvailableChallenges: async () => {
    const response = await apiClient.get('/events/available-challenges');
    return response.data;
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await apiClient.get('/events/pending-approvals');
    return response.data;
  },

  // Get event details
  getEvent: async (eventId: string) => {
    const response = await apiClient.get(`/events/${eventId}`);
    return response.data;
  },

  // Update event
  updateEvent: async (eventId: string, updateData: any) => {
    const response = await apiClient.put(`/events/${eventId}`, updateData);
    return response.data;
  },

  // Delete event
  deleteEvent: async (eventId: string) => {
    const response = await apiClient.delete(`/events/${eventId}`);
    return response.data;
  },

  // Submit for approval
  submitForApproval: async (eventId: string) => {
    const response = await apiClient.post(`/events/${eventId}/submit-for-approval`);
    return response.data;
  },

  // Approve or reject event
  approveEvent: async (eventId: string, approved: boolean, comments?: string) => {
    const response = await apiClient.post(`/events/${eventId}/approve`, {
      approved,
      comments
    });
    return response.data;
  },

  // Start event
  startEvent: async (eventId: string) => {
    const response = await apiClient.post(`/events/${eventId}/start`);
    return response.data;
  },

  // Pause or resume event
  pauseEvent: async (eventId: string, paused: boolean, reason?: string) => {
    const response = await apiClient.post(`/events/${eventId}/pause`, {
      paused,
      reason
    });
    return response.data;
  },

  // End event
  endEvent: async (eventId: string) => {
    const response = await apiClient.post(`/events/${eventId}/end`);
    return response.data;
  },

  // Update challenge visibility
  updateChallengeVisibility: async (
    eventId: string,
    challengeId: string,
    visibility: 'visible' | 'hidden'
  ) => {
    const response = await apiClient.put(
      `/events/${eventId}/challenges/${challengeId}/visibility`,
      {
        challenge_id: challengeId,
        visibility
      }
    );
    return response.data;
  },

  // Register for event
  registerForEvent: async (eventId: string) => {
    const response = await apiClient.post(`/events/${eventId}/register`);
    return response.data;
  },

  // Submit flag
  submitFlag: async (eventId: string, challengeId: string, flag: string) => {
    const response = await apiClient.post(
      `/events/${eventId}/challenges/${challengeId}/submit`,
      { flag }
    );
    return response.data;
  },

  // Unlock hint
  unlockHint: async (eventId: string, challengeId: string, hintId: string) => {
    const response = await apiClient.post(
      `/events/${eventId}/challenges/${challengeId}/hints/unlock`,
      { hint_id: hintId }
    );
    return response.data;
  },

  // Get live statistics
  getLiveStats: async (eventId: string) => {
    const response = await apiClient.get(`/events/${eventId}/stats`);
    return response.data;
  },

  // Get scoreboard
  getScoreboard: async (eventId: string) => {
    const response = await apiClient.get(`/events/${eventId}/scoreboard`);
    return response.data;
  },

  // Get user statistics
  getUserStats: async (eventId: string, userId: string) => {
    const response = await apiClient.get(`/events/${eventId}/users/${userId}/stats`);
    return response.data;
  },

  // Get team statistics
  getTeamStats: async (eventId: string, teamId: string) => {
    const response = await apiClient.get(`/events/${eventId}/teams/${teamId}/stats`);
    return response.data;
  },

  // Get my statistics
  getMyStats: async (eventId: string) => {
    const response = await apiClient.get(`/events/${eventId}/my-stats`);
    return response.data;
  },
};
```

---

## Event Status Flow

```
DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → RUNNING → COMPLETED
                              ↓
                          REJECTED
                              ↓
                          CANCELLED
```

**Status Transitions:**
1. **DRAFT**: Event created but not yet submitted
2. **PENDING_APPROVAL**: Submitted for Master Admin approval
3. **APPROVED**: Approved by Master Admin
4. **REJECTED**: Rejected by Master Admin
5. **SCHEDULED**: Approved and scheduled (auto-transition when start_time arrives)
6. **RUNNING**: Event is currently active
7. **PAUSED**: Event is temporarily paused (can resume)
8. **COMPLETED**: Event has ended
9. **CANCELLED**: Event was cancelled

---

## Event Types

- **`ctf`**: Capture The Flag competition
- **`cyber_exercise`**: Cyber security exercise

## Participation Types

- **`user_based`**: Individual scoring (users compete individually)
- **`team_based`**: Team scoring (teams compete, points are aggregated)

## Challenge Visibility

- **`visible`**: Challenge is visible to participants
- **`hidden`**: Challenge is hidden from participants

## Hint Types

- **`alert`**: Full-screen alert style hint
- **`background`**: Subtle background notification hint
- **`toast`**: Toast notification hint (default)

---

## Error Handling

All endpoints may return the following error responses:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Common Error Scenarios:**
- `400 Bad Request`: Invalid request data, validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions for the operation
- `404 Not Found`: Event, challenge, or resource not found
- `500 Internal Server Error`: Server-side error

**JavaScript Error Handling Example:**
```typescript
try {
  const event = await eventAPI.createEvent(eventData);
  console.log('Event created:', event);
} catch (error: any) {
  if (error.response) {
    // Server responded with error
    console.error('Error:', error.response.data.detail);
    if (error.response.status === 401) {
      // Handle unauthorized - redirect to login
      window.location.href = '/login';
    } else if (error.response.status === 403) {
      // Handle forbidden - show permission error
      alert('You do not have permission to perform this action');
    }
  } else if (error.request) {
    // Request made but no response
    console.error('No response from server');
  } else {
    // Error setting up request
    console.error('Error:', error.message);
  }
}
```

---

## Notes

1. **Authentication**: All endpoints (except health checks) require a valid JWT token in the Authorization header.

2. **Zone-based Access Control**: Users can only access events in their zone unless they are Master Admin or the event is public.

3. **Role Permissions**:
   - **Master Admin**: Full access to all events across all zones
   - **Zone Admin**: Can create/update/delete events in their zone only
   - **User**: Can view public events, register, submit flags, and view statistics

4. **Date/Time Format**: All date/time fields use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss` (e.g., `2024-07-01T10:00:00`)

5. **Event Lifecycle**: Events must be approved before they can be started. Draft events can be edited freely until submitted for approval.

6. **Flag Submission**: Users must be registered for an event before submitting flags. Points are calculated based on event-specific challenge points (which may override master challenge points).

7. **Hints**: Hints may have a point cost. Unlocking a hint deducts points from the user's/team's score.

---

## Additional Resources

- Backend API Documentation: `http://192.168.15.248:8000/api/v1/docs`
- Event Schema: `backend/app/schemas/event.py`
- Event Service: `backend/app/services/event_service.py`
- Event Endpoints: `backend/app/api/v1/endpoints/event.py`

