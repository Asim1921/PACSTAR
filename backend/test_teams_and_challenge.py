#!/usr/bin/env python3
"""
Test script to register 4 teams and create a simple Flask Hello World challenge
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}\n")

def print_test(text):
    print(f"🧪 {text}")

def print_success(text):
    print(f"✅ {text}")

def print_error(text):
    print(f"❌ {text}")

def register_team(team_id, username, email, zone):
    """Register a team"""
    register_data = {
        'username': username,
        'email': email,
        'password': 'team123456',
        'zone': zone
    }
    
    print(f"📝 Registering team {team_id}: {username}")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=10)
        if response.status_code == 201:
            print_success(f"Team {team_id} registered successfully")
            return True
        else:
            print_error(f"Team {team_id} registration failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Team {team_id} registration failed: {e}")
        return False

def login_team(username):
    """Login a team and get token"""
    login_data = {
        'username': username,
        'password': 'team123456'
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('access_token')
        else:
            print_error(f"Login failed for {username}: {response.status_code}")
            return None
    except Exception as e:
        print_error(f"Login failed for {username}: {e}")
        return None

def create_flask_challenge(token):
    """Create a simple Flask Hello World challenge"""
    challenge_data = {
        "name": "flask-hello-world",
        "description": "Simple Flask Hello World API challenge",
        "config": {
            "challenge_type": "web",
            "image": "python:3.9-slim",
            "ports": [5000],
            "environment_vars": {
                "FLASK_APP": "app.py",
                "FLASK_ENV": "development",
                "FLAG": "CTF{flask_hello_world_flag}",
                "SECRET_KEY": "challenge-secret-key"
            },
            "resources": {
                "requests": {"cpu": "100m", "memory": "128Mi"},
                "limits": {"cpu": "500m", "memory": "512Mi"}
            },
            "health_check_path": "/",
            "flag_format": "CTF{}"
        },
        "total_teams": 4,
        "is_active": True
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print_test("Creating Flask Hello World challenge...")
    try:
        response = requests.post(f"{BASE_URL}/challenges/", json=challenge_data, headers=headers)
        if response.status_code == 201:
            challenge = response.json()
            print_success(f"Challenge created with ID: {challenge['id']}")
            return challenge['id']
        else:
            print_error(f"Failed to create challenge: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print_error(f"Challenge creation failed: {e}")
        return None

def deploy_challenge(challenge_id, token):
    """Deploy the challenge to Kubernetes"""
    headers = {"Authorization": f"Bearer {token}"}
    deploy_data = {"force_redeploy": False}
    
    print_test(f"Deploying challenge {challenge_id} to Kubernetes...")
    try:
        response = requests.post(f"{BASE_URL}/challenges/{challenge_id}/deploy", 
                               json=deploy_data, headers=headers)
        if response.status_code == 200:
            challenge = response.json()
            print_success(f"Challenge deployed successfully!")
            print(f"   Status: {challenge['status']}")
            print(f"   Instances created: {len(challenge['instances'])}")
            
            # Display unique IPs for each team
            print(f"\n   📋 Team Access Information:")
            print(f"   {'Team ID':<15} {'Public IP':<18} {'Status':<10}")
            print(f"   {'-'*50}")
            for instance in challenge['instances']:
                print(f"   {instance['team_id']:<15} {instance['public_ip']:<18} {instance['status']:<10}")
            
            # Validate unique IPs
            ips = [inst['public_ip'] for inst in challenge['instances']]
            if len(ips) == len(set(ips)):
                print_success(f"\n   ✓ All teams have unique public IP addresses!")
            else:
                print_error(f"\n   ✗ Duplicate IP addresses detected!")
            
            return True
        else:
            print_error(f"Failed to deploy challenge: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Challenge deployment failed: {e}")
        return False

def main():
    print_header("PACSTAR Teams Registration & Flask Challenge Test")
    
    # Test server connectivity
    print_test("Testing server connectivity...")
    try:
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        if response.status_code == 200:
            print_success("Server is running and accessible")
        else:
            print_error("Server health check failed")
            return
    except Exception as e:
        print_error(f"Server connection failed: {e}")
        return
    
    # Register 4 teams
    print_test("Registering 4 teams...")
    teams = [
        ("team1", "team1", "team1@example.com", "zone1"),
        ("team2", "team2", "team2@example.com", "zone2"),
        ("team3", "team3", "team3@example.com", "zone3"),
        ("team4", "team4", "team4@example.com", "zone4")
    ]
    
    registered_teams = []
    for team_id, username, email, zone in teams:
        if register_team(team_id, username, email, zone):
            registered_teams.append(username)
    
    if not registered_teams:
        print_error("No teams were registered successfully")
        return
    
    print_success(f"Successfully registered {len(registered_teams)} teams")
    
    # Login as first team to create challenge
    print_test("Logging in as team1 to create challenge...")
    token = login_team("team1")
    if not token:
        print_error("Failed to login as team1")
        return
    
    print_success("Successfully logged in as team1")
    
    # Create Flask challenge
    challenge_id = create_flask_challenge(token)
    if not challenge_id:
        print_error("Failed to create challenge")
        return
    
    # Deploy challenge
    if deploy_challenge(challenge_id, token):
        print_success("Flask Hello World challenge deployed successfully!")
        print("\n🎯 Challenge Summary:")
        print("   - Challenge: Flask Hello World API")
        print("   - Teams: 4 teams registered")
        print("   - Deployment: Kubernetes with MetalLB")
        print("   - Access: Each team gets unique public IP")
        print("   - Port: 5000 (Flask default)")
        print("   - Health Check: / endpoint")
    else:
        print_error("Failed to deploy challenge")
    
    print_header("Test Completed!")

if __name__ == "__main__":
    main()
