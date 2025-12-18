# OpenStack Heat Templates for PACSTAR CTF Platform

This directory contains sample Heat templates for testing OpenStack Heat API integration.

## Available Templates

### 1. simple-server.yaml
**Description**: Deploy a single Ubuntu server
**Use Case**: Basic server deployment test
**Parameters**:
- `server_name`: Name of the server (default: test-heat-server)
- `image`: Image to use (default: Ubuntu-22.04-slim)
- `flavor`: Flavor to use (default: m1.small)
- `network`: Network to attach to (default: private)

**Example Parameters**:
```json
{
  "server_name": "my-test-server",
  "image": "Ubuntu-22.04-slim",
  "flavor": "m1.small",
  "network": "private"
}
```

### 2. multi-server.yaml
**Description**: Deploy multiple servers using ResourceGroup
**Use Case**: Deploy multiple identical challenge servers
**Parameters**:
- `team_name`: Name of the team (default: team1)
- `image`: Image to use (default: Ubuntu-22.04-slim)
- `flavor`: Flavor to use (default: m1.small)
- `network`: Network to attach to (default: private)
- `server_count`: Number of servers to create (default: 2, max: 5)

**Example Parameters**:
```json
{
  "team_name": "alpha",
  "image": "Ubuntu-22.04-slim",
  "flavor": "m1.small",
  "network": "team1",
  "server_count": 3
}
```

### 3. full-ctf-environment.yaml
**Description**: Complete CTF environment with network, router, and multiple challenge servers
**Use Case**: Full team environment with isolated network
**Parameters**:
- `team_name`: Name of the team (default: pacstar-team)
- `web_server_image`: Image for web challenge (default: Ubuntu-22.04-slim)
- `windows_image`: Image for Windows challenge (default: Windows 10)
- `flavor`: Flavor to use (default: m1.small)
- `external_network`: External network for router (default: public)

**Example Parameters**:
```json
{
  "team_name": "red-team",
  "web_server_image": "Ubuntu-22.04-slim",
  "windows_image": "Windows 10",
  "flavor": "m1.small",
  "external_network": "public"
}
```

## Testing via PACSTAR UI

1. **Login as Master user**
   - Username: `master`
   - Password: `SuperSecureP@ssw0rd`

2. **Navigate to OpenStack Dashboard**
   - Go to the OpenStack tab in the sidebar

3. **Deploy Heat Template**
   - Scroll to "OpenStack Heat Templates" section
   - Expand "Deploy Heat Template"
   - Choose template source:
     - Upload HOT file: Select one of the YAML files
     - Paste HOT YAML: Copy and paste template content
   - Enter stack name (e.g., `test-stack-1`)
   - Enter parameters as JSON (optional)
   - Set timeout (default: 60 minutes)
   - Enable/disable rollback on failure
   - Click "Deploy Heat Template"

4. **Monitor Stack Creation**
   - Check OpenStack Horizon dashboard for stack status
   - Or use OpenStack CLI:
     ```bash
     openstack stack list
     openstack stack show <stack-name>
     ```

## Testing via API/cURL

```bash
# Get authentication token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "master", "password": "SuperSecureP@ssw0rd"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Deploy simple server template
curl -s -X POST "http://localhost:8000/api/v1/openstack/heat/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stack_name": "test-simple-server",
    "template_body": "'$(cat simple-server.yaml | sed 's/"/\\"/g' | tr '\n' ' ')'",
    "parameters": {
      "server_name": "my-heat-server",
      "image": "Ubuntu-22.04-slim",
      "flavor": "m1.small",
      "network": "private"
    },
    "timeout_minutes": 30,
    "rollback_on_failure": true
  }' | python3 -m json.tool
```

## Available Resources in Your OpenStack Environment

**Networks**:
- `private` (936daa93-08f3-47df-bf90-7bf2ac923f44) - 248 IPs available
- `team1` (9b0dfb21-2ea4-4581-ba67-8d27c735416e) - 250 IPs available
- `public` (c197124b-984b-4f9f-b08d-f99d64af43f6) - 244 IPs available (external)

**Images**:
- `Ubuntu-22.04-slim` (2fe5e80b-53b0-4b41-ba92-6f66488a5051)
- `Windows 10` (c384ae6d-5718-452f-b101-b2dea62a53c6)
- `Ubuntu Server` (6b1593de-3fb8-4772-a183-a67b9cd9b553)
- `live-snap-202505120553` (9b2ba69b-2ad3-4a99-a1e1-f04046c679ab) - Kali Linux

## Cleanup

To delete a stack after testing:

```bash
openstack stack delete <stack-name>
# or
openstack stack delete <stack-id>
```

## Troubleshooting

1. **Stack Creation Failed**: Check the stack events for details
   ```bash
   openstack stack event list <stack-name>
   ```

2. **Image Not Found**: Verify the image name/ID matches your environment
   ```bash
   openstack image list
   ```

3. **Network Not Found**: Verify the network name/ID exists
   ```bash
   openstack network list
   ```

4. **Flavor Not Found**: Check available flavors
   ```bash
   openstack flavor list
   ```

## Notes

- All templates use Heat Template Version 2016-10-14 (Liberty)
- Templates are designed to be simple and easy to test
- Modify parameters as needed for your environment
- For production use, add security groups and key pairs

