# ☁️ PACSTAR OpenStack API Guide

This guide shows how to call every PACSTAR OpenStack endpoint using both
**cURL** and **Node.js (fetch)** from a Master account.

> **Base URL:** `http://localhost:8000/api/v1`
>
> Replace with the appropriate host/IP if the backend is remote.

## 1. Authenticate and get token

### cURL

    curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"username":"master","password":"SuperSecureP@ssw0rd"}'

Output contains `access_token` that must be used in the
`Authorization: Bearer <token>` header for all subsequent calls.

### Node.js

    const fetch = require("node-fetch");

    async function login() {
      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "master", password: "SuperSecureP@ssw0rd" })
      });
      const data = await res.json();
      console.log(data.access_token);
    }

    login();

## 2. GET `/openstack/summary`

Returns overall usage (instances, cores, RAM) plus hypervisor + network
details.

### cURL

    curl -s "http://localhost:8000/api/v1/openstack/summary" \
      -H "Authorization: Bearer $TOKEN"

### Node.js

    async function getSummary(token) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/summary", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(data);
    }

## 3. GET `/openstack/snapshots`

Lists Glance snapshots/images available for deployments.

### cURL

    curl -s "http://localhost:8000/api/v1/openstack/snapshots" \
      -H "Authorization: Bearer $TOKEN"

### Node.js

    async function listSnapshots(token) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/snapshots", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(await res.json());
    }

## 4. GET `/openstack/instances?status_filter=ACTIVE`

Lists running Nova instances (filter defaults to `ACTIVE`).

### cURL

    curl -s "http://localhost:8000/api/v1/openstack/instances?status_filter=ACTIVE" \
      -H "Authorization: Bearer $TOKEN"

### Node.js

    async function listInstances(token, status = "ACTIVE") {
      const res = await fetch(`http://localhost:8000/api/v1/openstack/instances?status_filter=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(await res.json());
    }

## 5. GET `/openstack/networks`

Shows Neutron networks plus available/used IP counts.

### cURL

    curl -s "http://localhost:8000/api/v1/openstack/networks" \
      -H "Authorization: Bearer $TOKEN"

### Node.js

    async function listNetworks(token) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/networks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(await res.json());
    }

## 6. GET `/openstack/teams`

Helper endpoint that mirrors PACSTAR teams for deployment planning.

### cURL

    curl -s "http://localhost:8000/api/v1/openstack/teams" \
      -H "Authorization: Bearer $TOKEN"

### Node.js

    async function listTeams(token) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/teams", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(await res.json());
    }

## 7. POST `/openstack/deployments/plan`

Suggests the best network given team IDs + desired instances per team.

### cURL

    curl -s -X POST "http://localhost:8000/api/v1/openstack/deployments/plan" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
            "team_ids": ["6923fc681acc3442c943c880"],
            "instances_per_team": 1
          }'

### Node.js

    async function buildPlan(token, teamIds, instancesPerTeam) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/deployments/plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ team_ids: teamIds, instances_per_team: instancesPerTeam })
      });
      console.log(await res.json());
    }

## 8. POST `/openstack/deployments`

Launches a snapshot per team. Requires snapshot ID, flavor, network
strategy, etc.

### cURL

    curl -s -X POST "http://localhost:8000/api/v1/openstack/deployments" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
            "snapshot_id": "c384ae6d-5718-452f-b101-b2dea62a53c6",
            "flavor_id": "FLAVOR_ID",
            "team_ids": ["6923fc681acc3442c943c880"],
            "instances_per_team": 1,
            "network_strategy": "shared",
            "network_id": "NETWORK_ID",
            "security_group_names": ["default"],
            "metadata": {"challenge": "webserver"}
          }'

### Node.js

    async function deploySnapshot(token, payload) {
      const res = await fetch("http://localhost:8000/api/v1/openstack/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      console.log(await res.json());
    }

    const payload = {
      snapshot_id: "c384ae6d-5718-452f-b101-b2dea62a53c6",
      flavor_id: "FLAVOR_ID",
      team_ids: ["6923fc681acc3442c943c880"],
      instances_per_team: 1,
      network_strategy: "shared",
      network_id: "NETWORK_ID",
      security_group_names: ["default"],
      metadata: { challenge: "webserver" }
    };

## 9. Error Handling Tips

-   Always ensure `Authorization: Bearer <token>` header is present.
-   For external hosts, replace `localhost` with the backend IP/host.
-   If you see `503 OpenStack integration is disabled`, confirm
    `OPENSTACK_ENABLED=true` and restart backend.
-   Network suggestions depend on `available_ips`; deploy plan may
    return `null` if no network fits.

## 10. Useful IDs

Keep these handy (replace with real values from your environment):

-   **Team IDs:** `GET /openstack/teams`
-   **Snapshot IDs:** `GET /openstack/snapshots`
-   **Flavor IDs:** `openstack flavor list` (or Horizon)
-   **Network IDs:** `GET /openstack/networks`

Happy automating! ✅
