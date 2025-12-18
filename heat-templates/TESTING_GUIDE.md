# Heat Template Testing Guide

## ✅ Status: Ready to Test

Your OpenStack Heat template API is working! A test deployment was successfully created.

## 🎯 Quick Test Results

**API Test**: ✅ PASSED
- Stack Name: `pacstar-test-stack`
- Stack ID: `03a2f03a-f3c0-4e2b-895a-2d16501794f0`
- Template: simple-server.yaml
- Status: Successfully deployed

## 🚀 How to Test via UI

### Step 1: Access the UI
Open your browser and go to: **http://localhost:8501** (or your server IP:8501)

### Step 2: Login
- **Username**: `master`
- **Password**: `SuperSecureP@ssw0rd`

### Step 3: Navigate to OpenStack Dashboard
- Click on the **OpenStack** menu in the sidebar
- The OpenStack Automation dashboard will open

### Step 4: Test OpenStack Connectivity
- Click the **🔌 Test OpenStack Connectivity** button
- You should see:
  - Environment summary with instances, vCPUs, RAM
  - Hypervisor information
  - Network list (private, team1, public)

### Step 5: Deploy a Heat Template

1. Scroll down to **🔥 OpenStack Heat Templates** section
2. Expand the **Deploy Heat Template** expander
3. Enter a stack name: `my-first-heat-stack`
4. Choose template source:
   - **Option A - Upload File**: Upload one of the YAML files from `/root/pacstar/heat-templates/`
   - **Option B - Paste YAML**: Copy content from a template file and paste it
   - **Option C - URL**: Provide a URL to a hosted template

5. (Optional) Customize parameters as JSON:
   ```json
   {
     "server_name": "my-custom-server",
     "image": "Ubuntu-22.04-slim",
     "flavor": "m1.small",
     "network": "private"
   }
   ```

6. Set timeout (e.g., 60 minutes)
7. Enable/disable **Rollback on failure**
8. Click **🔥 Deploy Heat Template**
9. Check the result - you should see stack details with stack_id

### Step 6: Verify in OpenStack Horizon
- Login to your OpenStack Horizon dashboard
- Navigate to **Orchestration > Stacks**
- You should see your deployed stack with resources

## 📝 Sample Templates Available

### 1. simple-server.yaml
- Deploys a single Ubuntu server
- Good for basic testing
- Minimal parameters

### 2. multi-server.yaml
- Deploys multiple servers using ResourceGroup
- Great for CTF team environments
- Configurable server count (1-5)

### 3. full-ctf-environment.yaml
- Complete CTF environment
- Creates network, router, and multiple servers
- Includes both Ubuntu and Windows servers
- Best for full team deployment

## 🧪 Test Scenarios

### Test 1: Simple Server Deployment
**Template**: simple-server.yaml
**Parameters**:
```json
{
  "server_name": "test-ubuntu-server",
  "image": "Ubuntu-22.04-slim",
  "flavor": "m1.small",
  "network": "private"
}
```
**Expected**: Single Ubuntu server deployed on private network

### Test 2: Multi-Server Deployment
**Template**: multi-server.yaml
**Parameters**:
```json
{
  "team_name": "alpha-team",
  "image": "Ubuntu-22.04-slim",
  "flavor": "m1.small",
  "network": "team1",
  "server_count": 3
}
```
**Expected**: 3 servers named alpha-team-server-0, alpha-team-server-1, alpha-team-server-2

### Test 3: Full CTF Environment
**Template**: full-ctf-environment.yaml
**Parameters**:
```json
{
  "team_name": "red-team",
  "web_server_image": "Ubuntu-22.04-slim",
  "windows_image": "Windows 10",
  "flavor": "m1.small",
  "external_network": "public"
}
```
**Expected**: Complete environment with network, router, Ubuntu server, and Windows server

## 🔍 Monitoring Stack Deployment

### Via UI
1. After deploying, note the `stack_id` from the response
2. In OpenStack dashboard, check the **Instances** tab
3. Refresh to see servers being created

### Via API (cURL)
```bash
# Get your auth token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "master", "password": "SuperSecureP@ssw0rd"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Check instances
curl -s -X GET "http://localhost:8000/api/v1/openstack/instances" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 🗑️ Cleanup After Testing

To delete a stack (via OpenStack Horizon):
1. Go to **Orchestration > Stacks**
2. Select your stack
3. Click **Delete Stack**
4. Confirm deletion

## 🐛 Troubleshooting

### Issue: Stack Creation Failed
**Solution**: Check the parameters, especially image and flavor names

### Issue: Network Not Found
**Solution**: Verify network exists in your environment:
- Available networks: private, team1, public

### Issue: Image Not Found
**Solution**: Use one of these valid images:
- `Ubuntu-22.04-slim`
- `Windows 10`
- `Ubuntu Server`

### Issue: Flavor Not Found
**Solution**: Check available flavors in your OpenStack environment
- Common flavors: m1.tiny, m1.small, m1.medium, m1.large

### Issue: Insufficient Quota
**Solution**: Check your OpenStack quotas for instances, cores, RAM

## 📊 Your OpenStack Environment

### Available Networks
| Network | ID | Available IPs | External |
|---------|----|--------------:|----------|
| private | 936daa93-... | 248 | No |
| team1 | 9b0dfb21-... | 250 | No |
| public | c197124b-... | 244 | Yes |

### Available Images
| Image | ID | Status |
|-------|----|----|
| Ubuntu-22.04-slim | 2fe5e80b-... | active |
| Windows 10 | c384ae6d-... | active |
| Ubuntu Server | 6b1593de-... | queued |
| Kali Linux snapshot | 9b2ba69b-... | active |

## 🎓 Next Steps

1. ✅ Test basic deployment with simple-server.yaml
2. ✅ Try multi-server deployment
3. ✅ Deploy full CTF environment
4. Create custom templates for specific CTF challenges
5. Integrate with PACSTAR team management
6. Automate deployment for all teams

## 📞 Support

If you encounter issues:
1. Check backend logs: `tail -f /var/log/pacstar-backend.log`
2. Check frontend logs: `tail -f /var/log/pacstar-frontend.log`
3. Verify OpenStack credentials in `/root/pacstar/backend/.env`
4. Ensure OpenStack API is accessible from the server

---

**Happy Testing!** 🎉

