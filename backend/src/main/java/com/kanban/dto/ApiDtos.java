
package com.kanban.dto;

import com.kanban.model.*;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class ApiDtos {

    private ApiDtos() {}

    // Login request
    public record LoginRequest(
        @Email @NotBlank String email,
        @NotBlank String password
    ) {}

    // Individual member or Faculty registration
    public record RegisterRequest(
        @NotBlank @Size(max = 100) String name,
        @Email @NotBlank @Size(max = 150) String email,
        @NotBlank @Size(min = 6, max = 100) String password
    ) {}

    // User response
    public record UserResponse(
        Long id,
        String name,
        String email,
        Role role,
        boolean approved
    ) {
        public static UserResponse from(AppUser u) {
            return new UserResponse(
                u.getId(),
                u.getName(),
                u.getEmail(),
                u.getRole(),
                u.isApproved()
            );
        }
    }

    // Create or update task request
    public record TaskRequest(
        @NotBlank @Size(max = 140) String title,
        @Size(max = 2000) String description,
        Priority priority,
        LocalDate dueDate,
        Long assigneeId,
        TaskStatus status
    ) {}

    // Update task status request
    public record StatusRequest(
        @NotNull TaskStatus status
    ) {}

    // Member task evidence submission request
    public record EvidenceSubmissionRequest(
        @NotBlank(message = "Evidence is required before submitting for review.")
        @Size(max = 5000, message = "Evidence cannot exceed 5000 characters.")
        String evidence
    ) {}

    // Faculty task review request
    public record ReviewRequest(
        @NotBlank String decision,
        @Size(max = 1000) String comment
    ) {}

    // Task response
    public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskStatus status,
        Priority priority,
        LocalDate dueDate,
        Long assigneeId,
        String assigneeName,
        Long createdById,
        String createdByName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime firstStartedAt,
        LocalDateTime submittedAt,
        LocalDateTime completedAt,
        String evidence
    ) {
        public static TaskResponse from(KanbanTask t) {
            return new TaskResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                t.getStatus(),
                t.getPriority(),
                t.getDueDate(),
                t.getAssignee() == null ? null : t.getAssignee().getId(),
                t.getAssignee() == null ? null : t.getAssignee().getName(),
                t.getCreatedBy() == null ? null : t.getCreatedBy().getId(),
                t.getCreatedBy() == null ? null : t.getCreatedBy().getName(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getFirstStartedAt(),
                t.getSubmittedAt(),
                t.getCompletedAt(),
                t.getEvidence()
            );
        }
    }

    // Task activity response
    public record ActivityResponse(
        Long id,
        String actorName,
        String action,
        String comment,
        LocalDateTime createdAt
    ) {}

    // Dashboard analytics response
    public record AnalyticsResponse(
        long totalTasks,
        long backlog,
        long workInProgress,
        long waitingForReview,
        long done,
        long overdueTasks,
        long throughput30Days,
        double completionRate,
        Double averageCycleTimeDays
    ) {}

    // API error response
    public record ErrorResponse(String message) {}
}
