#!/bin/bash

# PACSTAR Quick API Test Script
# Tests essential APIs quickly

set -e

# Configuration
BASE_URL="http://192.168.250.178:8000"
API_PREFIX="/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 PACSTAR Quick API Test"
echo "========================"

# Test 1: Health Check
echo -e "${BLUE}1. Testing Health Check...${NC}"
curl -s "$BASE_URL/health" | jq .
echo ""

# Test 2: Register User
echo -e "${BLUE}2. Registering Test User...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"username": "quicktest", "email": "quicktest@example.com", "password": "Password123!", "zone": "zone1"}')
echo "$REGISTER_RESPONSE" | jq .
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id')
echo ""

# Test 3: Login
echo -e "${BLUE}3. Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "quicktest", "password": "Password123!"}')
echo "$LOGIN_RESPONSE" | jq .
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
echo ""

# Test 4: Get Profile
echo -e "${BLUE}4. Getting User Profile...${NC}"
curl -s -X GET "$BASE_URL$API_PREFIX/auth/me" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 5: List Challenges
echo -e "${BLUE}5. Listing Challenges...${NC}"
curl -s -X GET "$BASE_URL$API_PREFIX/challenges" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 6: Create Challenge
echo -e "${BLUE}6. Creating Challenge...${NC}"
CHALLENGE_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/challenges" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Quick Test Challenge",
        "description": "A quick test challenge",
        "category": "Web Security",
        "difficulty": "Easy",
        "points": 50,
        "docker_image": "nginx:latest",
        "ports": [80],
        "flag": "PACSTAR{quick_test}",
        "hint": "This is a test"
    }')
echo "$CHALLENGE_RESPONSE" | jq .
CHALLENGE_ID=$(echo "$CHALLENGE_RESPONSE" | jq -r '.id')
echo ""

# Test 7: Deploy Challenge
echo -e "${BLUE}7. Deploying Challenge...${NC}"
curl -s -X POST "$BASE_URL$API_PREFIX/challenges/$CHALLENGE_ID/deploy" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"force_redeploy": false}' | jq .
echo ""

# Test 8: Get Challenge Stats
echo -e "${BLUE}8. Getting Challenge Stats...${NC}"
curl -s -X GET "$BASE_URL$API_PREFIX/challenges/$CHALLENGE_ID/stats" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 9: Stop Challenge
echo -e "${BLUE}9. Stopping Challenge...${NC}"
curl -s -X POST "$BASE_URL$API_PREFIX/challenges/$CHALLENGE_ID/stop" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 10: Delete Challenge
echo -e "${BLUE}10. Deleting Challenge...${NC}"
curl -s -X DELETE "$BASE_URL$API_PREFIX/challenges/$CHALLENGE_ID" \
    -H "Authorization: Bearer $TOKEN"
echo ""

echo -e "${GREEN}✅ Quick API test completed!${NC}"
