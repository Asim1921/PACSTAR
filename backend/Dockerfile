# Dockerfile for PACSTAR Backend
# Production-grade FastAPI application with:
# - Authentication & RBAC
# - Challenge Management (Kubernetes & OpenStack)
# - Event Service (CTF Events & Cyber Exercises)
# - Team Management
# - Statistics & Live Dashboard

FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /app

# Install system dependencies (including build tools for netifaces/openstacksdk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    make \
    libffi-dev \
    libc6-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install kubectl for Kubernetes integration (optional - comment out if not needed)
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/ \
    || echo "kubectl installation skipped"

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create necessary directories
RUN mkdir -p uploads certs logs \
    && chmod 755 uploads certs logs

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash pacstar \
    && chown -R pacstar:pacstar /app
USER pacstar

# Expose port (default: 8000)
EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Labels for container metadata
LABEL maintainer="PACSTAR Team" \
    version="1.0.0" \
    description="PACSTAR Backend API - Authentication, Events, Challenges" \
    services="auth,events,challenges,teams,openstack,kubernetes"

# Run the application with uvicorn
# Use --workers for production (adjust based on CPU cores)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
