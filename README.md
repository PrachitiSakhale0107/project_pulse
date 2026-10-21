# Kanban Team Project

Full-stack Kanban workflow app for a college project.

## Technology
- Frontend: HTML5, CSS3, vanilla JavaScript
- Backend: Java 17+, Spring Boot 3.3.5, Maven
- Database: MySQL 8+
- Authentication: Spring Security + server-side session cookie; passwords are BCrypt-hashed

## Features
- Roles: ADMIN, FACULTY, MEMBER
- Login/logout and role-protected APIs
- Create, assign, edit, and move tasks across Backlog, Doing, Review, Done
- Submit work for review; faculty/admin can approve or request changes
- Activity history for task events
- Analytics: status totals, overdue tasks, throughput, and average cycle time
- Demo users are created automatically on first run (change passwords before any real use)

## 1. Requirements
Install:
1. JDK 17 or later
2. Maven 3.9+ (or use the Maven wrapper if you add one)
3. MySQL Server 8+
4. VS Code extensions: Extension Pack for Java, Spring Boot Extension Pack (optional), Live Server

Check in PowerShell:
```powershell
java -version
mvn -version
mysql --version
```

## 2. Create the database
Open MySQL Workbench or MySQL command line and run:
```sql
CREATE DATABASE kanban_team_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Update `backend/src/main/resources/application.properties` with your local MySQL username/password. Do not commit real passwords.

## 3. Run backend
In VS Code, open the `Kanban_Team_Project` folder. In a terminal:
```powershell
cd backend
mvn spring-boot:run
```
Backend runs at `http://localhost:8080`. Hibernate creates the tables automatically.

If `mvn` is not recognized, install Maven and add its `bin` folder to PATH, then close and reopen VS Code. Alternatively use the Maven support in VS Code or generate a Maven wrapper.

## 4. Run frontend
Open `frontend/index.html` with VS Code Live Server. It should run at `http://127.0.0.1:5500` or `http://localhost:5500`.
Do not open the HTML file directly as `file://`; use Live Server so browser cookies and API requests work consistently.

## 5. Demo login accounts
These demo accounts are seeded on startup:
- Admin: `admin@kanban.local` / `Admin@123`
- Faculty: `faculty@kanban.local` / `Faculty@123`
- Member: `member@kanban.local` / `Member@123`

Use only for local demonstration. Change/remove demo credentials before deployment.

## 6. Workflow
- Member creates a task or opens a task assigned to them, then moves it to Doing.
- When work is ready, move it to Review. This records the submission time.
- Faculty/Admin approve it (moves it to Done) or request changes (moves it back to Doing).
- The Analytics tab refreshes its metrics from the backend.

## 7. API overview
All endpoints are under `/api`.
- `POST /auth/login` JSON `{ "email": "...", "password": "..." }`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /users` (admin/faculty)
- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/{id}`
- `PATCH /tasks/{id}/status` JSON `{ "status": "DOING" }`
- `POST /tasks/{id}/review` JSON `{ "decision": "APPROVE" }` or `{ "decision": "CHANGES" }`
- `GET /analytics`
- `GET /tasks/{id}/activity`

## Notes
This is a college-project starter, not a production-ready SaaS. For production, add HTTPS, secret management, account provisioning, stronger validation/rate limiting, audit retention, backups, and a deployment-specific CORS/CSRF strategy.
