CREATE DATABASE IF NOT EXISTS kanban_team_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kanban_team_db;
-- Hibernate/JPA creates the users, tasks, and task_activity tables at startup.
-- This file intentionally contains only database setup; do not maintain a second schema manually.
