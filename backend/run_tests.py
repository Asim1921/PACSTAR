#!/usr/bin/env python3
"""
Test Runner Script for PACSTAR EventService

This script runs comprehensive tests against the EventService API.
Run from the host machine (not inside Docker container).

Usage:
    python3 run_tests.py [--base-url URL] [--verbose]
    
Examples:
    python3 run_tests.py
    python3 run_tests.py --base-url http://localhost:8001
    python3 run_tests.py --verbose
"""

import argparse
import requests
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_BASE_URL = "http://localhost:8001"
API_PREFIX = "/api/v1"

# Test credentials - login uses username field (not email)
MASTER_CREDENTIALS = {
    "username": "master_test",
    "password": "SuperSecureP@ssw0rd"
}


# =============================================================================
# Test Result Tracking
# =============================================================================

class TestStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"


@dataclass
class TestResult:
    name: str
    status: TestStatus
    message: str = ""
    duration: float = 0.0


@dataclass
class TestSuite:
    name: str
    results: List[TestResult] = field(default_factory=list)
    
    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.PASS)
    
    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.FAIL)
    
    @property
    def skipped(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.SKIP)
    
    @property
    def errors(self) -> int:
        return sum(1 for r in self.results if r.status == TestStatus.ERROR)


# =============================================================================
# API Client
# =============================================================================

class APIClient:
    """HTTP client for API testing"""
    
    def __init__(self, base_url: str, verbose: bool = False):
        self.base_url = base_url
        self.verbose = verbose
        self.token: Optional[str] = None
        self.session = requests.Session()
    
    def log(self, msg: str):
        if self.verbose:
            print(f"    [DEBUG] {msg}")
    
    def set_token(self, token: str):
        self.token = token
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def clear_token(self):
        self.token = None
        self.session.headers.pop("Authorization", None)
    
    def get(self, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        self.log(f"GET {url}")
        return self.session.get(url, **kwargs)
    
    def post(self, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        self.log(f"POST {url}")
        return self.session.post(url, **kwargs)
    
    def put(self, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        self.log(f"PUT {url}")
        return self.session.put(url, **kwargs)
    
    def delete(self, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        self.log(f"DELETE {url}")
        return self.session.delete(url, **kwargs)


# =============================================================================
# Test Classes
# =============================================================================

class EventServiceTests:
    """Comprehensive tests for EventService API"""
    
    def __init__(self, client: APIClient):
        self.client = client
        self.suites: List[TestSuite] = []
        self.challenge_id: Optional[str] = None
        self.event_id: Optional[str] = None
    
    def run_test(self, suite: TestSuite, name: str, test_func) -> TestResult:
        """Run a single test and record result"""
        start = time.time()
        try:
            test_func()
            result = TestResult(name, TestStatus.PASS, duration=time.time()-start)
            print(f"  \033[92m✅ PASS: {name}\033[0m")
        except AssertionError as e:
            result = TestResult(name, TestStatus.FAIL, str(e), time.time()-start)
            print(f"  \033[91m❌ FAIL: {name} - {e}\033[0m")
        except Exception as e:
            result = TestResult(name, TestStatus.ERROR, str(e), time.time()-start)
            print(f"  \033[93m⚠️ ERROR: {name} - {e}\033[0m")
        
        suite.results.append(result)
        return result
    
    def skip_test(self, suite: TestSuite, name: str, reason: str) -> TestResult:
        """Skip a test"""
        result = TestResult(name, TestStatus.SKIP, reason)
        print(f"  \033[94m⏭️ SKIP: {name} - {reason}\033[0m")
        suite.results.append(result)
        return result
    
    # -------------------------------------------------------------------------
    # Health Check Tests
    # -------------------------------------------------------------------------
    
    def test_health_check(self) -> TestSuite:
        suite = TestSuite("Health Check")
        print("\n\033[1m📋 Health Check Tests\033[0m")
        
        def test_health_endpoint():
            resp = self.client.get("/health")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            status = resp.json().get("status")
            assert status in ["healthy", "ok"], f"Unexpected status: {status}"
        
        def test_docs_available():
            resp = self.client.get("/docs")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
        
        self.run_test(suite, "Health endpoint returns OK", test_health_endpoint)
        self.run_test(suite, "Swagger docs available", test_docs_available)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Authentication Tests
    # -------------------------------------------------------------------------
    
    def test_authentication(self) -> TestSuite:
        suite = TestSuite("Authentication")
        print("\n\033[1m📋 Authentication Tests\033[0m")
        
        def test_login_success():
            resp = self.client.post(
                f"{API_PREFIX}/auth/login",
                json={
                    "username": MASTER_CREDENTIALS["username"],
                    "password": MASTER_CREDENTIALS["password"]
                }
            )
            assert resp.status_code == 200, f"Status: {resp.status_code} - {resp.text}"
            data = resp.json()
            assert "access_token" in data
            self.client.set_token(data["access_token"])
        
        def test_login_invalid():
            resp = self.client.post(
                f"{API_PREFIX}/auth/login",
                json={"username": "invaliduser", "password": "wrongpassword123"}
            )
            assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        
        def test_get_current_user():
            resp = self.client.get(f"{API_PREFIX}/auth/me")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert "email" in data
            assert data["role"] == "Master"
        
        def test_protected_without_token():
            self.client.clear_token()
            resp = self.client.get(f"{API_PREFIX}/events/")
            assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
            # Re-authenticate
            login_resp = self.client.post(
                f"{API_PREFIX}/auth/login",
                json={
                    "username": MASTER_CREDENTIALS["username"],
                    "password": MASTER_CREDENTIALS["password"]
                }
            )
            self.client.set_token(login_resp.json()["access_token"])
        
        self.run_test(suite, "Login with valid credentials", test_login_success)
        self.run_test(suite, "Login with invalid credentials returns 401", test_login_invalid)
        self.run_test(suite, "Get current user info", test_get_current_user)
        self.run_test(suite, "Protected endpoint without token returns 401", test_protected_without_token)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Challenge Setup Tests
    # -------------------------------------------------------------------------
    
    def test_challenge_setup(self) -> TestSuite:
        suite = TestSuite("Challenge Setup")
        print("\n\033[1m📋 Challenge Setup Tests\033[0m")
        
        def test_create_challenge():
            challenge_data = {
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
            resp = self.client.post(f"{API_PREFIX}/challenges/", json=challenge_data)
            # API may return 200 or 201
            assert resp.status_code in [200, 201], f"Status: {resp.status_code} - {resp.text}"
            data = resp.json()
            self.challenge_id = data.get("id", data.get("_id"))
            assert self.challenge_id, "No challenge ID returned"
            print(f"    \033[94mCreated challenge: {self.challenge_id}\033[0m")
        
        def test_get_available_challenges():
            resp = self.client.get(f"{API_PREFIX}/events/available-challenges")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert isinstance(resp.json(), list)
        
        self.run_test(suite, "Create test challenge", test_create_challenge)
        self.run_test(suite, "Get available challenges", test_get_available_challenges)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Event CRUD Tests
    # -------------------------------------------------------------------------
    
    def test_event_crud(self) -> TestSuite:
        suite = TestSuite("Event CRUD")
        print("\n\033[1m📋 Event CRUD Tests\033[0m")
        
        if not self.challenge_id:
            self.skip_test(suite, "All CRUD tests", "No challenge ID available")
            return suite
        
        def test_create_ctf_event():
            start_time = datetime.now(timezone.utc) + timedelta(hours=1)
            end_time = start_time + timedelta(hours=4)
            
            event_data = {
                "name": f"CTF Test Event {uuid.uuid4().hex[:8]}",
                "description": "Comprehensive CTF test event",
                "event_type": "ctf",
                "participation_type": "individual",
                "zone": "master_zone",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "max_participants": 100,
                "challenges": [
                    {
                        "challenge_id": self.challenge_id,
                        "challenge_name": "Test Challenge",
                        "challenge_category": "Web",
                        "points": 150,
                        "is_visible": True,
                        "hints": [
                            {
                                "hint_id": "h1",
                                "content": "Check the source",
                                "hint_type": "alert",
                                "cost": 10
                            }
                        ]
                    }
                ]
            }
            
            resp = self.client.post(f"{API_PREFIX}/events/", json=event_data)
            assert resp.status_code == 200, f"Status: {resp.status_code} - {resp.text}"
            data = resp.json()
            self.event_id = data["id"]
            assert data["status"] == "draft"
            print(f"    \033[94mCreated event: {self.event_id}\033[0m")
        
        def test_create_cyber_exercise():
            start_time = datetime.now(timezone.utc) + timedelta(hours=2)
            end_time = start_time + timedelta(hours=8)
            
            event_data = {
                "name": f"Cyber Exercise {uuid.uuid4().hex[:8]}",
                "event_type": "cyber_exercise",
                "participation_type": "team",
                "zone": "master_zone",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "max_team_size": 5,
                "challenges": []
            }
            
            resp = self.client.post(f"{API_PREFIX}/events/", json=event_data)
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["event_type"] == "cyber_exercise"
        
        def test_list_events():
            resp = self.client.get(f"{API_PREFIX}/events/")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert isinstance(resp.json(), list)
        
        def test_get_event():
            if not self.event_id:
                raise AssertionError("No event ID")
            resp = self.client.get(f"{API_PREFIX}/events/{self.event_id}")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["id"] == self.event_id
        
        def test_update_event():
            if not self.event_id:
                raise AssertionError("No event ID")
            update_data = {
                "description": "Updated description",
                "max_participants": 200
            }
            resp = self.client.put(f"{API_PREFIX}/events/{self.event_id}", json=update_data)
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["description"] == "Updated description"
        
        def test_invalid_event_times():
            start_time = datetime.now(timezone.utc) + timedelta(hours=2)
            end_time = start_time - timedelta(hours=1)  # Before start
            
            event_data = {
                "name": "Invalid Times Event",
                "event_type": "ctf",
                "participation_type": "individual",
                "zone": "master_zone",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "challenges": []
            }
            
            resp = self.client.post(f"{API_PREFIX}/events/", json=event_data)
            assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        
        self.run_test(suite, "Create CTF event", test_create_ctf_event)
        self.run_test(suite, "Create Cyber Exercise event", test_create_cyber_exercise)
        self.run_test(suite, "List events", test_list_events)
        self.run_test(suite, "Get event by ID", test_get_event)
        self.run_test(suite, "Update event", test_update_event)
        self.run_test(suite, "Invalid event times rejected", test_invalid_event_times)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Event Lifecycle Tests
    # -------------------------------------------------------------------------
    
    def test_event_lifecycle(self) -> TestSuite:
        suite = TestSuite("Event Lifecycle")
        print("\n\033[1m📋 Event Lifecycle Tests\033[0m")
        
        if not self.event_id:
            self.skip_test(suite, "All lifecycle tests", "No event ID")
            return suite
        
        def test_submit_for_approval():
            resp = self.client.post(f"{API_PREFIX}/events/{self.event_id}/submit-for-approval")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "pending_approval"
        
        def test_get_pending_approvals():
            resp = self.client.get(f"{API_PREFIX}/events/pending-approvals")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert isinstance(resp.json(), list)
        
        def test_approve_event():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/approve",
                json={"approved": True, "comments": "Approved for testing"}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "approved"
        
        def test_start_event():
            resp = self.client.post(f"{API_PREFIX}/events/{self.event_id}/start")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "running"
            print(f"    \033[94mEvent is now running\033[0m")
        
        self.run_test(suite, "Submit for approval", test_submit_for_approval)
        self.run_test(suite, "Get pending approvals", test_get_pending_approvals)
        self.run_test(suite, "Approve event", test_approve_event)
        self.run_test(suite, "Start event", test_start_event)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Event Registration Tests
    # -------------------------------------------------------------------------
    
    def test_event_registration(self) -> TestSuite:
        suite = TestSuite("Event Registration")
        print("\n\033[1m📋 Event Registration Tests\033[0m")
        
        if not self.event_id:
            self.skip_test(suite, "All registration tests", "No event ID")
            return suite
        
        def test_register_for_event():
            resp = self.client.post(f"{API_PREFIX}/events/{self.event_id}/register")
            assert resp.status_code == 200, f"Status: {resp.status_code} - {resp.text}"
            assert resp.json()["registered"] == True
        
        def test_get_participants():
            resp = self.client.get(f"{API_PREFIX}/events/{self.event_id}/participants")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert isinstance(resp.json(), list)
            assert len(resp.json()) >= 1
        
        def test_double_registration():
            resp = self.client.post(f"{API_PREFIX}/events/{self.event_id}/register")
            assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        
        self.run_test(suite, "Register for event", test_register_for_event)
        self.run_test(suite, "Get event participants", test_get_participants)
        self.run_test(suite, "Double registration rejected", test_double_registration)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Challenge Visibility Tests
    # -------------------------------------------------------------------------
    
    def test_challenge_visibility(self) -> TestSuite:
        suite = TestSuite("Challenge Visibility")
        print("\n\033[1m📋 Challenge Visibility Tests\033[0m")
        
        if not self.event_id or not self.challenge_id:
            self.skip_test(suite, "All visibility tests", "No event/challenge ID")
            return suite
        
        def test_hide_challenge():
            resp = self.client.put(
                f"{API_PREFIX}/events/{self.event_id}/challenges/{self.challenge_id}/visibility",
                json={"is_visible": False}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["is_visible"] == False
        
        def test_show_challenge():
            resp = self.client.put(
                f"{API_PREFIX}/events/{self.event_id}/challenges/{self.challenge_id}/visibility",
                json={"is_visible": True}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["is_visible"] == True
        
        self.run_test(suite, "Hide challenge", test_hide_challenge)
        self.run_test(suite, "Show challenge", test_show_challenge)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Flag Submission Tests
    # -------------------------------------------------------------------------
    
    def test_flag_submission(self) -> TestSuite:
        suite = TestSuite("Flag Submission")
        print("\n\033[1m📋 Flag Submission Tests\033[0m")
        
        if not self.event_id or not self.challenge_id:
            self.skip_test(suite, "All submission tests", "No event/challenge ID")
            return suite
        
        def test_submit_wrong_flag():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/challenges/{self.challenge_id}/submit",
                json={"flag": "wrong_flag"}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert data["is_correct"] == False
            assert data["points_earned"] == 0
            print(f"    \033[94mWrong flag: 0 points\033[0m")
        
        def test_submit_correct_flag():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/challenges/{self.challenge_id}/submit",
                json={"flag": "FLAG{comprehensive_test_flag}"}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert data["is_correct"] == True
            assert data["points_earned"] > 0
            print(f"    \033[94mCorrect flag: {data['points_earned']} points\033[0m")
        
        def test_double_solve():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/challenges/{self.challenge_id}/submit",
                json={"flag": "FLAG{comprehensive_test_flag}"}
            )
            data = resp.json()
            # Should either fail or give 0 points
            assert data.get("points_earned", 0) == 0 or data.get("already_solved", False)
        
        self.run_test(suite, "Submit wrong flag", test_submit_wrong_flag)
        self.run_test(suite, "Submit correct flag", test_submit_correct_flag)
        self.run_test(suite, "Double solve gives no points", test_double_solve)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Statistics Tests
    # -------------------------------------------------------------------------
    
    def test_statistics(self) -> TestSuite:
        suite = TestSuite("Statistics")
        print("\n\033[1m📋 Statistics Tests\033[0m")
        
        if not self.event_id:
            self.skip_test(suite, "All stats tests", "No event ID")
            return suite
        
        def test_live_stats():
            resp = self.client.get(f"{API_PREFIX}/events/{self.event_id}/stats")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert "total_participants" in data
            assert "total_submissions" in data
            print(f"    \033[94mParticipants: {data['total_participants']}, Submissions: {data['total_submissions']}\033[0m")
        
        def test_scoreboard():
            resp = self.client.get(f"{API_PREFIX}/events/{self.event_id}/scoreboard")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert "scoreboard" in data
            assert isinstance(data["scoreboard"], list)
        
        def test_my_stats():
            resp = self.client.get(f"{API_PREFIX}/events/{self.event_id}/my-stats")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            data = resp.json()
            assert "total_points" in data
            assert "challenges_solved" in data
            print(f"    \033[94mPoints: {data['total_points']}, Solved: {data['challenges_solved']}\033[0m")
        
        self.run_test(suite, "Get live statistics", test_live_stats)
        self.run_test(suite, "Get scoreboard", test_scoreboard)
        self.run_test(suite, "Get my stats", test_my_stats)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Pause/Resume/End Tests
    # -------------------------------------------------------------------------
    
    def test_event_control(self) -> TestSuite:
        suite = TestSuite("Event Control")
        print("\n\033[1m📋 Event Control Tests\033[0m")
        
        if not self.event_id:
            self.skip_test(suite, "All control tests", "No event ID")
            return suite
        
        def test_pause_event():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/pause",
                json={"paused": True, "reason": "Testing pause"}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "paused"
        
        def test_resume_event():
            resp = self.client.post(
                f"{API_PREFIX}/events/{self.event_id}/pause",
                json={"paused": False}
            )
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "running"
        
        def test_end_event():
            resp = self.client.post(f"{API_PREFIX}/events/{self.event_id}/end")
            assert resp.status_code == 200, f"Status: {resp.status_code}"
            assert resp.json()["status"] == "ended"
            print(f"    \033[94mEvent ended successfully\033[0m")
        
        self.run_test(suite, "Pause event", test_pause_event)
        self.run_test(suite, "Resume event", test_resume_event)
        self.run_test(suite, "End event", test_end_event)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Error Handling Tests
    # -------------------------------------------------------------------------
    
    def test_error_handling(self) -> TestSuite:
        suite = TestSuite("Error Handling")
        print("\n\033[1m📋 Error Handling Tests\033[0m")
        
        def test_nonexistent_event():
            resp = self.client.get(f"{API_PREFIX}/events/000000000000000000000000")
            assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        
        def test_invalid_event_type():
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
            
            resp = self.client.post(f"{API_PREFIX}/events/", json=event_data)
            assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"
        
        def test_missing_required_fields():
            event_data = {"name": "Incomplete Event"}
            resp = self.client.post(f"{API_PREFIX}/events/", json=event_data)
            assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"
        
        self.run_test(suite, "Non-existent event returns 404", test_nonexistent_event)
        self.run_test(suite, "Invalid event type rejected", test_invalid_event_type)
        self.run_test(suite, "Missing required fields rejected", test_missing_required_fields)
        
        self.suites.append(suite)
        return suite
    
    # -------------------------------------------------------------------------
    # Run All Tests
    # -------------------------------------------------------------------------
    
    def run_all(self) -> Tuple[int, int, int, int]:
        """Run all test suites and return (passed, failed, skipped, errors)"""
        self.test_health_check()
        self.test_authentication()
        self.test_challenge_setup()
        self.test_event_crud()
        self.test_event_lifecycle()
        self.test_event_registration()
        self.test_challenge_visibility()
        self.test_flag_submission()
        self.test_statistics()
        self.test_event_control()
        self.test_error_handling()
        
        total_passed = sum(s.passed for s in self.suites)
        total_failed = sum(s.failed for s in self.suites)
        total_skipped = sum(s.skipped for s in self.suites)
        total_errors = sum(s.errors for s in self.suites)
        
        return total_passed, total_failed, total_skipped, total_errors


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="PACSTAR EventService Test Suite")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for API")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    print("\033[1m")
    print("=" * 60)
    print("🧪 PACSTAR EventService Comprehensive Test Suite")
    print("=" * 60)
    print(f"\033[0m\033[94mTarget: {args.base_url}\033[0m")
    print(f"\033[94mTime: {datetime.now().isoformat()}\033[0m")
    
    client = APIClient(args.base_url, verbose=args.verbose)
    tests = EventServiceTests(client)
    
    try:
        passed, failed, skipped, errors = tests.run_all()
    except requests.exceptions.ConnectionError:
        print(f"\n\033[91m❌ ERROR: Could not connect to {args.base_url}\033[0m")
        print("Make sure the backend is running.")
        sys.exit(1)
    
    total = passed + failed + skipped + errors
    
    print("\n\033[1m")
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"\033[92m  ✅ Passed:  {passed}\033[0m")
    print(f"\033[91m  ❌ Failed:  {failed}\033[0m")
    print(f"\033[94m  ⏭️  Skipped: {skipped}\033[0m")
    print(f"\033[93m  ⚠️  Errors:  {errors}\033[0m")
    print(f"  📝 Total:   {total}")
    
    if failed == 0 and errors == 0:
        print("\n\033[92m🎉 ALL TESTS PASSED!\033[0m")
        sys.exit(0)
    else:
        print(f"\n\033[91m⚠️  {failed + errors} TESTS FAILED/ERRORED\033[0m")
        sys.exit(1)


if __name__ == "__main__":
    main()

