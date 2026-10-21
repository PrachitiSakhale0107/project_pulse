
package com.kanban.service;

import com.kanban.dto.ApiDtos.*;
import com.kanban.model.*;
import com.kanban.repository.*;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class TaskService {

    private final TaskRepository tasks;
    private final UserRepository users;
    private final TaskActivityRepository activities;
    private final TeamRepository teamRepository;

    public TaskService(
            TaskRepository tasks,
            UserRepository users,
            TaskActivityRepository activities,
            TeamRepository teamRepository) {

        this.tasks = tasks;
        this.users = users;
        this.activities = activities;
        this.teamRepository = teamRepository;
    }

    // ================= LIST TASKS =================

    @Transactional(readOnly = true)
    public List<TaskResponse> list(AppUser current) {

        List<KanbanTask> result =
                current.getRole() == Role.MEMBER
                        ? tasks.findByAssigneeIdOrderByUpdatedAtDesc(
                                current.getId())
                        : tasks.findAllByOrderByUpdatedAtDesc();

        return result.stream()
                .map(TaskResponse::from)
                .toList();
    }

    // ================= CREATE TASK =================

    @Transactional
    public TaskResponse create(TaskRequest req, AppUser actor) {

        Team team = resolveTeam(req.teamId(), actor);
        AppUser assignee = resolveAssignee(req.assigneeId());

        validateAssigneeForTeam(assignee, team);

        KanbanTask task = new KanbanTask();

        task.setTitle(req.title().trim());
        task.setDescription(clean(req.description()));
        task.setPriority(
                req.priority() == null
                        ? Priority.MEDIUM
                        : req.priority());
        task.setDueDate(req.dueDate());
        task.setCreatedBy(actor);
        task.setAssignee(assignee);
        task.setTeam(team);
        task.setStatus(TaskStatus.BACKLOG);

        KanbanTask saved = tasks.save(task);

        log(saved, actor, "TASK_CREATED", "Task created");

        if (req.status() != null
                && req.status() != TaskStatus.BACKLOG) {

            if (req.status() == TaskStatus.DONE) {
                throw new IllegalArgumentException(
                        "Only Faculty can approve a task from Review.");
            }

            changeStatus(saved, req.status(), actor);
        }

        return TaskResponse.from(tasks.save(saved));
    }

    // ================= UPDATE TASK =================

    @Transactional
    public TaskResponse update(
            Long id,
            TaskRequest req,
            AppUser actor) {

        KanbanTask task = get(id);

        requireCanEdit(task, actor);

        task.setTitle(req.title().trim());
        task.setDescription(clean(req.description()));

        if (req.priority() != null) {
            task.setPriority(req.priority());
        }

        task.setDueDate(req.dueDate());

        // Update team when a team ID is supplied.
        if (req.teamId() != null) {

            Team newTeam = resolveTeam(req.teamId(), actor);

            AppUser proposedAssignee =
                    actor.getRole() == Role.MEMBER
                            ? task.getAssignee()
                            : resolveAssignee(req.assigneeId());

            validateAssigneeForTeam(proposedAssignee, newTeam);

            task.setTeam(newTeam);
        }

        // Only non-members can change the assignee.
        if (actor.getRole() != Role.MEMBER) {

            AppUser assignee =
                    resolveAssignee(req.assigneeId());

            validateAssigneeForTeam(assignee, task.getTeam());

            task.setAssignee(assignee);
        }

        TaskStatus requested = req.status();

        if (requested != null && requested != task.getStatus()) {

            if (requested == TaskStatus.DONE) {
                throw new IllegalArgumentException(
                        "Only Faculty can approve a task from Review.");
            }

            changeStatus(task, requested, actor);
        }

        KanbanTask saved = tasks.save(task);

        log(saved, actor, "TASK_UPDATED", "Task details updated");

        return TaskResponse.from(saved);
    }

    // ================= CHANGE TASK STATUS =================

    @Transactional
    public TaskResponse move(
            Long id,
            TaskStatus status,
            AppUser actor) {

        KanbanTask task = get(id);

        requireCanEdit(task, actor);

        if (status == null) {
            throw new IllegalArgumentException(
                    "Task status is required.");
        }

        if (status == TaskStatus.DONE) {
            throw new IllegalArgumentException(
                    "Tasks must be approved by Faculty to move to Done.");
        }

        if (task.getStatus() == TaskStatus.REVIEW
                && actor.getRole() == Role.MEMBER
                && status != TaskStatus.DOING) {

            throw new IllegalArgumentException(
                    "Members can only withdraw a review submission back to Doing.");
        }

        changeStatus(task, status, actor);

        return TaskResponse.from(tasks.save(task));
    }

    // ================= FACULTY REVIEW =================

    @Transactional
    public TaskResponse review(
            Long id,
            ReviewRequest req,
            AppUser actor) {

        if (actor.getRole() != Role.FACULTY) {
            throw new AccessDeniedException(
                    "Only Faculty can review and approve tasks.");
        }

        KanbanTask task = get(id);

        // Faculty may only review tasks in their assigned teams.
        if (task.getTeam() != null
                && !Objects.equals(
                        task.getTeam().getFaculty().getId(),
                        actor.getId())) {

            throw new AccessDeniedException(
                    "You can only review tasks belonging to your teams.");
        }

        if (task.getStatus() != TaskStatus.REVIEW) {
            throw new IllegalArgumentException(
                    "Only tasks in Review can be reviewed.");
        }

        String decision =
                req.decision().trim().toUpperCase(Locale.ROOT);

        if (decision.equals("APPROVE")) {

            task.setStatus(TaskStatus.DONE);
            task.setCompletedAt(LocalDateTime.now());

            log(task, actor, "REVIEW_APPROVED", clean(req.comment()));

        } else if (decision.equals("CHANGES")) {

            task.setStatus(TaskStatus.DOING);
            task.setCompletedAt(null);

            log(task, actor, "CHANGES_REQUESTED", clean(req.comment()));

        } else {

            throw new IllegalArgumentException(
                    "Decision must be APPROVE or CHANGES.");
        }

        return TaskResponse.from(tasks.save(task));
    }

    // ================= TASK ACTIVITY =================

    @Transactional(readOnly = true)
    public List<ActivityResponse> activity(
            Long id,
            AppUser actor) {

        KanbanTask task = get(id);

        if (actor.getRole() == Role.MEMBER
                && !Objects.equals(
                        task.getAssignee() == null
                                ? null
                                : task.getAssignee().getId(),
                        actor.getId())) {

            throw new AccessDeniedException(
                    "You cannot view activity for this task.");
        }

        return activities.findByTaskIdOrderByCreatedAtDesc(id)
                .stream()
                .map(activity -> new ActivityResponse(
                        activity.getId(),
                        activity.getActor().getName(),
                        activity.getAction(),
                        activity.getComment(),
                        activity.getCreatedAt()))
                .toList();
    }

    // ================= ANALYTICS =================

    @Transactional(readOnly = true)
    public AnalyticsResponse analytics(AppUser current) {

        List<KanbanTask> all =
                current.getRole() == Role.MEMBER
                        ? tasks.findByAssigneeIdOrderByUpdatedAtDesc(
                                current.getId())
                        : tasks.findAll();

        long total = all.size();
        long backlog = count(all, TaskStatus.BACKLOG);
        long doing = count(all, TaskStatus.DOING);
        long review = count(all, TaskStatus.REVIEW);
        long done = count(all, TaskStatus.DONE);

        LocalDate today = LocalDate.now();

        long overdue = all.stream()
                .filter(task ->
                        task.getDueDate() != null
                        && task.getDueDate().isBefore(today)
                        && task.getStatus() != TaskStatus.DONE)
                .count();

        LocalDateTime since =
                LocalDateTime.now().minusDays(30);

        long throughput = all.stream()
                .filter(task ->
                        task.getCompletedAt() != null
                        && !task.getCompletedAt().isBefore(since))
                .count();

        List<Long> cycles = all.stream()
                .filter(task ->
                        task.getFirstStartedAt() != null
                        && task.getCompletedAt() != null)
                .map(task -> Math.max(
                        0,
                        ChronoUnit.MINUTES.between(
                                task.getFirstStartedAt(),
                                task.getCompletedAt())))
                .toList();

        Double averageCycleTime = cycles.isEmpty()
                ? null
                : Math.round(
                        cycles.stream()
                                .mapToLong(Long::longValue)
                                .average()
                                .orElse(0) / 1440.0 * 100.0)
                        / 100.0;

        double completionRate = total == 0
                ? 0
                : Math.round(done * 10000.0 / total) / 100.0;

        return new AnalyticsResponse(
                total,
                backlog,
                doing,
                review,
                done,
                overdue,
                throughput,
                completionRate,
                averageCycleTime);
    }

    // ================= HELPER METHODS =================

    private long count(
            List<KanbanTask> all,
            TaskStatus status) {

        return all.stream()
                .filter(task -> task.getStatus() == status)
                .count();
    }

    private KanbanTask get(Long id) {

        return tasks.findById(id)
                .orElseThrow(() ->
                        new NoSuchElementException(
                                "Task not found."));
    }

    private Team resolveTeam(Long teamId, AppUser actor) {

        if (teamId == null) {
            return null;
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Selected team does not exist."));

        if (actor.getRole() == Role.FACULTY
                && !Objects.equals(
                        team.getFaculty().getId(),
                        actor.getId())) {

            throw new AccessDeniedException(
                    "You can only manage tasks for your assigned teams.");
        }

        if (actor.getRole() == Role.MEMBER
                && team.getMembers().stream()
                        .noneMatch(member ->
                                Objects.equals(
                                        member.getId(),
                                        actor.getId()))) {

            throw new AccessDeniedException(
                    "You must belong to the selected team.");
        }

        return team;
    }

    private void validateAssigneeForTeam(
            AppUser assignee,
            Team team) {

        if (assignee == null || team == null) {
            return;
        }

        boolean belongsToTeam = team.getMembers().stream()
                .anyMatch(member ->
                        Objects.equals(
                                member.getId(),
                                assignee.getId()));

        if (!belongsToTeam) {
            throw new IllegalArgumentException(
                    "The selected assignee must belong to this team.");
        }
    }

    private AppUser resolveAssignee(Long id) {

        if (id == null) {
            return null;
        }

        return users.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Selected assignee does not exist."));
    }

    private void requireCanEdit(
            KanbanTask task,
            AppUser actor) {

        if (actor.getRole() == Role.ADMIN) {
            return;
        }

        if (actor.getRole() == Role.FACULTY) {

            if (task.getTeam() == null
                    || Objects.equals(
                            task.getTeam().getFaculty().getId(),
                            actor.getId())) {
                return;
            }

            throw new AccessDeniedException(
                    "You can only edit tasks belonging to your teams.");
        }

        if (!Objects.equals(
                    task.getAssignee() == null
                            ? null
                            : task.getAssignee().getId(),
                    actor.getId())) {

            throw new AccessDeniedException(
                    "You can only edit tasks assigned to you.");
        }
    }

    private void changeStatus(
            KanbanTask task,
            TaskStatus status,
            AppUser actor) {

        if (status == TaskStatus.DOING
                && task.getFirstStartedAt() == null) {

            task.setFirstStartedAt(LocalDateTime.now());
        }

        if (status == TaskStatus.REVIEW) {
            task.setSubmittedAt(LocalDateTime.now());
        }

        if (status != TaskStatus.DONE) {
            task.setCompletedAt(null);
        }

        task.setStatus(status);

        log(
                task,
                actor,
                "STATUS_CHANGED",
                "Status changed to " + status.name());
    }

    private void log(
            KanbanTask task,
            AppUser actor,
            String action,
            String comment) {

        activities.save(
                new TaskActivity(task, actor, action, comment));
    }

    private String clean(String value) {

        return value == null
                ? null
                : value.trim().isEmpty()
                        ? null
                        : value.trim();
    }
}
