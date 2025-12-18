# PACSTAR Authentication System

## 1. Directory Structure

<pre>
<span style="color:#00bcd4;">📦 pacstar-auth-service/</span>
├── <span style="color:#ff9800;">💻 backend/</span>                               <span style="color:#757575;"># FastAPI backend</span>
│   ├── <span style="color:#8bc34a;">📂 app/</span>
│   │   ├── <span style="color:#2196f3;">📂 api/</span>                           <span style="color:#757575;"># API routes</span>
│   │   │   └── <span style="color:#2196f3;">📂 v1/</span>                        <span style="color:#757575;"># Versioned APIs</span>
│   │   │       ├── <span style="color:#03a9f4;">📂 endpoints/</span>             <span style="color:#757575;"># Route handlers</span>
│   │   │       └── <span style="color:#9e9e9e;">📄 __init__.py</span>
│   │   ├── <span style="color:#4caf50;">⚙️ core/</span>                          <span style="color:#757575;"># Core configs</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 config.py</span>                  <span style="color:#757575;"># Core Env & settings</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 security.py</span>                <span style="color:#757575;"># Password, JWT, CORS, CSRF</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 logging.py</span>                 <span style="color:#757575;"># Logging & audit setup</span>
│   │   │   └── <span style="color:#9e9e9e;">📄 rate_limiter.py</span>            <span style="color:#757575;"># Brute force protection</span>
│   │   ├── <span style="color:#4caf50;">🗄️ db/</span>                            <span style="color:#757575;"># Database layer</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 init_db.py</span>                 <span style="color:#757575;"># Initial setup</span>
│   │   │   ├── <span style="color:#8bc34a;">📂 migrations/</span>                <span style="color:#757575;"># Migration scripts</span>
│   │   │   └── <span style="color:#8bc34a;">📂 models/</span>                    <span style="color:#757575;"># MongoDB models</span>
│   │   ├── <span style="color:#e91e63;">🧩 middleware/</span>                    <span style="color:#757575;"># Middlewares</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 rbac.py</span>                    <span style="color:#757575;"># Role-based Access controls</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 audit.py</span>                   <span style="color:#757575;"># Audit logging</span>
│   │   │   └── <span style="color:#9e9e9e;">📄 error_handler.py</span>           <span style="color:#757575;"># Secure Error Handling</span>
│   │   ├── <span style="color:#ffc107;">📑 schemas/</span>                       <span style="color:#757575;"># Pydantic Models</span>
│   │   ├── <span style="color:#ff5722;">🔧 services/</span>                      <span style="color:#757575;"># Buisness Logic</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 auth_service.py</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 user_service.py</span>
│   │   │   └── <span style="color:#9e9e9e;">📄 role_service.py</span>
│   │   ├── <span style="color:#9c27b0;">🛠️ utils/</span>                         <span style="color:#757575;"># Utilities</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 password_validator.py</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 token_utils.py</span>
│   │   │   └── <span style="color:#9e9e9e;">📄 sanitizer.py</span>               <span style="color:#757575;"># Input Sanitization</span>
│   │   ├── <span style="color:#673ab7;">🧪 tests/</span>                         <span style="color:#757575;"># Backend unit tests</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 test_auth.py</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 test_roles.py</span>
│   │   │   ├── <span style="color:#9e9e9e;">📄 test_rate_limit.py</span>
│   │   │   └── <span style="color:#9e9e9e;">📄 test_tls.py</span>
│   │   ├── <span style="color:#9e9e9e;">🚀 main.py</span>                        <span style="color:#757575;"># FastAPI entrypoint</span>
│   │   └── <span style="color:#9e9e9e;">📄 __init__.py</span>
│   ├── <span style="color:#9e9e9e;">📄 requirements.txt</span>
│   └── <span style="color:#9e9e9e;">📄 Dockerfile</span>
│
├── <span style="color:#03a9f4;">🔐 traefik/</span>                               <span style="color:#757575;"># Reverse proxy</span>
│   ├── <span style="color:#9e9e9e;">📄 traefik.yml</span>                        <span style="color:#757575;"># Static config (entryponts, providers)</span>
│   ├── <span style="color:#8bc34a;">📂 dynamic/</span>                           <span style="color:#757575;"># Dynamic configs</span>
│   │   ├── <span style="color:#9e9e9e;">📄 middleware.yml</span>                 <span style="color:#757575;"># Security headers, rate limits</span>
│   │   └── <span style="color:#9e9e9e;">📄 routers.yml</span>                    <span style="color:#757575;"># Routers and services</span>
│   ├── <span style="color:#ff9800;">📂 certs/</span>                             <span style="color:#757575;"># TLS certs</span>
│   │   ├── <span style="color:#9e9e9e;">📄 ca.crt</span>                         <span style="color:#757575;"># Local CA cert</span>
│   │   ├── <span style="color:#9e9e9e;">📄 ca.key</span>                         <span style="color:#757575;"># Local CA key</span>
│   │   ├── <span style="color:#9e9e9e;">📄 server.crt</span>                     <span style="color:#757575;"># Server cert</span>
│   │   └── <span style="color:#9e9e9e;">📄 server.key</span>                     <span style="color:#757575;"># Server key</span> 
│   └── <span style="color:#9e9e9e;">📄 Dockerfile</span>
│
├── <span style="color:#4caf50;">⚙️ deploy/</span>                                <span style="color:#757575;"># Deployment Automation</span>
│   ├── <span style="color:#9e9e9e;">📄 docker-compose.yml</span>                 <span style="color:#757575;"># Multi-service stack (FastAPI, Mongo, Traefik)</span>
│   ├── <span style="color:#9e9e9e;">📄 .env</span>                               <span style="color:#757575;"># Environment variables</span>
│   ├── <span style="color:#8bc34a;">📂 init/</span>                              <span style="color:#757575;"># Init scripts</span>
│   │   ├── <span style="color:#9e9e9e;">📄 generate_certs.sh</span>              <span style="color:#757575;"># Self-signed certs with SAN</span>
│   │   ├── <span style="color:#9e9e9e;">📄 renew_certs.sh</span>                 <span style="color:#757575;"># Renewal automation</span>
│   │   └── <span style="color:#9e9e9e;">📄 init_db.py</span>                     <span style="color:#757575;"># DB seeding (roles, admin/user)</span>
│   ├── <span style="color:#8bc34a;">📂 backup/</span>                            <span style="color:#757575;"># Backup & Recovery</span>
│   │   ├── <span style="color:#9e9e9e;">📄 mongo_backup.sh</span>
│   │   └── <span style="color:#9e9e9e;">📄 mongo_restore.sh</span>
│   └── <span style="color:#8bc34a;">📂 migration/</span>                         <span style="color:#757575;"># Schema update scripts</span>
│       ├── <span style="color:#9e9e9e;">📄 migrate_v1_to_v2.py</span>
│       └── <span style="color:#9e9e9e;">📄 rollback_v2_to_v1.py</span>
│
├── <span style="color:#2196f3;">📚 docs/</span>                                  <span style="color:#757575;"># Documentation</span>
│   ├── <span style="color:#9e9e9e;">📄 ARCHITECTURE.md</span>                    <span style="color:#757575;"># System Design</span>
│   ├── <span style="color:#9e9e9e;">📄 DEPLOYMENT.md</span>                      <span style="color:#757575;"># Deployment Guide</span>
│   ├── <span style="color:#9e9e9e;">📄 SECURITY.md</span>                        <span style="color:#757575;"># Security practices</span>
│   ├── <span style="color:#9e9e9e;">📄 API_REFERENCE.md</span>                   <span style="color:#757575;"># OpenAPI/Swagger details</span>
│   └── <span style="color:#9e9e9e;">📄 TESTING.md</span>                         <span style="color:#757575;"># Testing Strategy</span>
│
├── <span style="color:#673ab7;">🧪 tests/</span>                                 <span style="color:#757575;"># End-to-end & security tests</span>
│   ├── <span style="color:#8bc34a;">📂 e2e/</span>                               <span style="color:#757575;"># End-to-end auth flow tests</span>
│   ├── <span style="color:#8bc34a;">📂 performance/</span>                       <span style="color:#757575;"># Load testing scripts</span>
│   ├── <span style="color:#8bc34a;">📂 security/</span>                          <span style="color:#757575;"># Security scanning</span>
│   │   ├── <span style="color:#9e9e9e;">📄 test_bruteforce.sh</span>
│   │   ├── <span style="color:#9e9e9e;">📄 test_tls_config.sh</span>
│   │   └── <span style="color:#9e9e9e;">📄 test_sql_injection.py</span>
│   └── <span style="color:#8bc34a;">📂 integration/</span>                       <span style="color:#757575;"># Multi-service Integration tests</span>
│
└── <span style="color:#f44336;">⚡ ci-cd/</span>                                  <span style="color:#757575;"># CI/CD pipelines</span> 
    ├── <span style="color:#9e9e9e;">📄 github-actions.yml</span>                 <span style="color:#757575;"># GitHub Actions workflow</span>
    ├── <span style="color:#9e9e9e;">📄 gitlab-ci.yml</span>                      <span style="color:#757575;"># GitLab pipline (optional)</span>
    └── <span style="color:#8bc34a;">📂 scripts/</span>
        ├── <span style="color:#9e9e9e;">📄 run_tests.sh</span>
        ├── <span style="color:#9e9e9e;">📄 build_and_push.sh</span>
        └── <span style="color:#9e9e9e;">📄 deploy.sh</span>
</pre>


## Dynamic & Multi-Flag challenges
- Challenge config supports `mode` (`static`, `dynamic`, `multi_flag`), `architecture` (`kubernetes`, `openstack`), optional `flag_server`, `baydrak_service`, and per-flag entries when `mode=multi_flag`.
- Flags list entries: `{ name, mode (static|dynamic), value?, architecture }`.
- Legacy `challenge_category` is derived automatically; prefer `mode`/`architecture` in new requests.

## Flag server (HTTPS, RSA-OAEP)
- Endpoints: `/api/v1/flag-server/register-public-key` and `/api/v1/flag-server/get-encrypted-flag`.
- Security: bearer `FLAG_SERVER_TOKEN` required when set; flags are encrypted with RSA-OAEP-SHA256 using the registered public key.
- TLS: set `SSL_CERT_FILE` and `SSL_KEY_FILE` env vars to start uvicorn with local certificates (already wired in `start_server.py`); `FLAG_SERVER_CERT/KEY` settings are available if you need to mount certs in containers.

## Quick validation checklist
- Create static, dynamic, and multi-flag challenges; ensure architecture selector (Kubernetes/OpenStack) saves to the backend.
- For multi-flag, mix static/dynamic flags and confirm they are stored in `config.flags`.
- Register a public key via `/api/v1/flag-server/register-public-key` then fetch `/api/v1/flag-server/get-encrypted-flag` and decrypt with the registered private key.



