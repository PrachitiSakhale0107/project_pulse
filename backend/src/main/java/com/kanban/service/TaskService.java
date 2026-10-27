
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

    public TaskService(
            TaskRepository tasks,
            UserRepository users,
            TaskActivityRepository activities) {
        this.tasks = tasks;
        this.users = users;
        this.activities = activities;
    }

    // ================= LIST TASKS =================

    @Transactional(readOnly = true)
    public List<TaskResponse> list(AppUser current) {
        List<KanbanTask> all = tasks.findAllByOrderByUpdatedAtDesc();

        if (current.getRole() == Role.ADMIN) {
            return all.stream()
                    .map(TaskResponse::from)
                    .toList();
        }

        if (current.getRole() == Role.FACULTY) {
            return all.stream()
                    .filter(task -> belongsToFaculty(task, current))
                    .map(TaskResponse::from)
                    .toList();
        }

        return all.stream()
                .filter(task -> task.getAssignee() != null
                        && Objects.equals(
                                task.getAssignee().getId(),
                                current.getId()))
                .map(TaskResponse::from)
                .toList();
    }

    // ================= CREATE TASK =================

    @Transactional
    public TaskResponse create(TaskRequest req, AppUser actor) {
        requireRole(
                actor,
                Role.FACULTY,
                "Only Faculty can create and assign tasks.");

        if (req.status() != null
                && req.status() != TaskStatus.BACKLOG) {
            throw new IllegalArgumentException(
                    "New tasks must start in Backlog.");
        }

        KanbanTask task = new KanbanTask();

        task.setTitle(req.title().trim());
        task.setDescription(clean(req.description()));
        task.setPriority(
                req.priority() == null
                        ? Priority.MEDIUM
                        : req.priority());
        task.setDueDate(req.dueDate());
        task.setCreatedBy(actor);
        task.setAssignee(resolveAssignee(req.assigneeId()));
        task.setStatus(TaskStatus.BACKLOG);
        task.setEvidence(null);
        task.setSubmittedAt(null);
        task.setCompletedAt(null);

        KanbanTask saved = tasks.save(task);

        log(
                saved,
                actor,
                "TASK_CREATED",
                "Task created"
                        + (saved.getAssignee() == null
                                ? ""
                                : "; assigned to "
                                        + saved.getAssignee().getName()));

        return TaskResponse.from(saved);
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

        // Status must only be changed through the workflow methods.
        if (req.status() != null
                && req.status() != task.getStatus()) {
            throw new IllegalArgumentException(
                    "Use the status action to move a task. "
                            + "Members must submit evidence for review, "
                            + "and Faculty must use Review to approve "
                            + "or request changes.");
        }

        if (actor.getRole() == Role.FACULTY) {
            task.setAssignee(resolveAssignee(req.assigneeId()));
        } else if (req.assigneeId() != null
                && !Objects.equals(
                        req.assigneeId(),
                        task.getAssignee() == null
                                ? null
                                : task.getAssignee().getId())) {
            throw new AccessDeniedException(
                    "Only Faculty can assign or reassign tasks.");
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

        requireRole(
                actor,
                Role.MEMBER,
                "Only members can move tasks on the board.");

        if (task.getAssignee() == null
                || !Objects.equals(
                        task.getAssignee().getId(),
                        actor.getId())) {
            throw new AccessDeniedException(
                    "You can only move tasks assigned to you.");
        }

        if (status == null) {
            throw new IllegalArgumentException(
                    "Task status is required.");
        }

        if (status == TaskStatus.DONE) {
            throw new IllegalArgumentException(
                    "Only Faculty can approve a task to Done.");
        }

        TaskStatus current = task.getStatus();

        boolean allowed =
                (current == TaskStatus.BACKLOG
                        && status == TaskStatus.DOING)
                || (current == TaskStatus.REVIEW
                        && status == TaskStatus.DOING);

        if (!allowed) {
            throw new IllegalArgumentException(
                    "Allowed transitions are Backlog to Doing "
                            + "and Review back to Doing. "
                            + "To submit a task for review, "
                            + "use the evidence submission form.");
        }

        changeStatus(task, status, actor);

        return TaskResponse.from(tasks.save(task));
    }

    // ================= MEMBER EVIDENCE SUBMISSION =================

    @Transactional
    public TaskResponse submitForReview(
            Long id,
            EvidenceSubmissionRequest req,
            AppUser actor) {

        requireRole(
                actor,
                Role.MEMBER,
                "Only members can submit tasks for review.");

        KanbanTask task = get(id);

        // Only the assigned member may submit evidence.
        if (task.getAssignee() == null
                || !Objects.equals(
                        task.getAssignee().getId(),
                        actor.getId())) {
            throw new AccessDeniedException(
                    "You can only submit tasks assigned to you.");
        }

        // Evidence can only be submitted from Doing.
        if (task.getStatus() != TaskStatus.DOING) {
            throw new IllegalArgumentException(
                    "Only tasks in Doing can be submitted for review.");
        }

        if (req == null
                || req.evidence() == null
                || req.evidence().trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Please enter evidence before submitting for review.");
        }

        String evidence = req.evidence().trim();

        if (evidence.length() > 5000) {
            throw new IllegalArgumentException(
                    "Evidence cannot exceed 5000 characters.");
        }

        // Save evidence before moving the task into Review.
        task.setEvidence(evidence);
        task.setSubmittedAt(LocalDateTime.now());
        task.setCompletedAt(null);
        task.setStatus(TaskStatus.REVIEW);

        log(
                task,
                actor,
                "TASK_SUBMITTED_FOR_REVIEW",
                "Evidence submitted for Faculty review");

        // Both changes are saved in the same transaction.
        KanbanTask saved = tasks.save(task);

        return TaskResponse.from(saved);
    }

    // ================= FACULTY REVIEW =================

    @Transactional
    public TaskResponse review(
            Long id,
            ReviewRequest req,
            AppUser actor) {

        requireRole(
                actor,
                Role.FACULTY,
                "Only Faculty can review and approve tasks.");

        KanbanTask task = get(id);

        if (!belongsToFaculty(task, actor)) {
            throw new AccessDeniedException(
                    "You can only review tasks created by you.");
        }

        if (task.getStatus() != TaskStatus.REVIEW) {
            throw new IllegalArgumentException(
                    "Only tasks in Review can be reviewed.");
        }

        if (req == null || req.decision() == null) {
            throw new IllegalArgumentException(
                    "A review decision is required.");
        }

        // Never approve or process a review without evidence.
        if (task.getEvidence() == null
                || task.getEvidence().trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "This task has no submitted evidence. "
                            + "The task must return to Doing "
                            + "so the member can submit evidence.");
        }

        String decision =
                req.decision().trim().toUpperCase(Locale.ROOT);

        String comment = clean(req.comment());

        if ("APPROVE".equals(decision)) {

            task.setStatus(TaskStatus.DONE);
            task.setCompletedAt(LocalDateTime.now());

            log(
                    task,
                    actor,
                    "REVIEW_APPROVED",
                    comment == null
                            ? "Task approved by Faculty"
                            : comment);

        } else if ("CHANGES".equals(decision)) {

            if (comment == null) {
                throw new IllegalArgumentException(
                        "Please provide a comment explaining "
                                + "the changes required.");
            }

            task.setStatus(TaskStatus.DOING);
            task.setCompletedAt(null);

            // Clear the previous submission time.
            // Keep the evidence so the member can edit and resubmit it.
            task.setSubmittedAt(null);

            log(
                    task,
                    actor,
                    "CHANGES_REQUESTED",
                    comment);

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
        requireTaskVisible(task, actor);

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
                tasks.findAllByOrderByUpdatedAtDesc();

        if (current.getRole() == Role.FACULTY) {
            all = all.stream()
                    .filter(task -> belongsToFaculty(task, current))
                    .toList();

        } else if (current.getRole() == Role.MEMBER) {
            all = all.stream()
                    .filter(task -> task.getAssignee() != null
                            && Objects.equals(
                                    task.getAssignee().getId(),
                                    current.getId()))
                    .toList();
        }

        long total = all.size();
        long backlog = count(all, TaskStatus.BACKLOG);
        long doing = count(all, TaskStatus.DOING);
        long review = count(all, TaskStatus.REVIEW);
        long done = count(all, TaskStatus.DONE);

        LocalDate today = LocalDate.now();

        long overdue = all.stream()
                .filter(task -> task.getDueDate() != null
                        && task.getDueDate().isBefore(today)
                        && task.getStatus() != TaskStatus.DONE)
                .count();

        LocalDateTime since =
                LocalDateTime.now().minusDays(30);

        long throughput = all.stream()
                .filter(task -> task.getCompletedAt() != null
                        && !task.getCompletedAt().isBefore(since))
                .count();

        List<Long> cycles = all.stream()
                .filter(task -> task.getFirstStartedAt() != null
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

    // ================= HELPERS =================

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

    private AppUser resolveAssignee(Long assigneeId) {
        if (assigneeId == null) {
            return null;
        }

        AppUser assignee = users.findById(assigneeId)
                .orElseThrow(() ->
                        new NoSuchElementException(
                                "Selected member does not exist."));

        if (assignee.getRole() != Role.MEMBER
                || !assignee.isApproved()) {
            throw new IllegalArgumentException(
                    "The assignee must be an approved member.");
        }

        return assignee;
    }

    private boolean belongsToFaculty(
            KanbanTask task,
            AppUser faculty) {

        return task.getCreatedBy() != null
                && Objects.equals(
                        task.getCreatedBy().getId(),
                        faculty.getId());
    }

    private void requireCanEdit(
            KanbanTask task,
            AppUser actor) {

        if (actor.getRole() == Role.ADMIN) {
            throw new AccessDeniedException(
                    "Admin can monitor tasks but cannot edit them.");
        }

        if (actor.getRole() == Role.FACULTY) {
            if (!belongsToFaculty(task, actor)) {
                throw new AccessDeniedException(
                        "You can only edit tasks created by you.");
            }
            return;
        }

        if (actor.getRole() == Role.MEMBER) {
            requireTaskVisible(task, actor);
            return;
        }

        throw new AccessDeniedException(
                "You do not have permission to edit this task.");
    }

    private void requireTaskVisible(
            KanbanTask task,
            AppUser actor) {

        if (actor.getRole() == Role.ADMIN) {
            return;
        }

        if (actor.getRole() == Role.FACULTY) {
            if (!belongsToFaculty(task, actor)) {
                throw new AccessDeniedException(
                        "You cannot access tasks created by "
                                + "another Faculty member.");
            }
            return;
        }

        if (actor.getRole() == Role.MEMBER) {
            if (task.getAssignee() == null
                    || !Objects.equals(
                            task.getAssignee().getId(),
                            actor.getId())) {
                throw new AccessDeniedException(
                        "You can only access tasks assigned to you.");
            }
            return;
        }

        throw new AccessDeniedException(
                "You do not have permission to view this task.");
    }

    private void requireRole(
            AppUser actor,
            Role required,
            String message) {

        if (actor.getRole() != required) {
            throw new AccessDeniedException(message);
        }
    }

    private void changeStatus(
            KanbanTask task,
            TaskStatus status,
            AppUser actor) {

        TaskStatus previous = task.getStatus();

        if (status == TaskStatus.DOING
                && task.getFirstStartedAt() == null) {
            task.setFirstStartedAt(LocalDateTime.now());
        }

        if (status == TaskStatus.DOING
                && previous == TaskStatus.REVIEW) {
            // The previous submission has been returned for more work.
            task.setSubmittedAt(null);
        }

        if (status == TaskStatus.REVIEW) {
            // Review must normally be reached through submitForReview().
            // Keep this timestamp assignment for consistency.
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
        return value == null || value.trim().isEmpty()
                ? null
                : value.trim();
    }
}
