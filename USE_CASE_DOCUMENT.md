# Use Case Document
## PACSTAR CTF Platform

**Version:** 1.0.0  
**Date:** December 2024  
**Project:** PACSTAR - Platform for Advanced Cybersecurity Training and Assessment Resource

---

## Document Control

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0.0 | December 2024 | Development Team | Initial Use Case Document for PACSTAR CTF Platform |

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | December 2024 | Initial release | Development Team |

---

## 1. Introduction

PACSTAR is a comprehensive web-based Capture The Flag (CTF) platform designed to facilitate cybersecurity training and competitions. The system enables organizations to create, deploy, and manage cybersecurity challenges across multiple deployment types including containerized applications, static file-based challenges, and OpenStack-based virtual machine deployments.

The platform automates challenge deployment to Kubernetes and OpenStack infrastructures, supports team formation and collaborative competition, implements real-time scoring and leaderboard systems, and provides comprehensive administrative dashboards. PACSTAR is built using modern web technologies including Next.js 14 for the frontend, FastAPI for the backend, MongoDB for data persistence, with integration to Kubernetes for container orchestration and OpenStack for cloud-based challenge deployments. The system implements secure JWT-based authentication, role-based access control, and comprehensive audit logging for security and compliance.

---

## 2. Authentication Module

### 2.1 Module-Use Case Diagram

The Authentication Module handles user registration, login, session management, and role-based access control. The module supports three user roles: Master Administrator, Administrator, and Regular User, each with different access levels and capabilities.

### 2.1.1 Nomenclature

**Use Case IDs:**
- PACSTAR-UC-AUTH-001: User Registration
- PACSTAR-UC-AUTH-002: User Login
- PACSTAR-UC-AUTH-003: User Logout
- PACSTAR-UC-AUTH-004: Token Refresh

### 2.1.2 Actor Description

| ACTOR | DESCRIPTION |
|-------|-------------|
| **Guest User** | Unauthenticated user accessing the platform for registration or viewing public information |
| **Registered User** | Authenticated user with basic access to view challenges, submit flags, and participate in competitions |
| **Team Leader** | Registered user who has created or leads a team with additional team management capabilities |
| **Administrator** | User with administrative privileges for challenge and team management |
| **Master Administrator** | Highest privilege user with full system access including user management and infrastructure operations |

### 2.1.3 Workflow Diagram

The authentication workflow begins with unauthenticated users accessing the login page. Users can either register a new account or login with existing credentials. Upon successful authentication, the system generates JWT tokens (access token and refresh token) and redirects users to the dashboard based on their role. The access token is used for API authentication with 15-minute expiration, while the refresh token enables token renewal without re-authentication. Session management continues until explicit logout or token expiration.

### 2.1.4 Display Resolution

The display resolution of the application is optimized for 1920x1080 (Full HD) with responsive design supporting minimum resolution of 1280x720. The interface utilizes a dark cyber-themed design with glassmorphism effects, neon accents, and terminal-style borders, ensuring optimal visual experience across modern web browsers.

### 2.1.5 Home Page Menu

| MENU | PAGE |
|------|------|
| **Login** | Authentication page with username and password fields |
| **Register** | Registration page with user details and team options |
| **Dashboard** | User dashboard (accessible after authentication) |
| **Challenges** | Available challenges list (user view) |
| **Scoreboard** | Team rankings and statistics |
| **Admin Panel** | Administrative interface (Admin/Master roles only) |

The pull-down menus on admin pages include User Management, Challenge Management, Dockerfile to Kubernetes conversion, OpenStack management, and System Statistics.

### 2.1.6 Use Cases

**Authentication Module Use Cases:**
- PACSTAR-UC-AUTH-001: User Registration
- PACSTAR-UC-AUTH-002: User Login
- PACSTAR-UC-AUTH-003: User Logout
- PACSTAR-UC-AUTH-004: Password Reset (Future)

---

## 3. Challenge Management Module

### 3.1 Module-Use Case Diagram

The Challenge Management Module enables creation, deployment, monitoring, and management of cybersecurity challenges. The module supports three challenge types: containerized challenges deployed to Kubernetes, static file challenges for download, and OpenStack Heat template challenges for VM-based scenarios.

### 3.1.1 Nomenclature

**Use Case IDs:**
- PACSTAR-UC-CHAL-001: Create Challenge
- PACSTAR-UC-CHAL-002: Deploy Challenge
- PACSTAR-UC-CHAL-003: Start Challenge Instance
- PACSTAR-UC-CHAL-004: View Challenge Details
- PACSTAR-UC-CHAL-005: Submit Flag
- PACSTAR-UC-CHAL-006: Reset Challenge Instance

### 3.1.2 Actor Description

| ACTOR | DESCRIPTION |
|-------|-------------|
| **Administrator** | Creates and configures challenges, monitors deployment status, manages challenge lifecycle |
| **Master Administrator** | Full challenge management including infrastructure operations and system configuration |
| **Registered User** | Views available challenges, starts challenge instances, submits flags, monitors progress |

### 3.1.3 Workflow Diagram

Challenge management workflow begins with administrators creating challenge definitions including challenge name, description, category, flag values, points, and deployment configuration. For containerized challenges, administrators can upload Dockerfiles or build images. For OpenStack challenges, Heat templates are uploaded with parameter specifications. Upon challenge activation, users can start challenge instances which triggers automated deployment to appropriate infrastructure. The system provisions isolated instances per team, assigns unique access information, and monitors instance status. Users interact with challenges, solve problems, and submit flags which are validated against stored flags. Successful submissions award points and update the scoreboard in real-time.

### 3.1.4 Display Resolution

Same as Section 2.1.4

### 3.1.5 Home Page Menu

| MENU | PAGE |
|------|------|
| **Available Challenges** | List of active challenges with status and difficulty |
| **Challenge Details** | Detailed challenge information and access instructions |
| **Admin Challenges** | Challenge management interface (Admin/Master only) |
| **Create Challenge** | Challenge creation form (Admin/Master only) |

### 3.1.6 Use Cases

**Challenge Management Module Use Cases:**
- PACSTAR-UC-CHAL-001: Create Challenge
- PACSTAR-UC-CHAL-002: Deploy Challenge to Infrastructure
- PACSTAR-UC-CHAL-003: Start Challenge Instance
- PACSTAR-UC-CHAL-004: View Challenge Details
- PACSTAR-UC-CHAL-005: Submit Flag
- PACSTAR-UC-CHAL-006: Reset Challenge Instance

---

## 4. Team Management Module

### 4.1 Module-Use Case Diagram

The Team Management Module facilitates team formation, member management, and collaborative competition participation. Teams enable multiple users to work together, share challenge access, and compete as a group.

### 4.1.1 Nomenclature

**Use Case IDs:**
- PACSTAR-UC-TEAM-001: Create Team
- PACSTAR-UC-TEAM-002: Join Team
- PACSTAR-UC-TEAM-003: View Team Details
- PACSTAR-UC-TEAM-004: Manage Team Members

### 4.1.2 Actor Description

| ACTOR | DESCRIPTION |
|-------|-------------|
| **Team Leader** | Creates teams, manages team membership, views team statistics and performance |
| **Team Member** | Joins teams via team codes, participates in team challenges, views team information |
| **Administrator** | Views all teams, manages team settings, monitors team activities |

### 4.1.3 Workflow Diagram

Team management workflow allows users to create new teams during registration or from the dashboard, generating unique team codes for invitation. Users can join existing teams by entering team codes. Team leaders can view team members, team statistics, and manage membership. Team information includes member list, team leader designation, creation timestamp, and associated zone. All team members share challenge instances and scoring, with team points aggregated for leaderboard rankings.

### 4.1.4 Display Resolution

Same as Section 2.1.4

### 4.1.5 Home Page Menu

| MENU | PAGE |
|------|------|
| **My Team** | Current team information and members |
| **Create Team** | Team creation interface |
| **Join Team** | Team joining via code entry |

### 4.1.6 Use Cases

**Team Management Module Use Cases:**
- PACSTAR-UC-TEAM-001: Create Team
- PACSTAR-UC-TEAM-002: Join Team
- PACSTAR-UC-TEAM-003: View Team Details

---

## 5. Detailed Use Cases

### 5.1 PACSTAR-UC-AUTH-001: User Registration

**USE CASE ID:** PACSTAR-UC-AUTH-001  
**DIFFICULTY:** Easy  
**OVERVIEW:** This use case describes the process of registering a new user account in the PACSTAR platform, including individual registration, team creation, or joining existing teams.

**ACTOR:** Guest User

**PRE-CONDITIONS:**
- User has access to the registration page
- User has valid email address and username
- System is operational and accessible

**POST-CONDITIONS:**
- New user account is created in the system
- User is authenticated and redirected to dashboard
- User profile is stored in database
- If team creation selected, team is created with user as leader
- If team code provided, user is added to existing team

**GRAPHICAL USER INTERFACE:**
The registration interface displays a dark cyber-themed form with the following fields: username (alphanumeric, required), email address (valid email format, required), password (minimum complexity requirements, required), password confirmation (must match password, required), registration type selection (radio buttons: Join Team, Create Team, Individual), team code field (conditional, shown when "Join Team" selected), team name field (conditional, shown when "Create Team" selected), and zone selection dropdown (shown when "Individual" selected). The interface includes validation messages, loading indicators during submission, and error messages for failed registrations.

**MAIN FLOW:**
1. User navigates to registration page
2. System displays registration form
3. User enters username, email, and password
4. User selects registration type (Join Team, Create Team, or Individual)
5. Based on selection, appropriate fields are displayed
6. If "Join Team" selected, user enters team code
7. If "Create Team" selected, user enters team name
8. If "Individual" selected, user selects zone
9. User submits registration form
10. System validates all input fields
11. System checks username and email uniqueness
12. If team code provided, system validates code existence and capacity
13. System creates user account with hashed password
14. If team creation requested, system creates team and assigns user as leader
15. If team code provided, system adds user to team
16. System generates JWT tokens
17. System stores tokens and user profile in browser localStorage
18. System redirects user to dashboard

**ALTERNATIVE FLOWS:**
- If username or email already exists, system displays error message and user can modify input
- If team code is invalid, system displays error and user can enter correct code
- If team is full, system displays error and user can select different team
- If validation fails, system highlights invalid fields and displays specific error messages

---

### 5.2 PACSTAR-UC-AUTH-002: User Login

**USE CASE ID:** PACSTAR-UC-AUTH-002  
**DIFFICULTY:** Easy  
**OVERVIEW:** This use case describes the authentication process allowing registered users to access the PACSTAR platform using username and password credentials.

**ACTOR:** Registered User

**PRE-CONDITIONS:**
- User has registered account in the system
- User has valid username and password
- User is not currently authenticated

**POST-CONDITIONS:**
- User is authenticated and logged into the system
- JWT access and refresh tokens are generated and stored
- User is redirected to dashboard based on role
- User session is established

**GRAPHICAL USER INTERFACE:**
The login interface displays a dark cyber-themed form with username input field (required), password input field (required, masked), login button, link to registration page, and error message area for authentication failures. The interface includes animated particle background and loading indicators during authentication process.

**MAIN FLOW:**
1. User navigates to login page
2. System displays login form
3. User enters username and password
4. User clicks login button
5. System validates input fields are not empty
6. System sends credentials to backend API
7. Backend validates credentials against database
8. Backend verifies password hash
9. Backend generates JWT access token (15-minute expiry) and refresh token
10. Backend returns tokens and user profile
11. System stores tokens in browser localStorage
12. System fetches complete user profile from /auth/me endpoint
13. System stores user profile in localStorage
14. System redirects user to dashboard
15. Dashboard loads based on user role

**ALTERNATIVE FLOWS:**
- If credentials are invalid, system displays error message "Invalid username or password"
- If account is inactive, system displays error message "Account is inactive"
- If network error occurs, system displays connection error message
- If user already authenticated, system redirects to dashboard

---

### 5.3 PACSTAR-UC-CHAL-005: Submit Flag

**USE CASE ID:** PACSTAR-UC-CHAL-005  
**DIFFICULTY:** Medium  
**OVERVIEW:** This use case describes the process where users submit flags they have discovered by solving challenges, with validation, scoring, and leaderboard updates.

**ACTOR:** Registered User, Team Member

**PRE-CONDITIONS:**
- User is authenticated and logged in
- User has started a challenge instance
- User has discovered a flag through challenge solving
- Challenge is active and accepting submissions

**POST-CONDITIONS:**
- Flag submission is recorded in database
- If flag is correct, points are awarded to user's team
- Scoreboard is updated in real-time
- User receives feedback on submission result
- Submission history is maintained

**GRAPHICAL USER INTERFACE:**
The flag submission interface displays challenge name, flag input field with placeholder text, submit button with loading state, submission status message area (success/error), previous submission history if any, and points awarded notification for correct submissions. The interface uses neon green accents for success states and orange/red for error states.

**MAIN FLOW:**
1. User navigates to challenge details page
2. User has started challenge instance and obtained access information
3. User solves challenge and discovers flag
4. User enters flag in submission field
5. User clicks submit button
6. System validates flag input is not empty
7. System sends flag submission to backend API with challenge ID
8. Backend retrieves correct flag for challenge
9. Backend compares submitted flag with stored flag (case-insensitive comparison)
10. If flag matches:
    a. Backend checks if team already submitted correct flag for this challenge
    b. If not previously solved, backend awards points to team
    c. Backend records submission with success status
    d. Backend updates team's total points
    e. Backend updates solve count for challenge
    f. Backend returns success response with points awarded
    g. System displays success message with points
    h. System updates scoreboard display
11. If flag does not match:
    a. Backend records submission with failure status
    b. Backend returns error response
    c. System displays error message "Incorrect flag"
12. System logs submission attempt in submission history

**ALTERNATIVE FLOWS:**
- If flag already submitted by team, system displays message "Challenge already solved by your team"
- If challenge is inactive, system displays error "Challenge is not active"
- If user not part of team, system displays error "Team membership required"
- If network error occurs, system displays connection error and allows retry

---

### 5.4 PACSTAR-UC-CHAL-003: Start Challenge Instance

**USE CASE ID:** PACSTAR-UC-CHAL-003  
**DIFFICULTY:** Medium  
**OVERVIEW:** This use case describes the process where users initiate challenge instances, triggering automated deployment to appropriate infrastructure (Kubernetes or OpenStack) and providing access information.

**ACTOR:** Registered User, Team Member

**PRE-CONDITIONS:**
- User is authenticated and logged in
- User belongs to a team (for team-based challenges)
- Challenge exists and is active
- User has not already started this challenge
- Infrastructure resources are available

**POST-CONDITIONS:**
- Challenge instance is deployed to infrastructure
- User's team receives unique access information
- Challenge instance status is tracked
- Access credentials or URLs are provided
- Instance lifecycle is managed by system

**GRAPHICAL USER INTERFACE:**
The challenge start interface displays challenge card with name, description, category, difficulty, and points. Start button with loading state during deployment, status indicator showing deployment progress, access information panel displayed after successful deployment (IP addresses, URLs, credentials as applicable), and error messages for deployment failures. The interface updates dynamically as deployment progresses.

**MAIN FLOW:**
1. User navigates to Available Challenges page
2. System displays list of active challenges
3. User selects a challenge to view details
4. User clicks "Start Challenge" button
5. System validates user has team membership (if required)
6. System checks if team already has active instance for this challenge
7. System sends start request to backend API
8. Backend determines challenge category (containerized, static, or openstack)
9. For containerized challenges:
    a. Backend creates Kubernetes deployment manifest
    b. Backend deploys container to Kubernetes cluster
    c. Backend creates Kubernetes service for access
    d. Backend obtains service endpoint (IP or URL)
    e. Backend stores instance information in database
10. For OpenStack challenges:
    a. Backend validates Heat template
    b. Backend deploys Heat stack with team-specific parameters
    c. Backend retrieves stack outputs (Floating IP, VNC URL, etc.)
    d. Backend stores instance information in database
11. For static challenges:
    a. Backend provides download links immediately
12. Backend returns access information to frontend
13. System displays access information to user
14. System updates challenge status to "Started"
15. System enables flag submission interface

**ALTERNATIVE FLOWS:**
- If infrastructure unavailable, system displays error "Infrastructure temporarily unavailable"
- If team already has active instance, system displays existing access information
- If challenge requires team but user has no team, system prompts to create/join team
- If deployment fails, system displays error message and allows retry
- If deployment timeout occurs, system displays error and logs issue for administrator

---

### 5.5 PACSTAR-UC-TEAM-001: Create Team

**USE CASE ID:** PACSTAR-UC-TEAM-001  
**DIFFICULTY:** Easy  
**OVERVIEW:** This use case describes the process of creating a new team, either during registration or from the dashboard, with automatic team code generation and leader assignment.

**ACTOR:** Registered User

**PRE-CONDITIONS:**
- User is authenticated
- User is not currently part of a team (or leaving current team allowed)
- System is operational

**POST-CONDITIONS:**
- New team is created in database
- User is assigned as team leader
- Unique team code is generated
- Team record is associated with user
- Team becomes available for member invitations

**GRAPHICAL USER INTERFACE:**
The team creation interface displays team name input field (required, alphanumeric with length validation), team description text area (optional), create team button, team code display area (shown after creation), copy team code button for sharing, and success confirmation message. The interface uses cyber-themed styling with neon accents.

**MAIN FLOW:**
1. User navigates to team management section or selects "Create Team" during registration
2. System displays team creation form
3. User enters team name
4. User optionally enters team description
5. User clicks "Create Team" button
6. System validates team name is not empty and meets format requirements
7. System checks team name uniqueness
8. System generates unique team code (alphanumeric, 8 characters)
9. System creates team record in database with:
    - Team name
    - Team code
    - Leader ID (current user)
    - Creation timestamp
    - Member list (containing creator)
10. System assigns user as team leader
11. System updates user's team association
12. System returns team information including team code
13. System displays team code to user
14. System provides option to copy team code
15. System redirects to team details page or dashboard

**ALTERNATIVE FLOWS:**
- If team name already exists, system displays error and user can choose different name
- If user already in team, system prompts to leave current team first
- If validation fails, system highlights invalid fields
- If database error occurs, system displays error and allows retry

---

**Document End**

*This Use Case Document provides detailed specifications for key user interactions with the PACSTAR CTF Platform. Additional use cases for administrative functions, infrastructure management, and advanced features are documented in the system design documentation.*

