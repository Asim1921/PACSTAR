#!/bin/bash
# ============================================================================
# PACSTAR EventService API - cURL Test Script
# ============================================================================
# Tests all EventService endpoints using cURL
#
# Usage:
#   chmod +x test_event_api_curl.sh
#   ./test_event_api_curl.sh [BASE_URL]
#
# Example:
#   ./test_event_api_curl.sh http://localhost:8001
# ============================================================================

# Configuration
BASE_URL="${1:-http://localhost:8001}"
API_URL="${BASE_URL}/api/v1"

# Credentials - Use the hardcoded master password from auth_service.py
USERNAME="master_test"
PASSWORD="SuperSecureP@ssw0rd"
EMAIL="master_test@gmail.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Variables to store IDs
TOKEN=""
EVENT_ID=""
CHALLENGE_ID=""

# Counters
PASSED=0
FAILED=0

# ============================================================================
# Helper Functions
# ============================================================================

log_header() {
    echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

log_test() {
    if [ "$2" == "PASS" ]; then
        echo -e "${GREEN}✅ PASS:${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL:${NC} $1 - $3"
        ((FAILED++))
    fi
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================================================
# Test Functions
# ============================================================================

test_health() {
    log_header "🏥 Testing Health Check"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Health check" "PASS"
        echo "    Response: $BODY"
    else
        log_test "Health check" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_login() {
    log_header "🔐 Testing Login"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$TOKEN" ]; then
            log_test "Login" "PASS"
            log_info "Token obtained (first 20 chars): ${TOKEN:0:20}..."
        else
            log_test "Login" "FAIL" "No token in response"
        fi
    else
        log_test "Login" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_create_challenge() {
    log_header "🎯 Creating Test Challenge"
    
    TIMESTAMP=$(date +%s)
    CHALLENGE_DATA=$(cat <<EOF
{
    "name": "Test Challenge ${TIMESTAMP}",
    "description": "A test challenge for event testing purposes",
    "config": {
        "challenge_type": "web",
        "image": "nginx:latest",
        "ports": [80],
        "environment_vars": {},
        "resources": {},
        "flag_format": "FLAG{test}"
    },
    "flag": "FLAG{test_flag_12345}",
    "points": 100,
    "total_teams": 10,
    "is_active": true,
    "challenge_category": "static"
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/challenges/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "${CHALLENGE_DATA}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "201" ]; then
        CHALLENGE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "Create challenge" "PASS"
        log_info "Challenge ID: $CHALLENGE_ID"
    else
        log_test "Create challenge" "FAIL" "HTTP $HTTP_CODE - $BODY"
    fi
}

test_get_available_challenges() {
    log_header "📋 Testing Get Available Challenges"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/available-challenges" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l)
        log_test "Get available challenges" "PASS"
        log_info "Found $COUNT challenges"
    else
        log_test "Get available challenges" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_create_event() {
    log_header "🎪 Testing Create Event"
    
    TIMESTAMP=$(date +%s)
    START_TIME=$(date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%S")
    END_TIME=$(date -u -d "+5 hours" +"%Y-%m-%dT%H:%M:%S")
    
    EVENT_DATA=$(cat <<EOF
{
    "name": "Test CTF Event ${TIMESTAMP}",
    "description": "A comprehensive test CTF event for testing the EventService API endpoints",
    "event_type": "ctf",
    "participation_type": "user_based",
    "zone": "master_zone",
    "start_time": "${START_TIME}",
    "end_time": "${END_TIME}",
    "max_participants": 100,
    "is_public": true,
    "challenges": [
        {
            "challenge_id": "${CHALLENGE_ID}",
            "visibility": "visible",
            "points_override": 150,
            "order": 1,
            "hints": [
                {"content": "Hint 1 - Alert", "hint_type": "alert", "cost": 10, "order": 1},
                {"content": "Hint 2 - Toast", "hint_type": "toast", "cost": 20, "order": 2}
            ],
            "max_attempts": 10
        }
    ]
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "${EVENT_DATA}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "201" ]; then
        EVENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "Create event" "PASS"
        log_info "Event ID: $EVENT_ID"
        log_info "Status: $STATUS"
    else
        log_test "Create event" "FAIL" "HTTP $HTTP_CODE - $BODY"
    fi
}

test_list_events() {
    log_header "📜 Testing List Events"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
        log_test "List events" "PASS"
        log_info "Total events: $TOTAL"
    else
        log_test "List events" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_get_event() {
    log_header "🔍 Testing Get Event"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/${EVENT_ID}" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Get event" "PASS"
    else
        log_test "Get event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_approve_event() {
    log_header "✅ Testing Approve Event"
    
    # Submit for approval first
    curl -s -X POST "${API_URL}/events/${EVENT_ID}/submit-for-approval" \
        -H "Authorization: Bearer ${TOKEN}" > /dev/null
    
    # Approve
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/approve" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"approved": true, "comments": "Approved for testing"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "Approve event" "PASS"
        log_info "New status: $STATUS"
    else
        log_test "Approve event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_start_event() {
    log_header "▶️  Testing Start Event"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/start" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "Start event" "PASS"
        log_info "Status: $STATUS"
    else
        log_test "Start event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_register_for_event() {
    log_header "📝 Testing Event Registration"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/register" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "400" ]; then
        log_test "Register for event" "PASS"
    else
        log_test "Register for event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_submit_flag() {
    log_header "🚩 Testing Flag Submission"
    
    # Wrong flag
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_URL}/events/${EVENT_ID}/challenges/${CHALLENGE_ID}/submit" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"flag": "WRONG_FLAG"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" == "incorrect" ]; then
            log_test "Submit wrong flag" "PASS"
        else
            log_test "Submit wrong flag" "FAIL" "Expected 'incorrect', got '$STATUS'"
        fi
    else
        log_test "Submit wrong flag" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Correct flag
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_URL}/events/${EVENT_ID}/challenges/${CHALLENGE_ID}/submit" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"flag": "FLAG{test_flag_12345}"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        POINTS=$(echo "$BODY" | grep -o '"points_awarded":[0-9]*' | cut -d':' -f2)
        log_test "Submit correct flag" "PASS"
        log_info "Status: $STATUS, Points: $POINTS"
    else
        log_test "Submit correct flag" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_get_stats() {
    log_header "📊 Testing Statistics"
    
    # Live stats
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/${EVENT_ID}/stats" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Get live stats" "PASS"
    else
        log_test "Get live stats" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Scoreboard
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/${EVENT_ID}/scoreboard" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Get scoreboard" "PASS"
    else
        log_test "Get scoreboard" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # My stats
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/events/${EVENT_ID}/my-stats" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Get my stats" "PASS"
    else
        log_test "Get my stats" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_pause_resume() {
    log_header "⏸️  Testing Pause/Resume"
    
    # Pause
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/pause" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"paused": true, "reason": "Testing pause"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Pause event" "PASS"
    else
        log_test "Pause event" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Resume
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/pause" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"paused": false, "reason": "Testing resume"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "Resume event" "PASS"
    else
        log_test "Resume event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_end_event() {
    log_header "🏁 Testing End Event"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/events/${EVENT_ID}/end" \
        -H "Authorization: Bearer ${TOKEN}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "End event" "PASS"
        log_info "Final status: $STATUS"
    else
        log_test "End event" "FAIL" "HTTP $HTTP_CODE"
    fi
}

# ============================================================================
# Main
# ============================================================================

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     PACSTAR EventService API - Comprehensive Test Suite      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Target: ${BASE_URL}"
echo "Time: $(date)"
echo ""

# Run tests
test_health
test_login

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Cannot proceed without authentication token!${NC}"
    exit 1
fi

test_create_challenge
test_get_available_challenges
test_create_event

if [ -z "$EVENT_ID" ]; then
    echo -e "${RED}Cannot proceed without event ID!${NC}"
    exit 1
fi

test_list_events
test_get_event
test_approve_event
test_start_event
test_register_for_event
test_submit_flag
test_get_stats
test_pause_resume
test_end_event

# Summary
log_header "📊 TEST SUMMARY"
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "📝 Total: ${TOTAL}"

if [ "$FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}⚠️  ${FAILED} TESTS FAILED${NC}"
    exit 1
fi

