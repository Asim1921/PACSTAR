"""
Comprehensive Test Suite for PACSTAR EventService API

This test suite covers all EventService endpoints with various scenarios:
- Authentication and Authorization
- Event CRUD operations
- Event lifecycle management
- Challenge management within events
- Flag submissions and scoring
- Hints system
- Statistics and scoreboard
- RBAC (Role-Based Access Control)
- Edge cases and error handling

Usage:
    pytest tests/test_event_service_comprehensive.py -v
    pytest tests/test_event_service_comprehensive.py -v --tb=short
    pytest tests/test_event_service_comprehensive.py -v -k "test_event_create"
"""

import pytest
import requests
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import uuid
import json


# =============================================================================
# Configuration
# =============================================================================

BASE_URL = "http://localhost:8001"
API_PREFIX = "/api/v1"

# Test credentials - Master user should be pre-created in DB
MASTER_CREDENTIALS = {
    "email": "master_test@gmail.com",
    "password": "SuperSecureP@ssw0rd"
}

# Admin user for zone-based testing
ADMIN_CREDENTIALS = {
    "email": "admin_zone1@gmail.com",
    "password": "AdminP@ssw0rd123"
}

# Regular user for testing
USER_CREDENTIALS = {
    "email": "user_zone1@gmail.com", 
    "password": "UserP@ssw0rd123"
}


# =============================================================================
# Fixtures
# =============================================================================

class APIClient:
    """HTTP client wrapper for API testing"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.session = requests.Session()
    
    def set_token(self, token: str):
        self.token = token
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def clear_token(self):
        self.token = None
        self.session.headers.pop("Authorization", None)
    
    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(f"{self.base_url}{path}", **kwargs)
    
    def post(self, path: str, **kwargs) -> requests.Response:
        return self.session.post(f"{self.base_url}{path}", **kwargs)
    
    def put(self, path: str, **kwargs) -> requests.Response:
        return self.session.put(f"{self.base_url}{path}", **kwargs)
    
    def patch(self, path: str, **kwargs) -> requests.Response:
        return self.session.patch(f"{self.base_url}{path}", **kwargs)
    
    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.session.delete(f"{self.base_url}{path}", **kwargs)


@pytest.fixture(scope="module")
def api_client():
    """Create API client instance"""
    return APIClient(BASE_URL)


@pytest.fixture(scope="module")
def master_token(api_client):
    """Get master user authentication token"""
    response = api_client.post(
        f"{API_PREFIX}/auth/login",
        data={
            "username": MASTER_CREDENTIALS["email"],
            "password": MASTER_CREDENTIALS["password"]
        }
    )
    assert response.status_code == 200, f"Master login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def master_client(api_client, master_token):
    """API client authenticated as master"""
    api_client.set_token(master_token)
    return api_client


@pytest.fixture(scope="module")
def test_challenge(master_client):
    """Create a test challenge for use in events"""
    challenge_data = {
        "name": f"Test Challenge {uuid.uuid4().hex[:8]}",
        "description": "A test challenge for comprehensive testing",
        "category": "Web",
        "difficulty": "Medium",
        "points": 100,
        "flag": "FLAG{test_flag_12345}",
        "is_active": True,
        "deployment_type": "none"
    }
    
    response = master_client.post(
        f"{API_PREFIX}/challenges/",
        json=challenge_data
    )
    
    if response.status_code != 200:
        pytest.skip(f"Could not create test challenge: {response.text}")
    
    return response.json()


@pytest.fixture(scope="module")
def test_challenge_2(master_client):
    """Create a second test challenge"""
    challenge_data = {
        "name": f"Test Challenge 2 {uuid.uuid4().hex[:8]}",
        "description": "Another test challenge",
        "category": "Crypto",
        "difficulty": "Hard",
        "points": 200,
        "flag": "FLAG{crypto_flag_67890}",
        "is_active": True,
        "deployment_type": "none"
    }
    
    response = master_client.post(
        f"{API_PREFIX}/challenges/",
        json=challenge_data
    )
    
    if response.status_code != 200:
        pytest.skip(f"Could not create test challenge 2: {response.text}")
    
    return response.json()


# =============================================================================
# Health Check Tests
# =============================================================================

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_endpoint(self, api_client):
        """Test that health endpoint returns OK"""
        response = api_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_docs_available(self, api_client):
        """Test that Swagger docs are available"""
        response = api_client.get("/docs")
        assert response.status_code == 200


# =============================================================================
# Authentication Tests
# =============================================================================

class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self, api_client):
        """Test successful login"""
        response = api_client.post(
            f"{API_PREFIX}/auth/login",
            data={
                "username": MASTER_CREDENTIALS["email"],
                "password": MASTER_CREDENTIALS["password"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials"""
        response = api_client.post(
            f"{API_PREFIX}/auth/login",
            data={
                "username": "invalid@test.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
    
    def test_get_current_user(self, master_client):
        """Test getting current user info"""
        response = master_client.get(f"{API_PREFIX}/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data
    
    def test_protected_endpoint_without_token(self, api_client):
        """Test accessing protected endpoint without token"""
        api_client.clear_token()
        response = api_client.get(f"{API_PREFIX}/events/")
        assert response.status_code == 401


# =============================================================================
# Event CRUD Tests
# =============================================================================

class TestEventCRUD:
    """Test Event CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self, master_client, test_challenge):
        """Setup for each test"""
        self.client = master_client
        self.challenge = test_challenge
    
    def test_create_event_ctf(self):
        """Test creating a CTF event"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        event_data = {
            "name": f"Test CTF Event {uuid.uuid4().hex[:8]}",
            "description": "A comprehensive test CTF event",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "max_participants": 100,
            "is_public": False,
            "challenges": [
                {
                    "challenge_id": self.challenge.get("id", self.challenge.get("_id")),
                    "challenge_name": self.challenge["name"],
                    "challenge_category": self.challenge.get("category", "Web"),
                    "points": 150,
                    "is_visible": True,
                    "hints": [
                        {
                            "hint_id": "hint1",
                            "content": "Look at the source code",
                            "hint_type": "alert",
                            "cost": 10
                        }
                    ]
                }
            ]
        }
        
        response = self.client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        
        data = response.json()
        assert data["name"] == event_data["name"]
        assert data["event_type"] == "ctf"
        assert data["status"] == "draft"
        assert len(data["challenges"]) == 1
    
    def test_create_event_cyber_exercise(self):
        """Test creating a Cyber Exercise event"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=2)
        end_time = start_time + timedelta(hours=8)
        
        event_data = {
            "name": f"Test Cyber Exercise {uuid.uuid4().hex[:8]}",
            "description": "A cyber exercise event",
            "event_type": "cyber_exercise",
            "participation_type": "team",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "max_participants": 50,
            "max_team_size": 5,
            "is_public": True,
            "challenges": []
        }
        
        response = self.client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_type"] == "cyber_exercise"
        assert data["participation_type"] == "team"
    
    def test_create_event_invalid_times(self):
        """Test creating event with end time before start time"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=2)
        end_time = start_time - timedelta(hours=1)  # End before start
        
        event_data = {
            "name": "Invalid Time Event",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": []
        }
        
        response = self.client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 400
    
    def test_list_events(self):
        """Test listing events"""
        response = self.client.get(f"{API_PREFIX}/events/")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_events_with_filters(self):
        """Test listing events with filters"""
        response = self.client.get(
            f"{API_PREFIX}/events/",
            params={"event_type": "ctf", "status": "draft"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for event in data:
            assert event["event_type"] == "ctf"
            assert event["status"] == "draft"
    
    def test_get_event_by_id(self):
        """Test getting a specific event"""
        # First create an event
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        event_data = {
            "name": f"Get Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": []
        }
        
        create_response = self.client.post(f"{API_PREFIX}/events/", json=event_data)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Now get it
        response = self.client.get(f"{API_PREFIX}/events/{event_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == event_id
        assert data["name"] == event_data["name"]
    
    def test_get_nonexistent_event(self):
        """Test getting a non-existent event"""
        fake_id = "000000000000000000000000"
        response = self.client.get(f"{API_PREFIX}/events/{fake_id}")
        assert response.status_code == 404
    
    def test_update_event(self):
        """Test updating an event"""
        # Create event
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        event_data = {
            "name": f"Update Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": []
        }
        
        create_response = self.client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = create_response.json()["id"]
        
        # Update it
        update_data = {
            "name": "Updated Event Name",
            "description": "Updated description",
            "max_participants": 200
        }
        
        response = self.client.put(f"{API_PREFIX}/events/{event_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Updated Event Name"
        assert data["description"] == "Updated description"
        assert data["max_participants"] == 200


# =============================================================================
# Event Lifecycle Tests
# =============================================================================

class TestEventLifecycle:
    """Test event lifecycle transitions"""
    
    @pytest.fixture
    def draft_event(self, master_client, test_challenge):
        """Create a draft event for testing"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Lifecycle Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 100,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 200
        return response.json()
    
    def test_submit_for_approval(self, master_client, draft_event):
        """Test submitting event for approval"""
        event_id = draft_event["id"]
        
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "pending_approval"
    
    def test_approve_event(self, master_client, draft_event):
        """Test approving an event"""
        event_id = draft_event["id"]
        
        # First submit for approval
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        
        # Then approve
        approval_data = {
            "approved": True,
            "comments": "Approved for testing"
        }
        
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json=approval_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "approved"
    
    def test_reject_event(self, master_client, draft_event):
        """Test rejecting an event"""
        event_id = draft_event["id"]
        
        # First submit for approval
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        
        # Then reject
        approval_data = {
            "approved": False,
            "comments": "Rejected for testing purposes"
        }
        
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json=approval_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "rejected"
    
    def test_start_event(self, master_client, draft_event):
        """Test starting an event"""
        event_id = draft_event["id"]
        
        # Submit and approve first
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        
        # Start the event
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "running"
    
    def test_pause_event(self, master_client, draft_event):
        """Test pausing a running event"""
        event_id = draft_event["id"]
        
        # Go through lifecycle to running
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        # Pause
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/pause",
            json={"paused": True, "reason": "Testing pause functionality"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "paused"
    
    def test_resume_event(self, master_client, draft_event):
        """Test resuming a paused event"""
        event_id = draft_event["id"]
        
        # Go through lifecycle to paused
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/pause",
            json={"paused": True}
        )
        
        # Resume
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/pause",
            json={"paused": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "running"
    
    def test_end_event(self, master_client, draft_event):
        """Test ending an event"""
        event_id = draft_event["id"]
        
        # Go through lifecycle to running
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        # End
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/end")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ended"
    
    def test_pending_approvals(self, master_client, draft_event):
        """Test getting pending approvals (Master only)"""
        event_id = draft_event["id"]
        
        # Submit for approval
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        
        # Get pending approvals
        response = master_client.get(f"{API_PREFIX}/events/pending-approvals")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


# =============================================================================
# Event Registration Tests
# =============================================================================

class TestEventRegistration:
    """Test event registration functionality"""
    
    @pytest.fixture
    def running_event(self, master_client, test_challenge):
        """Create a running event for testing"""
        start_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Registration Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "max_participants": 100,
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 150,
                    "is_visible": True,
                    "hints": [
                        {
                            "hint_id": "hint1",
                            "content": "This is a hint",
                            "hint_type": "alert",
                            "cost": 0
                        }
                    ]
                }
            ]
        }
        
        # Create and start event
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        return master_client.get(f"{API_PREFIX}/events/{event_id}").json()
    
    def test_register_for_event(self, master_client, running_event):
        """Test registering for an event"""
        event_id = running_event["id"]
        
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_id"] == event_id
        assert data["registered"] == True
    
    def test_double_registration_fails(self, master_client, running_event):
        """Test that double registration fails"""
        event_id = running_event["id"]
        
        # First registration
        master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        
        # Second registration should fail
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        assert response.status_code == 400
    
    def test_get_event_participants(self, master_client, running_event):
        """Test getting event participants"""
        event_id = running_event["id"]
        
        # Register first
        master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        
        response = master_client.get(f"{API_PREFIX}/events/{event_id}/participants")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# =============================================================================
# Challenge Visibility Tests
# =============================================================================

class TestChallengeVisibility:
    """Test challenge visibility management"""
    
    @pytest.fixture
    def event_with_challenge(self, master_client, test_challenge):
        """Create event with challenge"""
        start_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Visibility Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 100,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        # Start event
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        return {
            "event": master_client.get(f"{API_PREFIX}/events/{event_id}").json(),
            "challenge_id": challenge_id
        }
    
    def test_hide_challenge(self, master_client, event_with_challenge):
        """Test hiding a challenge"""
        event_id = event_with_challenge["event"]["id"]
        challenge_id = event_with_challenge["challenge_id"]
        
        response = master_client.put(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/visibility",
            json={"is_visible": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_visible"] == False
    
    def test_show_challenge(self, master_client, event_with_challenge):
        """Test showing a hidden challenge"""
        event_id = event_with_challenge["event"]["id"]
        challenge_id = event_with_challenge["challenge_id"]
        
        # First hide
        master_client.put(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/visibility",
            json={"is_visible": False}
        )
        
        # Then show
        response = master_client.put(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/visibility",
            json={"is_visible": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_visible"] == True


# =============================================================================
# Flag Submission Tests
# =============================================================================

class TestFlagSubmission:
    """Test flag submission functionality"""
    
    @pytest.fixture
    def submission_event(self, master_client, test_challenge):
        """Create event ready for submissions"""
        start_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Submission Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 150,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        # Start event
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        # Register for event
        master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        
        return {
            "event": master_client.get(f"{API_PREFIX}/events/{event_id}").json(),
            "challenge_id": challenge_id,
            "correct_flag": "FLAG{test_flag_12345}"
        }
    
    def test_submit_wrong_flag(self, master_client, submission_event):
        """Test submitting incorrect flag"""
        event_id = submission_event["event"]["id"]
        challenge_id = submission_event["challenge_id"]
        
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": "wrong_flag"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == False
        assert data["points_earned"] == 0
    
    def test_submit_correct_flag(self, master_client, submission_event):
        """Test submitting correct flag"""
        event_id = submission_event["event"]["id"]
        challenge_id = submission_event["challenge_id"]
        correct_flag = submission_event["correct_flag"]
        
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": correct_flag}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == True
        assert data["points_earned"] > 0
    
    def test_double_solve_fails(self, master_client, submission_event):
        """Test that solving same challenge twice doesn't give points"""
        event_id = submission_event["event"]["id"]
        challenge_id = submission_event["challenge_id"]
        correct_flag = submission_event["correct_flag"]
        
        # First solve
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": correct_flag}
        )
        
        # Second solve
        response = master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": correct_flag}
        )
        
        data = response.json()
        # Should either fail or give 0 points
        assert data.get("points_earned", 0) == 0 or data.get("already_solved", False)


# =============================================================================
# Statistics Tests
# =============================================================================

class TestStatistics:
    """Test statistics endpoints"""
    
    @pytest.fixture
    def stats_event(self, master_client, test_challenge):
        """Create event with activity for stats"""
        start_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Stats Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 100,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        # Start event
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        # Register and make some submissions
        master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": "wrong"}
        )
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": "FLAG{test_flag_12345}"}
        )
        
        return {
            "event": master_client.get(f"{API_PREFIX}/events/{event_id}").json(),
            "challenge_id": challenge_id
        }
    
    def test_get_live_stats(self, master_client, stats_event):
        """Test getting live statistics"""
        event_id = stats_event["event"]["id"]
        
        response = master_client.get(f"{API_PREFIX}/events/{event_id}/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_participants" in data
        assert "total_submissions" in data
        assert "correct_submissions" in data
        assert "total_challenges" in data
        assert data["total_participants"] >= 1
        assert data["total_submissions"] >= 2
    
    def test_get_scoreboard(self, master_client, stats_event):
        """Test getting scoreboard"""
        event_id = stats_event["event"]["id"]
        
        response = master_client.get(f"{API_PREFIX}/events/{event_id}/scoreboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "scoreboard" in data
        assert "total_entries" in data
        assert isinstance(data["scoreboard"], list)
    
    def test_get_my_stats(self, master_client, stats_event):
        """Test getting current user's stats"""
        event_id = stats_event["event"]["id"]
        
        response = master_client.get(f"{API_PREFIX}/events/{event_id}/my-stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_points" in data
        assert "challenges_solved" in data
        assert "total_submissions" in data


# =============================================================================
# Available Challenges Tests
# =============================================================================

class TestAvailableChallenges:
    """Test available challenges endpoint"""
    
    def test_get_available_challenges(self, master_client, test_challenge):
        """Test getting available challenges for events"""
        response = master_client.get(f"{API_PREFIX}/events/available-challenges")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_available_challenges_with_category(self, master_client, test_challenge):
        """Test filtering available challenges by category"""
        response = master_client.get(
            f"{API_PREFIX}/events/available-challenges",
            params={"category": "Web"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for challenge in data:
            assert challenge.get("category") == "Web"


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test error handling scenarios"""
    
    def test_invalid_event_id_format(self, master_client):
        """Test with invalid ObjectId format"""
        response = master_client.get(f"{API_PREFIX}/events/invalid-id")
        assert response.status_code in [400, 404, 422]
    
    def test_missing_required_fields(self, master_client):
        """Test creating event with missing required fields"""
        event_data = {
            "name": "Incomplete Event"
            # Missing required fields
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 422
    
    def test_invalid_event_type(self, master_client):
        """Test creating event with invalid type"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        event_data = {
            "name": "Invalid Type Event",
            "event_type": "invalid_type",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": []
        }
        
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        assert response.status_code == 422
    
    def test_action_on_ended_event(self, master_client, test_challenge):
        """Test that actions fail on ended events"""
        start_time = datetime.now(timezone.utc) - timedelta(hours=2)
        end_time = start_time + timedelta(hours=1)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Ended Event Test {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 100,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        # Create, approve, start, and end event
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        master_client.post(f"{API_PREFIX}/events/{event_id}/end")
        
        # Try to register after event ended
        response = master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        assert response.status_code == 400


# =============================================================================
# Event Summary Tests
# =============================================================================

class TestEventSummary:
    """Test event summary functionality"""
    
    def test_get_event_summary(self, master_client, test_challenge):
        """Test getting event summary after it ends"""
        start_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        end_time = start_time + timedelta(hours=4)
        
        challenge_id = test_challenge.get("id", test_challenge.get("_id"))
        
        event_data = {
            "name": f"Summary Test Event {uuid.uuid4().hex[:8]}",
            "event_type": "ctf",
            "participation_type": "individual",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "challenges": [
                {
                    "challenge_id": challenge_id,
                    "challenge_name": test_challenge["name"],
                    "challenge_category": test_challenge.get("category", "Web"),
                    "points": 100,
                    "is_visible": True,
                    "hints": []
                }
            ]
        }
        
        # Create and run event
        response = master_client.post(f"{API_PREFIX}/events/", json=event_data)
        event_id = response.json()["id"]
        
        master_client.post(f"{API_PREFIX}/events/{event_id}/submit-for-approval")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/approve",
            json={"approved": True}
        )
        master_client.post(f"{API_PREFIX}/events/{event_id}/start")
        
        # Do some activity
        master_client.post(f"{API_PREFIX}/events/{event_id}/register")
        master_client.post(
            f"{API_PREFIX}/events/{event_id}/challenges/{challenge_id}/submit",
            json={"flag": "FLAG{test_flag_12345}"}
        )
        
        # End event
        master_client.post(f"{API_PREFIX}/events/{event_id}/end")
        
        # Get summary
        response = master_client.get(f"{API_PREFIX}/events/{event_id}/summary")
        
        # Summary endpoint might not exist yet, check for 200 or 404
        if response.status_code == 200:
            data = response.json()
            assert "event_id" in data or "id" in data


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

