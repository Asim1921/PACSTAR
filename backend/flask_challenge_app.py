#!/usr/bin/env python3
"""
Simple Flask Hello World application for challenge testing
This will be containerized and deployed to Kubernetes
"""

from flask import Flask, jsonify, request
import os

app = Flask(__name__)

# Get configuration from environment variables
FLAG = os.getenv('FLAG', 'CTF{default_flag}')
SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret')

@app.route('/')
def hello_world():
    """Main endpoint - returns hello world message"""
    return jsonify({
        'message': 'Hello World from Flask Challenge!',
        'status': 'running',
        'challenge': 'Flask Hello World',
        'version': '1.0.0'
    })

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'flask-challenge'
    })

@app.route('/info')
def info():
    """Information endpoint"""
    return jsonify({
        'challenge_name': 'Flask Hello World',
        'description': 'A simple Flask API challenge',
        'endpoints': [
            '/ - Main hello world endpoint',
            '/health - Health check',
            '/info - This information',
            '/flag - Get the flag (if you know the secret)'
        ]
    })

@app.route('/flag')
def get_flag():
    """Flag endpoint - requires secret key"""
    secret = request.args.get('secret', '')
    if secret == SECRET_KEY:
        return jsonify({
            'flag': FLAG,
            'message': 'Congratulations! You found the flag!'
        })
    else:
        return jsonify({
            'error': 'Invalid secret key',
            'hint': 'Try to find the secret key in the environment or source code'
        }), 401

@app.route('/debug')
def debug():
    """Debug endpoint - shows environment info (for testing)"""
    return jsonify({
        'environment_vars': {
            'FLAG': FLAG,
            'SECRET_KEY': SECRET_KEY,
            'FLASK_ENV': os.getenv('FLASK_ENV', 'production')
        },
        'note': 'This endpoint should be removed in production'
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
