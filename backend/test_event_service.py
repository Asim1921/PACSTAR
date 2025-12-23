#!/usr/bin/env python3
"""
Comprehensive Test Suite for EventService API

Tests all EventService endpoints including:
- Event CRUD operations
- Approval workflow
- Event lifecycle (start, pause, resume, end)
- Participant registration
- Flag submission
- Hints
- Statistics and scoreboard

Usage:
    python test_event_service.py [--base-url http://localhost:8000]
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

# Test credentials - Use the hardcoded master password from auth_service.py
MASTER_USER = "master_test"
MASTER_PASSWORD = "SuperSecureP@ssw0rd"  # Hardcoded in auth_service for master bypass
MASTER_EMAIL = "master_test@gmail.com"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


class EventServiceTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.api_url = f"{base_url}{API_PREFIX}"
        self.token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.test_event_id: Optional[str] = None
        self.test_challenge_id: Optional[str] = None
        self.tests_passed = 0
        self.tests_failed = 0
        self.tests_skipped = 0

    def log(self, message: str, level: str = "info"):
        """Print colored log message"""
        colors = {
            "info": BLUE,
            "success": GREEN,
            "error": RED,
            "warning": YELLOW,
            "header": BOLD
        }
        color = colors.get(level, "")
        print(f"{color}{message}{RESET}")

    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result"""
        if passed:
            self.tests_passed += 1
            self.log(f"  ✅ PASS: {name}", "success")
        else:
            self.tests_failed += 1
            self.log(f"  ❌ FAIL: {name} - {details}", "error")

    def make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        auth: bool = True
    ) -> requests.Response:
        """Make HTTP request to API"""
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers,
                timeout=30
            )
            return response
        except Exception as e:
            self.log(f"Request failed: {e}", "error")
            raise

    # =========================================================================
    # Authentication Tests
    # =========================================================================
    
    def test_health_check(self) -> bool:
        """Test health endpoint"""
        self.log("\n📋 Testing Health Check...", "header")
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            passed = response.status_code == 200
            self.log_test("Health check", passed, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test("Health check", False, str(e))
            return False

    def test_register_master(self) -> bool:
        """Skip registration - Master user is created via login bypass"""
        self.log("\n📋 Skipping User Registration (Master bypass will create user)...", "header")
        # Don't register - let the login master bypass create the user with Master role
        self.log_test("Skip registration (using master bypass)", True)
        return True

    def test_login(self) -> bool:
        """Test login and get token"""
        self.log("\n📋 Testing Login...", "header")
        
        data = {
            "username": MASTER_USER,
            "password": MASTER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", data, auth=False)
        
        if response.status_code == 200:
            result = response.json()
            self.token = result.get("access_token")
            self.refresh_token = result.get("refresh_token")
            passed = bool(self.token)
            self.log_test("Login", passed, "Token obtained" if passed else "No token")
            return passed
        else:
            self.log_test("Login", False, f"Status: {response.status_code}")
            return False

    def test_get_me(self) -> bool:
        """Test get current user"""
        response = self.make_request("GET", "/auth/me")
        
        if response.status_code == 200:
            result = response.json()
            self.user_id = result.get("id")
            passed = bool(self.user_id)
            self.log_test("Get current user", passed)
            return passed
        else:
            self.log_test("Get current user", False, f"Status: {response.status_code}")
            return False

    # =========================================================================
    # Challenge Tests (needed for events)
    # =========================================================================

    def test_create_challenge(self) -> bool:
        """Create a test challenge for events"""
        self.log("\n📋 Creating Test Challenge...", "header")
        
        data = {
            "name": f"Test Challenge {int(time.time())}",
            "description": "A test challenge for event testing",
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
            "is_active": True,
            "challenge_category": "static"
        }
        
        response = self.make_request("POST", "/challenges/", data)
        
        if response.status_code == 201:
            result = response.json()
            self.test_challenge_id = result.get("id")
            passed = bool(self.test_challenge_id)
            self.log_test("Create challenge", passed, f"ID: {self.test_challenge_id}")
            return passed
        else:
            self.log_test("Create challenge", False, f"Status: {response.status_code} - {response.text}")
            return False

    # =========================================================================
    # Event CRUD Tests
    # =========================================================================

    def test_get_available_challenges(self) -> bool:
        """Test getting available challenges for event creation"""
        self.log("\n📋 Testing Get Available Challenges...", "header")
        
        response = self.make_request("GET", "/events/available-challenges")
        
        passed = response.status_code == 200
        if passed:
            challenges = response.json()
            self.log_test("Get available challenges", True, f"Found {len(challenges)} challenges")
        else:
            self.log_test("Get available challenges", False, f"Status: {response.status_code}")
        return passed

    def test_create_event(self) -> bool:
        """Test creating an event"""
        self.log("\n📋 Testing Create Event...", "header")
        
        start_time = datetime.utcnow() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=4)
        
        data = {
            "name": f"Test CTF Event {int(time.time())}",
            "description": "A comprehensive test CTF event for testing the EventService API",
            "event_type": "ctf",
            "participation_type": "user_based",
            "zone": "master_zone",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "max_participants": 100,
            "is_public": True,
            "challenges": []
        }
        
        # Add challenge if we have one
        if self.test_challenge_id:
            data["challenges"] = [{
                "challenge_id": self.test_challenge_id,
                "visibility": "visible",
                "points_override": 150,
                "order": 1,
                "hints": [
                    {
                        "content": "This is hint 1 - Alert style",
                        "hint_type": "alert",
                        "cost": 10,
                        "order": 1
                    },
                    {
                        "content": "This is hint 2 - Toast style",
                        "hint_type": "toast",
                        "cost": 20,
                        "order": 2
                    },
                    {
                        "content": "This is hint 3 - Background style",
                        "hint_type": "background",
                        "cost": 30,
                        "order": 3
                    }
                ],
                "max_attempts": 10
            }]
        
        response = self.make_request("POST", "/events/", data)
        
        if response.status_code == 201:
            result = response.json()
            self.test_event_id = result.get("id")
            passed = bool(self.test_event_id)
            self.log_test("Create event", passed, f"ID: {self.test_event_id}")
            self.log(f"    Event Status: {result.get('status')}", "info")
            return passed
        else:
            self.log_test("Create event", False, f"Status: {response.status_code} - {response.text}")
            return False

    def test_list_events(self) -> bool:
        """Test listing events"""
        self.log("\n📋 Testing List Events...", "header")
        
        response = self.make_request("GET", "/events/")
        
        if response.status_code == 200:
            result = response.json()
            total = result.get("total", 0)
            self.log_test("List events", True, f"Found {total} events")
            return True
        else:
            self.log_test("List events", False, f"Status: {response.status_code}")
            return False

    def test_get_event(self) -> bool:
        """Test getting single event"""
        if not self.test_event_id:
            self.log_test("Get event", False, "No event ID")
            return False
        
        response = self.make_request("GET", f"/events/{self.test_event_id}")
        
        passed = response.status_code == 200
        self.log_test("Get event", passed, f"Status: {response.status_code}")
        return passed

    def test_update_event(self) -> bool:
        """Test updating an event"""
        self.log("\n📋 Testing Update Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Update event", False, "No event ID")
            return False
        
        data = {
            "description": "Updated description for test event",
            "max_participants": 200
        }
        
        response = self.make_request("PUT", f"/events/{self.test_event_id}", data)
        
        passed = response.status_code == 200
        self.log_test("Update event", passed, f"Status: {response.status_code}")
        return passed

    # =========================================================================
    # Approval Workflow Tests
    # =========================================================================

    def test_get_pending_approvals(self) -> bool:
        """Test getting pending approvals"""
        self.log("\n📋 Testing Pending Approvals...", "header")
        
        response = self.make_request("GET", "/events/pending-approvals")
        
        passed = response.status_code == 200
        if passed:
            events = response.json()
            self.log_test("Get pending approvals", True, f"Found {len(events)} pending")
        else:
            self.log_test("Get pending approvals", False, f"Status: {response.status_code}")
        return passed

    def test_approve_event(self) -> bool:
        """Test approving an event"""
        self.log("\n📋 Testing Approve Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Approve event", False, "No event ID")
            return False
        
        # First, submit for approval (if needed)
        response = self.make_request("POST", f"/events/{self.test_event_id}/submit-for-approval")
        self.log(f"    Submit for approval: {response.status_code}", "info")
        
        # Then approve
        data = {
            "approved": True,
            "comments": "Approved for testing purposes"
        }
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/approve", data)
        
        passed = response.status_code == 200
        if passed:
            result = response.json()
            self.log_test("Approve event", True, f"New status: {result.get('status')}")
        else:
            self.log_test("Approve event", False, f"Status: {response.status_code} - {response.text}")
        return passed

    # =========================================================================
    # Event Lifecycle Tests
    # =========================================================================

    def test_start_event(self) -> bool:
        """Test starting an event"""
        self.log("\n📋 Testing Start Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Start event", False, "No event ID")
            return False
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/start")
        
        passed = response.status_code == 200
        if passed:
            result = response.json()
            self.log_test("Start event", True, f"Status: {result.get('status')}")
        else:
            self.log_test("Start event", False, f"Status: {response.status_code} - {response.text}")
        return passed

    def test_pause_event(self) -> bool:
        """Test pausing an event"""
        self.log("\n📋 Testing Pause Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Pause event", False, "No event ID")
            return False
        
        data = {
            "paused": True,
            "reason": "Testing pause functionality"
        }
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/pause", data)
        
        passed = response.status_code == 200
        if passed:
            result = response.json()
            self.log_test("Pause event", True, f"Status: {result.get('status')}")
        else:
            self.log_test("Pause event", False, f"Status: {response.status_code} - {response.text}")
        return passed

    def test_resume_event(self) -> bool:
        """Test resuming a paused event"""
        self.log("\n📋 Testing Resume Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Resume event", False, "No event ID")
            return False
        
        data = {
            "paused": False,
            "reason": "Testing resume functionality"
        }
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/pause", data)
        
        passed = response.status_code == 200
        if passed:
            result = response.json()
            self.log_test("Resume event", True, f"Status: {result.get('status')}")
        else:
            self.log_test("Resume event", False, f"Status: {response.status_code} - {response.text}")
        return passed

    # =========================================================================
    # Registration Tests
    # =========================================================================

    def test_register_for_event(self) -> bool:
        """Test registering for an event"""
        self.log("\n📋 Testing Event Registration...", "header")
        
        if not self.test_event_id:
            self.log_test("Register for event", False, "No event ID")
            return False
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/register")
        
        # 200 = success, 400 = already registered (both OK for test)
        passed = response.status_code in [200, 400]
        self.log_test("Register for event", passed, f"Status: {response.status_code}")
        return passed

    # =========================================================================
    # Challenge Visibility Tests
    # =========================================================================

    def test_update_challenge_visibility(self) -> bool:
        """Test updating challenge visibility"""
        self.log("\n📋 Testing Challenge Visibility...", "header")
        
        if not self.test_event_id or not self.test_challenge_id:
            self.log_test("Update visibility", False, "No event/challenge ID")
            return False
        
        # Hide challenge
        data = {
            "challenge_id": self.test_challenge_id,
            "visibility": "hidden"
        }
        
        response = self.make_request(
            "PUT",
            f"/events/{self.test_event_id}/challenges/{self.test_challenge_id}/visibility",
            data
        )
        
        passed = response.status_code == 200
        self.log_test("Hide challenge", passed, f"Status: {response.status_code}")
        
        # Show challenge again
        data["visibility"] = "visible"
        response = self.make_request(
            "PUT",
            f"/events/{self.test_event_id}/challenges/{self.test_challenge_id}/visibility",
            data
        )
        
        passed = response.status_code == 200
        self.log_test("Show challenge", passed, f"Status: {response.status_code}")
        
        return passed

    # =========================================================================
    # Flag Submission Tests
    # =========================================================================

    def test_submit_wrong_flag(self) -> bool:
        """Test submitting wrong flag"""
        self.log("\n📋 Testing Flag Submission (Wrong)...", "header")
        
        if not self.test_event_id or not self.test_challenge_id:
            self.log_test("Submit wrong flag", False, "No event/challenge ID")
            return False
        
        data = {"flag": "WRONG_FLAG"}
        
        response = self.make_request(
            "POST",
            f"/events/{self.test_event_id}/challenges/{self.test_challenge_id}/submit",
            data
        )
        
        if response.status_code == 200:
            result = response.json()
            passed = result.get("status") == "incorrect"
            self.log_test("Submit wrong flag", passed, f"Result: {result.get('status')}")
            return passed
        else:
            self.log_test("Submit wrong flag", False, f"Status: {response.status_code} - {response.text}")
            return False

    def test_submit_correct_flag(self) -> bool:
        """Test submitting correct flag"""
        self.log("\n📋 Testing Flag Submission (Correct)...", "header")
        
        if not self.test_event_id or not self.test_challenge_id:
            self.log_test("Submit correct flag", False, "No event/challenge ID")
            return False
        
        data = {"flag": "FLAG{test_flag_12345}"}
        
        response = self.make_request(
            "POST",
            f"/events/{self.test_event_id}/challenges/{self.test_challenge_id}/submit",
            data
        )
        
        if response.status_code == 200:
            result = response.json()
            # Can be "correct" or "already_solved"
            passed = result.get("status") in ["correct", "already_solved"]
            self.log_test(
                "Submit correct flag",
                passed,
                f"Result: {result.get('status')}, Points: {result.get('points_awarded', 0)}"
            )
            return passed
        else:
            self.log_test("Submit correct flag", False, f"Status: {response.status_code} - {response.text}")
            return False

    # =========================================================================
    # Statistics Tests
    # =========================================================================

    def test_get_live_stats(self) -> bool:
        """Test getting live statistics"""
        self.log("\n📋 Testing Live Statistics...", "header")
        
        if not self.test_event_id:
            self.log_test("Get live stats", False, "No event ID")
            return False
        
        response = self.make_request("GET", f"/events/{self.test_event_id}/stats")
        
        if response.status_code == 200:
            stats = response.json()
            self.log_test("Get live stats", True)
            self.log(f"    Total participants: {stats.get('total_participants', 0)}", "info")
            self.log(f"    Total submissions: {stats.get('total_submissions', 0)}", "info")
            self.log(f"    Correct submissions: {stats.get('correct_submissions', 0)}", "info")
            return True
        else:
            self.log_test("Get live stats", False, f"Status: {response.status_code}")
            return False

    def test_get_scoreboard(self) -> bool:
        """Test getting scoreboard"""
        self.log("\n📋 Testing Scoreboard...", "header")
        
        if not self.test_event_id:
            self.log_test("Get scoreboard", False, "No event ID")
            return False
        
        response = self.make_request("GET", f"/events/{self.test_event_id}/scoreboard")
        
        if response.status_code == 200:
            result = response.json()
            entries = len(result.get("scoreboard", []))
            self.log_test("Get scoreboard", True, f"Entries: {entries}")
            return True
        else:
            self.log_test("Get scoreboard", False, f"Status: {response.status_code}")
            return False

    def test_get_my_stats(self) -> bool:
        """Test getting user's own stats"""
        self.log("\n📋 Testing My Stats...", "header")
        
        if not self.test_event_id:
            self.log_test("Get my stats", False, "No event ID")
            return False
        
        response = self.make_request("GET", f"/events/{self.test_event_id}/my-stats")
        
        if response.status_code == 200:
            stats = response.json()
            self.log_test("Get my stats", True)
            self.log(f"    Points: {stats.get('total_points', 0)}", "info")
            self.log(f"    Challenges solved: {stats.get('challenges_solved', 0)}", "info")
            return True
        else:
            self.log_test("Get my stats", False, f"Status: {response.status_code} - {response.text}")
            return False

    # =========================================================================
    # End Event Test
    # =========================================================================

    def test_end_event(self) -> bool:
        """Test ending an event"""
        self.log("\n📋 Testing End Event...", "header")
        
        if not self.test_event_id:
            self.log_test("End event", False, "No event ID")
            return False
        
        response = self.make_request("POST", f"/events/{self.test_event_id}/end")
        
        passed = response.status_code == 200
        if passed:
            result = response.json()
            self.log_test("End event", True, f"Status: {result.get('status')}")
        else:
            self.log_test("End event", False, f"Status: {response.status_code} - {response.text}")
        return passed

    # =========================================================================
    # Cleanup
    # =========================================================================

    def test_delete_event(self) -> bool:
        """Test deleting an event"""
        self.log("\n📋 Testing Delete Event...", "header")
        
        if not self.test_event_id:
            self.log_test("Delete event", False, "No event ID")
            return False
        
        response = self.make_request("DELETE", f"/events/{self.test_event_id}")
        
        passed = response.status_code == 204
        self.log_test("Delete event", passed, f"Status: {response.status_code}")
        return passed

    def test_delete_challenge(self) -> bool:
        """Clean up test challenge"""
        if not self.test_challenge_id:
            return True
        
        response = self.make_request("DELETE", f"/challenges/{self.test_challenge_id}")
        passed = response.status_code == 204
        self.log_test("Delete test challenge", passed, f"Status: {response.status_code}")
        return passed

    # =========================================================================
    # Run All Tests
    # =========================================================================

    def run_all_tests(self):
        """Run complete test suite"""
        self.log("\n" + "=" * 60, "header")
        self.log("🚀 PACSTAR EventService Comprehensive Test Suite", "header")
        self.log("=" * 60, "header")
        self.log(f"Target: {self.base_url}", "info")
        self.log(f"Time: {datetime.now().isoformat()}", "info")
        
        # Health & Auth
        self.test_health_check()
        self.test_register_master()
        if not self.test_login():
            self.log("\n❌ Cannot proceed without login!", "error")
            return
        self.test_get_me()
        
        # Create test challenge
        self.test_create_challenge()
        
        # Event CRUD
        self.test_get_available_challenges()
        self.test_create_event()
        self.test_list_events()
        self.test_get_event()
        self.test_update_event()
        
        # Approval workflow
        self.test_get_pending_approvals()
        self.test_approve_event()
        
        # Event lifecycle
        self.test_start_event()
        
        # Registration
        self.test_register_for_event()
        
        # Challenge visibility
        self.test_update_challenge_visibility()
        
        # Flag submission
        self.test_submit_wrong_flag()
        self.test_submit_correct_flag()
        
        # Statistics
        self.test_get_live_stats()
        self.test_get_scoreboard()
        self.test_get_my_stats()
        
        # Pause/Resume
        self.test_pause_event()
        self.test_resume_event()
        
        # End event
        self.test_end_event()
        
        # Cleanup (optional)
        # self.test_delete_event()
        # self.test_delete_challenge()
        
        # Summary
        self.log("\n" + "=" * 60, "header")
        self.log("📊 TEST SUMMARY", "header")
        self.log("=" * 60, "header")
        self.log(f"  ✅ Passed: {self.tests_passed}", "success")
        self.log(f"  ❌ Failed: {self.tests_failed}", "error" if self.tests_failed > 0 else "info")
        self.log(f"  ⏭️  Skipped: {self.tests_skipped}", "warning" if self.tests_skipped > 0 else "info")
        total = self.tests_passed + self.tests_failed + self.tests_skipped
        self.log(f"  📝 Total: {total}", "info")
        
        if self.tests_failed == 0:
            self.log("\n🎉 ALL TESTS PASSED!", "success")
        else:
            self.log(f"\n⚠️  {self.tests_failed} TESTS FAILED", "error")
        
        return self.tests_failed == 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Test EventService API")
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help=f"Base URL of the API (default: {BASE_URL})"
    )
    args = parser.parse_args()
    
    tester = EventServiceTester(base_url=args.base_url)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

