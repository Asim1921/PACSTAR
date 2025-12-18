"""
Pytest Configuration and Shared Fixtures

This file contains shared fixtures and configuration for the test suite.
"""

import pytest
import os

# Configure pytest
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    # Add integration marker to all tests in this directory by default
    for item in items:
        if "test_event_service" in item.nodeid:
            item.add_marker(pytest.mark.integration)


@pytest.fixture(scope="session")
def base_url():
    """Get base URL from environment or use default"""
    return os.environ.get("TEST_BASE_URL", "http://localhost:8001")


@pytest.fixture(scope="session")
def api_prefix():
    """API prefix"""
    return "/api/v1"

