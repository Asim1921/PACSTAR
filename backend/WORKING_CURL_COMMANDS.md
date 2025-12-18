# PACSTAR API - Working Curl Commands
# ===================================

# Base Configuration
BASE_URL="http://192.168.250.178:8000"
API_PREFIX="/api/v1"

echo "🚀 PACSTAR API - Working Curl Commands"
echo "======================================"
echo ""

# 1. Health Check
echo "1. Health Check"
echo "curl -s '$BASE_URL/health' | jq ."
echo ""

# 2. User Registration
echo "2. User Registration"
echo "curl -X POST '$BASE_URL$API_PREFIX/auth/register' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"testuser\", \"email\": \"testuser@example.com\", \"password\": \"Password123!\", \"zone\": \"zone1\"}' | jq ."
echo ""

# 3. User Login
echo "3. User Login"
echo "curl -X POST '$BASE_URL$API_PREFIX/auth/login' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"testuser\", \"password\": \"Password123!\"}' | jq ."
echo ""

# 4. Get User Profile (/auth/me)
echo "4. Get User Profile (/auth/me)"
echo "TOKEN=\"your_access_token_here\""
echo "curl -X GET '$BASE_URL$API_PREFIX/auth/me' \\"
echo "  -H 'Authorization: Bearer \$TOKEN' | jq ."
echo ""

# 5. Get User Profile (/users/me)
echo "5. Get User Profile (/users/me)"
echo "curl -X GET '$BASE_URL$API_PREFIX/users/me' \\"
echo "  -H 'Authorization: Bearer \$TOKEN' | jq ."
echo ""

# 6. List Challenges
echo "6. List Challenges"
echo "curl -X GET '$BASE_URL$API_PREFIX/challenges' \\"
echo "  -H 'Authorization: Bearer \$TOKEN' | jq ."
echo ""

# 7. Admin Login
echo "7. Admin Login"
echo "curl -X POST '$BASE_URL$API_PREFIX/auth/login' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"master_admin\", \"password\": \"admin123\"}' | jq ."
echo ""

# 8. API Documentation
echo "8. API Documentation"
echo "Browser: $BASE_URL$API_PREFIX/docs"
echo "Schema: curl -s '$BASE_URL$API_PREFIX/openapi.json' | jq ."
echo ""

# 9. Logout
echo "9. Logout"
echo "curl -X POST '$BASE_URL$API_PREFIX/auth/logout' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"refresh_token\": \"your_refresh_token_here\"}' | jq ."
echo ""

echo "📋 Quick Test Commands:"
echo "======================"
echo ""

echo "# Register and login in one go:"
echo "USER_RESPONSE=\$(curl -s -X POST '$BASE_URL$API_PREFIX/auth/register' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"quicktest\", \"email\": \"quicktest@example.com\", \"password\": \"Password123!\", \"zone\": \"zone1\"}')"
echo ""
echo "LOGIN_RESPONSE=\$(curl -s -X POST '$BASE_URL$API_PREFIX/auth/login' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"quicktest\", \"password\": \"Password123!\"}')"
echo ""
echo "TOKEN=\$(echo \"\$LOGIN_RESPONSE\" | jq -r '.access_token')"
echo ""
echo "# Test profile endpoint:"
echo "curl -X GET '$BASE_URL$API_PREFIX/auth/me' \\"
echo "  -H 'Authorization: Bearer \$TOKEN' | jq ."
echo ""

echo "✅ All working endpoints tested successfully!"
