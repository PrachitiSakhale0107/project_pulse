
package com.kanban.dto;

import com.kanban.model.*;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ApiDtos {

    private ApiDtos() {}

    // Login request
    public record LoginRequest(
        @Email @NotBlank String email,
        @NotBlank String password
    ) {}

    // User registration request
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

    // Create team request
    public record TeamRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull Long facultyId,
        @NotEmpty List<@NotNull Long> memberIds
    ) {}

    // Team response
    public record TeamResponse(
        Long id,
        String name,
        Long facultyId,
        String facultyName,
        List<Long> memberIds,
        List<String> memberNames
    ) {
        public static TeamResponse from(Team team) {
            return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getFaculty().getId(),
                team.getFaculty().getName(),
                team.getMembers()
                    .stream()
                    .map(AppUser::getId)
                    .toList(),
                team.getMembers()
                    .stream()
                    .map(AppUser::getName)
                    .toList()
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
        TaskStatus status,
        Long teamId
    ) {}

    // Update task status request
    public record StatusRequest(
        @NotNull TaskStatus status
    ) {}

    // Faculty task review request
    public record ReviewRequest(
        @NotBlank String decision,
        @Size(max = 1000) String comment
    ) {}

    // Task response, including its team information
    public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskStatus status,
        Priority priority,
        LocalDate dueDate,
        Long teamId,
        String teamName,
        Long assigneeId,
        String assigneeName,
        Long createdById,
        String createdByName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime firstStartedAt,
        LocalDateTime submittedAt,
        LocalDateTime completedAt
    ) {
        public static TaskResponse from(KanbanTask t) {
            return new TaskResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                t.getStatus(),
                t.getPriority(),
                t.getDueDate(),

                // Team information
                t.getTeam() == null
                    ? null
                    : t.getTeam().getId(),

                t.getTeam() == null
                    ? null
                    : t.getTeam().getName(),

                // Assignee information
                t.getAssignee() == null
                    ? null
                    : t.getAssignee().getId(),

                t.getAssignee() == null
                    ? null
                    : t.getAssignee().getName(),

                // Creator information
                t.getCreatedBy().getId(),
                t.getCreatedBy().getName(),

                // Task timestamps
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getFirstStartedAt(),
                t.getSubmittedAt(),
                t.getCompletedAt()
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
