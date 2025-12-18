#!/bin/bash

# PACSTAR API Testing Script
# This script tests all API endpoints automatically with token management

set -e  # Exit on any error

# Configuration
BASE_URL="http://192.168.250.178:8000"
API_PREFIX="/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")
            echo -e "${BLUE}ℹ️  INFO:${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ SUCCESS:${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}❌ ERROR:${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  WARNING:${NC} $message"
            ;;
    esac
}

# Function to make API calls and check response
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    local expected_status=$5
    local test_name=$6
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status "INFO" "Testing: $test_name"
    echo "  Method: $method"
    echo "  Endpoint: $endpoint"
    
    # Build curl command
    local curl_cmd="curl -s -w '%{http_code}' -X $method '$BASE_URL$endpoint'"
    
    if [ ! -z "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    # Execute curl command
    local response=$(eval $curl_cmd)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    echo "  Response Code: $http_code"
    
    # Check if response is valid JSON
    if echo "$body" | jq . >/dev/null 2>&1; then
        echo "  Response Body:"
        echo "$body" | jq . | sed 's/^/    /'
    else
        echo "  Response Body: $body"
    fi
    
    # Check expected status
    if [ "$http_code" = "$expected_status" ]; then
        print_status "SUCCESS" "$test_name passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_status "ERROR" "$test_name failed (expected $expected_status, got $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# Function to extract token from response
extract_token() {
    local response=$1
    echo "$response" | jq -r '.access_token // empty'
}

# Function to extract user ID from response
extract_user_id() {
    local response=$1
    echo "$response" | jq -r '.id // empty'
}

# Function to extract challenge ID from response
extract_challenge_id() {
    local response=$1
    echo "$response" | jq -r '.id // empty'
}

echo "🚀 PACSTAR API Testing Script"
echo "=============================="
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check
print_status "INFO" "Starting API Tests..."
echo ""

api_call "GET" "/health" "" "" "200" "Health Check"

# Test 2: User Registration
print_status "INFO" "Testing User Registration..."
echo ""

# Register test users
USER_DATA='{"username": "testuser1", "email": "testuser1@example.com", "password": "Password123!", "zone": "zone1"}'
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/register" \
    -H "Content-Type: application/json" \
    -d "$USER_DATA")

api_call "POST" "$API_PREFIX/auth/register" "$USER_DATA" "-H 'Content-Type: application/json'" "201" "User Registration"

# Extract user ID
USER_ID=$(extract_user_id "$REGISTER_RESPONSE")
print_status "INFO" "Registered User ID: $USER_ID"

# Test 3: Admin Registration
ADMIN_DATA='{"username": "testadmin1", "email": "testadmin1@example.com", "password": "Password123!", "zone": "zone1"}'
api_call "POST" "$API_PREFIX/auth/register" "$ADMIN_DATA" "-H 'Content-Type: application/json'" "201" "Admin Registration"

# Test 4: Master Registration
MASTER_DATA='{"username": "testmaster1", "email": "testmaster1@example.com", "password": "Password123!", "zone": "global"}'
api_call "POST" "$API_PREFIX/auth/register" "$MASTER_DATA" "-H 'Content-Type: application/json'" "201" "Master Registration"

# Test 5: User Login
print_status "INFO" "Testing Authentication..."
echo ""

LOGIN_DATA='{"username": "testuser1", "password": "Password123!"}'
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_DATA")

api_call "POST" "$API_PREFIX/auth/login" "$LOGIN_DATA" "-H 'Content-Type: application/json'" "200" "User Login"

# Extract tokens
USER_TOKEN=$(extract_token "$LOGIN_RESPONSE")
print_status "INFO" "User Token: ${USER_TOKEN:0:50}..."

# Test 6: Admin Login
ADMIN_LOGIN_DATA='{"username": "testadmin1", "password": "Password123!"}'
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d "$ADMIN_LOGIN_DATA")

api_call "POST" "$API_PREFIX/auth/login" "$ADMIN_LOGIN_DATA" "-H 'Content-Type: application/json'" "200" "Admin Login"

ADMIN_TOKEN=$(extract_token "$ADMIN_LOGIN_RESPONSE")
print_status "INFO" "Admin Token: ${ADMIN_TOKEN:0:50}..."

# Test 7: Master Login
MASTER_LOGIN_DATA='{"username": "testmaster1", "password": "Password123!"}'
MASTER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d "$MASTER_LOGIN_DATA")

api_call "POST" "$API_PREFIX/auth/login" "$MASTER_LOGIN_DATA" "-H 'Content-Type: application/json'" "200" "Master Login"

MASTER_TOKEN=$(extract_token "$MASTER_LOGIN_RESPONSE")
print_status "INFO" "Master Token: ${MASTER_TOKEN:0:50}..."

# Test 8: Get Current User (/auth/me)
print_status "INFO" "Testing User Profile Endpoints..."
echo ""

api_call "GET" "$API_PREFIX/auth/me" "" "-H 'Authorization: Bearer $USER_TOKEN'" "200" "Get Current User Profile (/auth/me)"

# Test 9: Get Current User (/users/me)
api_call "GET" "$API_PREFIX/users/me" "" "-H 'Authorization: Bearer $USER_TOKEN'" "200" "Get Current User Profile (/users/me)"

# Test 10: List Users (Admin only)
api_call "GET" "$API_PREFIX/users/" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "List Users (Admin)"

# Test 11: Get Specific User
api_call "GET" "$API_PREFIX/users/$USER_ID" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Get Specific User"

# Test 12: Create Challenge
print_status "INFO" "Testing Challenge Management..."
echo ""

CHALLENGE_DATA='{
    "name": "Test JWT Challenge",
    "description": "A test JWT challenge for API testing",
    "category": "Web Security",
    "difficulty": "Medium",
    "points": 100,
    "docker_image": "jwt-challenge:latest",
    "ports": [5000],
    "environment_variables": {
        "FLASK_ENV": "production",
        "SECRET_KEY": "test-secret-key"
    },
    "flag": "PACSTAR{test_flag_123}",
    "hint": "Look for JWT vulnerabilities"
}'

CHALLENGE_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/challenges" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "$CHALLENGE_DATA")

api_call "POST" "$API_PREFIX/challenges" "$CHALLENGE_DATA" "-H 'Content-Type: application/json' -H 'Authorization: Bearer $ADMIN_TOKEN'" "201" "Create Challenge"

# Extract challenge ID
CHALLENGE_ID=$(extract_challenge_id "$CHALLENGE_RESPONSE")
print_status "INFO" "Created Challenge ID: $CHALLENGE_ID"

# Test 13: List Challenges
api_call "GET" "$API_PREFIX/challenges" "" "-H 'Authorization: Bearer $USER_TOKEN'" "200" "List Challenges"

# Test 14: Get Specific Challenge
api_call "GET" "$API_PREFIX/challenges/$CHALLENGE_ID" "" "-H 'Authorization: Bearer $USER_TOKEN'" "200" "Get Specific Challenge"

# Test 15: Deploy Challenge
print_status "INFO" "Testing Challenge Deployment..."
echo ""

DEPLOY_DATA='{"force_redeploy": false}'
api_call "POST" "$API_PREFIX/challenges/$CHALLENGE_ID/deploy" "$DEPLOY_DATA" "-H 'Content-Type: application/json' -H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Deploy Challenge"

# Wait a bit for deployment
print_status "INFO" "Waiting for challenge deployment..."
sleep 10

# Test 16: Get Challenge Stats
api_call "GET" "$API_PREFIX/challenges/$CHALLENGE_ID/stats" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Get Challenge Stats"

# Test 17: Get Team Access Info
api_call "GET" "$API_PREFIX/challenges/$CHALLENGE_ID/access" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Get Team Access Info"

# Test 18: Update Challenge
UPDATE_DATA='{
    "name": "Updated JWT Challenge",
    "description": "An updated JWT challenge",
    "difficulty": "Hard",
    "points": 150
}'

api_call "PUT" "$API_PREFIX/challenges/$CHALLENGE_ID" "$UPDATE_DATA" "-H 'Content-Type: application/json' -H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Update Challenge"

# Test 19: Stop Challenge
api_call "POST" "$API_PREFIX/challenges/$CHALLENGE_ID/stop" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "200" "Stop Challenge"

# Test 20: Delete Challenge
api_call "DELETE" "$API_PREFIX/challenges/$CHALLENGE_ID" "" "-H 'Authorization: Bearer $ADMIN_TOKEN'" "204" "Delete Challenge"

# Test 21: Role Management (Master only)
print_status "INFO" "Testing Role Management..."
echo ""

ROLE_DATA='{
    "name": "Test Role",
    "permissions": ["read", "write"]
}'

api_call "POST" "$API_PREFIX/roles" "$ROLE_DATA" "-H 'Content-Type: application/json' -H 'Authorization: Bearer $MASTER_TOKEN'" "201" "Create Role"

# Test 22: List Roles
api_call "GET" "$API_PREFIX/roles" "" "-H 'Authorization: Bearer $MASTER_TOKEN'" "200" "List Roles"

# Test 23: Test Unauthorized Access
print_status "INFO" "Testing Security (Unauthorized Access)..."
echo ""

api_call "GET" "$API_PREFIX/users/" "" "" "401" "Unauthorized Access to Users List"

api_call "POST" "$API_PREFIX/challenges" "$CHALLENGE_DATA" "-H 'Content-Type: application/json'" "401" "Unauthorized Challenge Creation"

# Test 24: Test Invalid Token
api_call "GET" "$API_PREFIX/users/me" "" "-H 'Authorization: Bearer invalid_token'" "401" "Invalid Token Access"

# Test 25: Test API Documentation Access
print_status "INFO" "Testing API Documentation Access..."
echo ""

api_call "GET" "$API_PREFIX/docs" "" "" "200" "API Documentation Access"

api_call "GET" "$API_PREFIX/openapi.json" "" "" "200" "OpenAPI Schema Access"

# Test 26: Test Refresh Token
print_status "INFO" "Testing Token Refresh..."
echo ""

REFRESH_DATA='{"refresh_token": "'$(echo "$LOGIN_RESPONSE" | jq -r '.refresh_token')'"}'
api_call "POST" "$API_PREFIX/auth/refresh" "$REFRESH_DATA" "-H 'Content-Type: application/json'" "200" "Refresh Token"

# Test 27: Test Logout
LOGOUT_DATA='{"refresh_token": "'$(echo "$LOGIN_RESPONSE" | jq -r '.refresh_token')'"}'
api_call "POST" "$API_PREFIX/auth/logout" "$LOGOUT_DATA" "-H 'Content-Type: application/json'" "200" "Logout"

# Test 28: Test Password Validation
print_status "INFO" "Testing Password Validation..."
echo ""

WEAK_PASSWORD_DATA='{"username": "weakuser", "email": "weak@example.com", "password": "123", "zone": "zone1"}'
api_call "POST" "$API_PREFIX/auth/register" "$WEAK_PASSWORD_DATA" "-H 'Content-Type: application/json'" "400" "Weak Password Validation"

# Test 29: Test Email Validation
INVALID_EMAIL_DATA='{"username": "invalidemail", "email": "invalid-email", "password": "Password123!", "zone": "zone1"}'
api_call "POST" "$API_PREFIX/auth/register" "$INVALID_EMAIL_DATA" "-H 'Content-Type: application/json'" "422" "Invalid Email Validation"

# Test 30: Test Zone Validation
INVALID_ZONE_DATA='{"username": "invalidzone", "email": "zone@example.com", "password": "Password123!", "zone": "x"}'
api_call "POST" "$API_PREFIX/auth/register" "$INVALID_ZONE_DATA" "-H 'Content-Type: application/json'" "422" "Invalid Zone Validation"

# Final Results
echo ""
echo "🏁 Test Results Summary"
echo "======================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    print_status "SUCCESS" "All tests passed! 🎉"
    exit 0
else
    print_status "ERROR" "Some tests failed. Please check the output above."
    exit 1
fi
