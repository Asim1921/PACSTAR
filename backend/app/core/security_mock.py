"""
Mock security functions for testing without full authentication
"""
from typing import Optional
from app.schemas.user import UserResponse

# Mock user for testing
MOCK_MASTER_USER = UserResponse(
    id="mock-master-001",
    username="master_admin",
    email="admin@pacstar.com",
    role="Master",
    is_active=True,
    zone="global"
)

def get_current_user_mock() -> UserResponse:
    """Mock function to return a master user for testing"""
    return MOCK_MASTER_USER
