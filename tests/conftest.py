"""Pytest fixtures and test environment configuration."""

import pytest
from starlette.testclient import TestClient
from main import app
from config import settings


@pytest.fixture
def client():
    """Create a FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def reset_settings():
    """Ensure settings are in a known state for tests."""
    original_provider = settings.EXPLANATION_PROVIDER
    original_key = settings.GEMINI_API_KEY
    yield
    settings.EXPLANATION_PROVIDER = original_provider
    settings.GEMINI_API_KEY = original_key
