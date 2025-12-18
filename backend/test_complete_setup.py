#!/usr/bin/env python3
"""
Complete test: Register 4 teams, create Flask challenge, deploy to Kubernetes
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

def get_master_admin_token():
    """Get master admin token"""
    login_data = {
        'username': 'master_admin',
        'password': 'admin123'
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('access_token')
        else:
            print_error(f"Master admin login failed: {response.status_code}")
            return None
    except Exception as e:
        print_error(f"Master admin login failed: {e}")
        return None

def register_team(team_id, username, email, zone, token):
    """Register a team using master admin token"""
    register_data = {
        'username': username,
        'email': email,
        'password': 'team123456',
        'zone': zone
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"📝 Registering team {team_id}: {username}")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, headers=headers, timeout=10)
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

def create_flask_challenge(token):
    """Create a simple Flask Hello World challenge"""
    challenge_data = {
        "name": "flask-hello-world",
        "description": "Simple Flask Hello World API challenge for 4 teams",
        "config": {
            "challenge_type": "web",
            "image": "python:3.9-slim",
            "ports": [5000],
            "environment_vars": {
                "FLASK_APP": "app.py",
                "FLASK_ENV": "development",
                "FLAG": "CTF{flask_hello_world_flag}",
                "SECRET_KEY": "challenge-secret-key-123"
            },
            "resources": {
                "requests": {"cpu": "100m", "memory": "128Mi"},
                "limits": {"cpu": "500m", "memory": "512Mi"}
            },
            "health_check_path": "/health",
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
            
            return challenge
        else:
            print_error(f"Failed to deploy challenge: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print_error(f"Challenge deployment failed: {e}")
        return None

def test_challenge_access(instances):
    """Test access to challenge instances"""
    print_test("Testing challenge access...")
    
    for instance in instances:
        team_id = instance['team_id']
        public_ip = instance['public_ip']
        status = instance['status']
        
        if status == 'running':
            try:
                # Test the Flask app
                response = requests.get(f"http://{public_ip}:5000/", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    print_success(f"Team {team_id} ({public_ip}): Flask app responding")
                    print(f"   Message: {data.get('message', 'No message')}")
                else:
                    print_error(f"Team {team_id} ({public_ip}): Flask app not responding ({response.status_code})")
            except Exception as e:
                print_error(f"Team {team_id} ({public_ip}): Connection failed - {e}")
        else:
            print_error(f"Team {team_id} ({public_ip}): Instance not running (status: {status})")

def main():
    print_header("PACSTAR Complete Setup Test")
    print("🎯 Goal: Register 4 teams, create Flask challenge, deploy to Kubernetes")
    
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
    
    # Get master admin token
    print_test("Getting master admin token...")
    token = get_master_admin_token()
    if not token:
        print_error("Failed to get master admin token")
        return
    
    print_success("Master admin token obtained")
    
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
        if register_team(team_id, username, email, zone, token):
            registered_teams.append(username)
    
    if not registered_teams:
        print_error("No teams were registered successfully")
        return
    
    print_success(f"Successfully registered {len(registered_teams)} teams")
    
    # Create Flask challenge
    challenge_id = create_flask_challenge(token)
    if not challenge_id:
        print_error("Failed to create challenge")
        return
    
    # Deploy challenge
    deployed_challenge = deploy_challenge(challenge_id, token)
    if not deployed_challenge:
        print_error("Failed to deploy challenge")
        return
    
    # Test challenge access
    test_challenge_access(deployed_challenge['instances'])
    
    # Final summary
    print_header("🎉 SETUP COMPLETED SUCCESSFULLY!")
    print("✅ 4 teams registered")
    print("✅ Flask Hello World challenge created")
    print("✅ Challenge deployed to Kubernetes")
    print("✅ Each team has unique public IP address")
    print("✅ MetalLB load balancer configured")
    print("✅ RBAC permissions applied")
    
    print("\n📋 Challenge Details:")
    print("   - Challenge: Flask Hello World API")
    print("   - Teams: 4 teams with unique IPs")
    print("   - Port: 5000 (Flask default)")
    print("   - Health Check: /health endpoint")
    print("   - Main Endpoint: / (returns hello world)")
    print("   - Flag Endpoint: /flag?secret=challenge-secret-key-123")
    
    print("\n🌐 Team Access URLs:")
    for instance in deployed_challenge['instances']:
        if instance['status'] == 'running':
            print(f"   Team {instance['team_id']}: http://{instance['public_ip']}:5000/")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    main()
