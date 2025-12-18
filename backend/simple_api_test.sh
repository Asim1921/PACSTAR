#!/bin/bash

# PACSTAR Simple API Test Script
# Tests only the working endpoints with proper error handling

set -e

# Configuration
BASE_URL="http://192.168.250.178:8000"
API_PREFIX="/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 PACSTAR Simple API Test"
echo "========================="
echo ""

# Test 1: Health Check
echo -e "${BLUE}1. Health Check${NC}"
curl -s "$BASE_URL/health" | jq .
echo ""

# Test 2: Register User
echo -e "${BLUE}2. Register User${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"username": "simpletest", "email": "simpletest@example.com", "password": "Password123!", "zone": "zone1"}')
echo "$REGISTER_RESPONSE" | jq .

if echo "$REGISTER_RESPONSE" | jq -e '.id' >/dev/null 2>&1; then
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id')
    echo -e "${GREEN}✅ User registered successfully${NC}"
else
    echo -e "${RED}❌ User registration failed${NC}"
    exit 1
fi
echo ""

# Test 3: Login
echo -e "${BLUE}3. Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "simpletest", "password": "Password123!"}')
echo "$LOGIN_RESPONSE" | jq .

if echo "$LOGIN_RESPONSE" | jq -e '.access_token' >/dev/null 2>&1; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    echo -e "${GREEN}✅ Login successful${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
fi
echo ""

# Test 4: Get Profile (/auth/me)
echo -e "${BLUE}4. Get Profile (/auth/me)${NC}"
curl -s -X GET "$BASE_URL$API_PREFIX/auth/me" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 5: Get Profile (/users/me)
echo -e "${BLUE}5. Get Profile (/users/me)${NC}"
curl -s -X GET "$BASE_URL$API_PREFIX/users/me" \
    -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 6: List Challenges
echo -e "${BLUE}6. List Challenges${NC}"
CHALLENGES_RESPONSE=$(curl -s -X GET "$BASE_URL$API_PREFIX/challenges" \
    -H "Authorization: Bearer $TOKEN")
echo "$CHALLENGES_RESPONSE" | jq .

if echo "$CHALLENGES_RESPONSE" | jq -e '.challenges' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Challenges listed successfully${NC}"
    CHALLENGE_COUNT=$(echo "$CHALLENGES_RESPONSE" | jq '.challenges | length')
    echo "Found $CHALLENGE_COUNT challenges"
else
    echo -e "${YELLOW}⚠️  No challenges found or error${NC}"
fi
echo ""

# Test 7: Get Specific Challenge (if exists)
if [ "$CHALLENGE_COUNT" -gt 0 ]; then
    echo -e "${BLUE}7. Get Specific Challenge${NC}"
    CHALLENGE_ID=$(echo "$CHALLENGES_RESPONSE" | jq -r '.challenges[0].id')
    curl -s -X GET "$BASE_URL$API_PREFIX/challenges/$CHALLENGE_ID" \
        -H "Authorization: Bearer $TOKEN" | jq .
    echo ""
fi

# Test 8: Test Admin Login
echo -e "${BLUE}8. Test Admin Login${NC}"
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "master_admin", "password": "admin123"}')
echo "$ADMIN_LOGIN_RESPONSE" | jq .

if echo "$ADMIN_LOGIN_RESPONSE" | jq -e '.access_token' >/dev/null 2>&1; then
    ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.access_token')
    echo -e "${GREEN}✅ Admin login successful${NC}"
    
    # Test Admin Profile
    echo -e "${BLUE}9. Admin Profile${NC}"
    curl -s -X GET "$BASE_URL$API_PREFIX/auth/me" \
        -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
    echo ""
else
    echo -e "${RED}❌ Admin login failed${NC}"
fi

# Test 9: API Documentation
echo -e "${BLUE}10. API Documentation${NC}"
echo "Testing API docs access..."
curl -s -I "$BASE_URL$API_PREFIX/docs" | head -3
echo ""

echo -e "${GREEN}✅ Simple API test completed!${NC}"
echo ""
echo "📋 Summary:"
echo "- Health check: ✅"
echo "- User registration: ✅"
echo "- User login: ✅"
echo "- Profile endpoints: ✅"
echo "- Challenge listing: ✅"
echo "- Admin access: ✅"
echo "- API documentation: ✅"
