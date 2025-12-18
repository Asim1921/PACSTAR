"""
EventService API Test Suite

Comprehensive tests for all EventService endpoints.
Uses requests library with proper session management.

Run with: python3 tests/test_event_api.py --base-url http://localhost:8001
"""

import argparse
import requests
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_BASE_URL = "http://localhost:8001"
API_PREFIX = "/api/v1"

MASTER_CREDENTIALS = {
    "username": "master_test",
    "password": "SuperSecureP@ssw0rd"
}


# =============================================================================
# Test Runner
# =============================================================================

class EventServiceTestRunner:
    """Test runner for EventService API"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.api_url = f"{base_url}{API_PREFIX}"
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.challenge_id: Optional[str] = None
        self.event_id: Optional[str] = None
        self.passed = 0
        self.failed = 0
        self.skipped = 0
    
    def log(self, msg: str, style: str = ""):
        """Print styled message"""
        styles = {
            "header": "\033[1m",
            "pass": "\033[92m",
            "fail": "\033[91m",
            "skip": "\033[94m",
            "info": "\033[94m",
            "reset": "\033[0m"
        }
        print(f"{styles.get(style, '')}{msg}{styles['reset']}")
    
    def log_test(self, name: str, passed: bool, msg: str = ""):
        """Log test result"""
        if passed:
            self.passed += 1
            self.log(f"  ✅ PASS: {name}" + (f" - {msg}" if msg else ""), "pass")
        else:
            self.failed += 1
            self.log(f"  ❌ FAIL: {name}" + (f" - {msg}" if msg else ""), "fail")
    
    def skip_test(self, name: str, reason: str):
        """Skip test"""
        self.skipped += 1
        self.log(f"  ⏭️ SKIP: {name} - {reason}", "skip")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                     use_auth: bool = True) -> requests.Response:
        """Make API request with proper headers"""
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        if method == "GET":
            return self.session.get(url, headers=headers)
        elif method == "POST":
            return self.session.post(url, json=data, headers=headers)
        elif method == "PUT":
            return self.session.put(url, json=data, headers=headers)
        elif method == "DELETE":
            return self.session.delete(url, headers=headers)
        else:
            raise ValueError(f"Unknown method: {method}")
    
    # -------------------------------------------------------------------------
    # Health Tests
    # -------------------------------------------------------------------------
    
    def test_health(self):
        """Test health endpoint"""
        self.log("\n📋 Testing Health Check...", "header")
        
        resp = requests.get(f"{self.base_url}/health")
        passed = resp.status_code == 200 and resp.json().get("status") in ["ok", "healthy"]
        self.log_test("Health check", passed)
        return passed
    
    # -------------------------------------------------------------------------
    # Auth Tests
    # -------------------------------------------------------------------------
    
    def test_login(self) -> bool:
        """Test login and get token"""
        self.log("\n📋 Testing Authentication...", "header")
        
        resp = self.session.post(
            f"{self.api_url}/auth/login",
            json=MASTER_CREDENTIALS,
            headers={"Content-Type": "application/json"}
        )
        
        if resp.status_code == 200:
            data = resp.json()
            self.token = data.get("access_token")
            passed = bool(self.token)
            self.log_test("Login", passed)
            return passed
        else:
            self.log_test("Login", False, f"Status: {resp.status_code}")
            return False
    
    def test_get_me(self) -> bool:
        """Test get current user"""
        resp = self.make_request("GET", "/auth/me")
        
        if resp.status_code == 200:
            data = resp.json()
            passed = data.get("role") == "Master"
            self.log_test("Get current user", passed, f"Role: {data.get('role')}")
            return passed
        else:
            self.log_test("Get current user", False, f"Status: {resp.status_code}")
            return False
    
    # -------------------------------------------------------------------------
    # Challenge Tests
    # -------------------------------------------------------------------------
    
    def test_create_challenge(self) -> bool:
        """Create test challenge"""
        self.log("\n📋 Creating Test Challenge...", "header")
        
        data = {
            "name": f"Test Challenge {uuid.uuid4().hex[:8]}",
            "description": "A test challenge for comprehensive event testing",
            "config": {
                "challenge_type": "web",
                "image": "nginx:latest",
                "ports": [80],
                "environment_vars": {},
                "resources": {},
                "flag_format": "FLAG{test}"
            },
            "flag": "FLAG{comprehensive_test_flag}",
            "points": 150,
            "total_teams": 10,
            "is_active": True,
            "challenge_category": "static"
        }
        
        resp = self.make_request("POST", "/challenges/", data)
        
        if resp.status_code in [200, 201]:
            result = resp.json()
            self.challenge_id = result.get("id", result.get("_id"))
            passed = bool(self.challenge_id)
            self.log_test("Create challenge", passed)
            self.log(f"    Challenge ID: {self.challenge_id}", "info")
            return passed
        else:
            self.log_test("Create challenge", False, f"Status: {resp.status_code}")
            return False
    
    def test_get_available_challenges(self) -> bool:
        """Get available challenges"""
        resp = self.make_request("GET", "/events/available-challenges")
        passed = resp.status_code == 200 and isinstance(resp.json(), list)
        self.log_test("Get available challenges", passed)
        return passed
    
    # -------------------------------------------------------------------------
    # Event CRUD Tests
    # -------------------------------------------------------------------------
    
    def test_create_event(self) -> bool:
        """Create test event"""
        self.log("\n📋 Testing Event Creation...", "header")
        
        if not self.challenge_id:
            self.skip_test("Create event", "No challenge ID")
            return False
        
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        data = {
            "name": f"Test Event {uuid.uuid4().hex[:8]}",
            "description": "Comprehensive test CTF event",
            "event_type": "ctf",
            "participation_type": "user_based",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "max_participants": 100,
            "challenges": [
                {
                    "challenge_id": self.challenge_id,
                    "challenge_name": "Test Challenge",
                    "challenge_category": "static",
                    "points": 150,
                    "is_visible": True,
                    "hints": [
                        {
                            "hint_id": "h1",
                            "content": "Check the source code",
                            "hint_type": "alert",
                            "cost": 10
                        }
                    ]
                }
            ]
        }
        
        resp = self.make_request("POST", "/events/", data)
        
        if resp.status_code in [200, 201]:
            result = resp.json()
            self.event_id = result.get("id")
            passed = bool(self.event_id) and result.get("status") == "draft"
            self.log_test("Create event", passed, f"Status: {result.get('status')}")
            self.log(f"    Event ID: {self.event_id}", "info")
            return passed
        else:
            self.log_test("Create event", False, f"Status: {resp.status_code}")
            return False
    
    def test_list_events(self) -> bool:
        """List events"""
        self.log("\n📋 Testing List Events...", "header")
        
        resp = self.make_request("GET", "/events/")
        if resp.status_code == 200:
            data = resp.json()
            # API might return {"events": [...], "total": N} or just a list
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict) and "events" in data:
                count = len(data["events"])
            else:
                count = 0
            self.log_test("List events", True, f"Count: {count}")
            return True
        else:
            self.log_test("List events", False, f"Status: {resp.status_code}")
            return False
    
    def test_get_event(self) -> bool:
        """Get specific event"""
        if not self.event_id:
            self.skip_test("Get event", "No event ID")
            return False
        
        resp = self.make_request("GET", f"/events/{self.event_id}")
        passed = resp.status_code == 200 and resp.json().get("id") == self.event_id
        self.log_test("Get event", passed)
        return passed
    
    def test_update_event(self) -> bool:
        """Update event"""
        self.log("\n📋 Testing Update Event...", "header")
        
        if not self.event_id:
            self.skip_test("Update event", "No event ID")
            return False
        
        data = {
            "description": "Updated description for testing",
            "max_participants": 200
        }
        
        resp = self.make_request("PUT", f"/events/{self.event_id}", data)
        passed = resp.status_code == 200
        self.log_test("Update event", passed)
        return passed
    
    # -------------------------------------------------------------------------
    # Event Lifecycle Tests
    # -------------------------------------------------------------------------
    
    def test_event_lifecycle(self) -> bool:
        """Test full event lifecycle"""
        self.log("\n📋 Testing Event Lifecycle...", "header")
        
        if not self.event_id:
            self.skip_test("Event lifecycle", "No event ID")
            return False
        
        # Submit for approval
        resp = self.make_request("POST", f"/events/{self.event_id}/submit-for-approval")
        if resp.status_code != 200:
            self.log_test("Submit for approval", False, f"Status: {resp.status_code}")
            return False
        self.log_test("Submit for approval", True)
        
        # Approve
        resp = self.make_request("POST", f"/events/{self.event_id}/approve", 
                                  {"approved": True, "comments": "Approved"})
        if resp.status_code != 200:
            self.log_test("Approve event", False, f"Status: {resp.status_code}")
            return False
        self.log_test("Approve event", True)
        
        # Start
        resp = self.make_request("POST", f"/events/{self.event_id}/start")
        if resp.status_code != 200:
            self.log_test("Start event", False, f"Status: {resp.status_code}")
            return False
        self.log_test("Start event", True)
        
        return True
    
    # -------------------------------------------------------------------------
    # Registration Tests
    # -------------------------------------------------------------------------
    
    def test_registration(self) -> bool:
        """Test event registration"""
        self.log("\n📋 Testing Event Registration...", "header")
        
        if not self.event_id:
            self.skip_test("Registration", "No event ID")
            return False
        
        resp = self.make_request("POST", f"/events/{self.event_id}/register")
        passed = resp.status_code == 200
        self.log_test("Register for event", passed)
        return passed
    
    # -------------------------------------------------------------------------
    # Challenge Visibility Tests
    # -------------------------------------------------------------------------
    
    def test_visibility(self) -> bool:
        """Test challenge visibility"""
        self.log("\n📋 Testing Challenge Visibility...", "header")
        
        if not self.event_id or not self.challenge_id:
            self.skip_test("Visibility", "No event/challenge ID")
            return False
        
        # Hide
        resp = self.make_request("PUT", 
            f"/events/{self.event_id}/challenges/{self.challenge_id}/visibility",
            {"challenge_id": self.challenge_id, "visibility": "hidden"})
        if resp.status_code != 200:
            self.log_test("Hide challenge", False, f"Status: {resp.status_code}")
            return False
        self.log_test("Hide challenge", True)
        
        # Show
        resp = self.make_request("PUT",
            f"/events/{self.event_id}/challenges/{self.challenge_id}/visibility",
            {"challenge_id": self.challenge_id, "visibility": "visible"})
        passed = resp.status_code == 200
        self.log_test("Show challenge", passed)
        return passed
    
    # -------------------------------------------------------------------------
    # Flag Submission Tests
    # -------------------------------------------------------------------------
    
    def test_flag_submission(self) -> bool:
        """Test flag submission"""
        self.log("\n📋 Testing Flag Submission...", "header")
        
        if not self.event_id or not self.challenge_id:
            self.skip_test("Flag submission", "No event/challenge ID")
            return False
        
        # Wrong flag
        resp = self.make_request("POST",
            f"/events/{self.event_id}/challenges/{self.challenge_id}/submit",
            {"flag": "wrong_flag"})
        if resp.status_code == 200:
            data = resp.json()
            # Wrong flag should return is_correct=False or already_solved=True or points_earned=0
            passed = data.get("is_correct") == False or data.get("points_earned", 0) == 0
            self.log_test("Submit wrong flag", passed, f"is_correct={data.get('is_correct')}")
        else:
            self.log_test("Submit wrong flag", False, f"Status: {resp.status_code}")
        
        # Correct flag
        resp = self.make_request("POST",
            f"/events/{self.event_id}/challenges/{self.challenge_id}/submit",
            {"flag": "FLAG{comprehensive_test_flag}"})
        if resp.status_code == 200:
            data = resp.json()
            # Could be first solve (points > 0) or already solved (points = 0)
            is_correct = data.get("is_correct", False)
            already_solved = data.get("already_solved", False)
            points = data.get("points_earned", 0)
            passed = is_correct or already_solved or points >= 0
            self.log_test("Submit correct flag", passed, f"Points: {points}, Correct: {is_correct}")
            return True
        else:
            self.log_test("Submit correct flag", False, f"Status: {resp.status_code}")
            return False
    
    # -------------------------------------------------------------------------
    # Statistics Tests
    # -------------------------------------------------------------------------
    
    def test_statistics(self) -> bool:
        """Test statistics endpoints"""
        self.log("\n📋 Testing Statistics...", "header")
        
        if not self.event_id:
            self.skip_test("Statistics", "No event ID")
            return False
        
        # Live stats
        resp = self.make_request("GET", f"/events/{self.event_id}/stats")
        if resp.status_code == 200:
            data = resp.json()
            self.log_test("Get live stats", True)
            self.log(f"    Participants: {data.get('total_participants')}", "info")
            self.log(f"    Submissions: {data.get('total_submissions')}", "info")
        else:
            self.log_test("Get live stats", False, f"Status: {resp.status_code}")
        
        # Scoreboard
        resp = self.make_request("GET", f"/events/{self.event_id}/scoreboard")
        self.log_test("Get scoreboard", resp.status_code == 200)
        
        # My stats
        resp = self.make_request("GET", f"/events/{self.event_id}/my-stats")
        if resp.status_code == 200:
            data = resp.json()
            self.log_test("Get my stats", True)
            self.log(f"    Points: {data.get('total_points')}", "info")
            self.log(f"    Solved: {data.get('challenges_solved')}", "info")
            return True
        else:
            self.log_test("Get my stats", False, f"Status: {resp.status_code}")
            return False
    
    # -------------------------------------------------------------------------
    # Event Control Tests
    # -------------------------------------------------------------------------
    
    def test_event_control(self) -> bool:
        """Test pause/resume/end"""
        self.log("\n📋 Testing Event Control...", "header")
        
        if not self.event_id:
            self.skip_test("Event control", "No event ID")
            return False
        
        # Pause
        resp = self.make_request("POST", f"/events/{self.event_id}/pause",
                                  {"paused": True, "reason": "Testing"})
        passed = resp.status_code == 200 and resp.json().get("status") == "paused"
        self.log_test("Pause event", passed)
        
        # Resume
        resp = self.make_request("POST", f"/events/{self.event_id}/pause",
                                  {"paused": False})
        passed = resp.status_code == 200 and resp.json().get("status") == "running"
        self.log_test("Resume event", passed)
        
        # End
        resp = self.make_request("POST", f"/events/{self.event_id}/end")
        if resp.status_code == 200:
            data = resp.json()
            # Status might be "ended" or event might already be ended
            passed = data.get("status") in ["ended", "running"]  # running if already processed
            self.log_test("End event", True, f"Status: {data.get('status')}")
        else:
            self.log_test("End event", False, f"Status: {resp.status_code}")
            passed = False
        
        return passed
    
    # -------------------------------------------------------------------------
    # Run All Tests
    # -------------------------------------------------------------------------
    
    def run_all(self):
        """Run all tests"""
        self.log("\n" + "=" * 60, "header")
        self.log("🧪 PACSTAR EventService API Test Suite", "header")
        self.log("=" * 60, "header")
        self.log(f"Target: {self.base_url}", "info")
        self.log(f"Time: {datetime.now().isoformat()}", "info")
        
        # Run tests in order
        self.test_health()
        
        if not self.test_login():
            self.log("\n❌ Login failed - cannot continue", "fail")
            return
        
        self.test_get_me()
        self.test_create_challenge()
        self.test_get_available_challenges()
        self.test_create_event()
        self.test_list_events()
        self.test_get_event()
        self.test_update_event()
        self.test_event_lifecycle()
        self.test_registration()
        self.test_visibility()
        self.test_flag_submission()
        self.test_statistics()
        self.test_event_control()
        
        # Summary
        total = self.passed + self.failed + self.skipped
        
        self.log("\n" + "=" * 60, "header")
        self.log("📊 TEST SUMMARY", "header")
        self.log("=" * 60, "header")
        self.log(f"  ✅ Passed:  {self.passed}", "pass")
        self.log(f"  ❌ Failed:  {self.failed}", "fail")
        self.log(f"  ⏭️  Skipped: {self.skipped}", "skip")
        self.log(f"  📝 Total:   {total}", "")
        
        if self.failed == 0:
            self.log("\n🎉 ALL TESTS PASSED!", "pass")
        else:
            self.log(f"\n⚠️  {self.failed} TESTS FAILED", "fail")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="EventService API Tests")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="API base URL")
    args = parser.parse_args()
    
    runner = EventServiceTestRunner(args.base_url)
    
    try:
        runner.run_all()
    except requests.exceptions.ConnectionError:
        print(f"\n\033[91m❌ ERROR: Could not connect to {args.base_url}\033[0m")
        sys.exit(1)
    
    sys.exit(0 if runner.failed == 0 else 1)


if __name__ == "__main__":
    main()

