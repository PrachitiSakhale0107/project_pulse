
package com.kanban.controller;

import com.kanban.dto.ApiDtos.*;
import com.kanban.model.AppUser;
import com.kanban.repository.UserRepository;
import com.kanban.service.TaskService;

import jakarta.validation.Valid;

import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskService service;
    private final UserRepository users;

    public TaskController(TaskService service, UserRepository users) {
        this.service = service;
        this.users = users;
    }

    // Get the currently logged-in user
    private AppUser current(Authentication auth) {
        return users.findByEmailIgnoreCase(auth.getName())
                .orElseThrow();
    }

    // ================= LIST TASKS =================

    @GetMapping("/tasks")
    public List<TaskResponse> list(Authentication auth) {
        return service.list(current(auth));
    }

    // ================= CREATE TASK =================

    @PostMapping("/tasks")
    @PreAuthorize("hasRole('FACULTY')")
    public TaskResponse create(
            @Valid @RequestBody TaskRequest req,
            Authentication auth) {
        return service.create(req, current(auth));
    }

    // ================= UPDATE TASK =================

    @PutMapping("/tasks/{id}")
    public TaskResponse update(
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest req,
            Authentication auth) {
        return service.update(id, req, current(auth));
    }

    // ================= CHANGE TASK STATUS =================

    @PatchMapping("/tasks/{id}/status")
    @PreAuthorize("hasRole('MEMBER')")
    public TaskResponse move(
            @PathVariable Long id,
            @Valid @RequestBody StatusRequest req,
            Authentication auth) {
        return service.move(id, req.status(), current(auth));
    }

    // ================= SUBMIT TASK EVIDENCE =================

    @PostMapping("/tasks/{id}/submit-review")
    @PreAuthorize("hasRole('MEMBER')")
    public TaskResponse submitForReview(
            @PathVariable Long id,
            @Valid @RequestBody EvidenceSubmissionRequest req,
            Authentication auth) {
        return service.submitForReview(id, req, current(auth));
    }

    // ================= FACULTY REVIEW =================

    @PostMapping("/tasks/{id}/review")
    @PreAuthorize("hasRole('FACULTY')")
    public TaskResponse review(
            @PathVariable Long id,
            @Valid @RequestBody ReviewRequest req,
            Authentication auth) {
        return service.review(id, req, current(auth));
    }

    // ================= TASK ACTIVITY =================

    @GetMapping("/tasks/{id}/activity")
    public List<ActivityResponse> activity(
            @PathVariable Long id,
            Authentication auth) {
        return service.activity(id, current(auth));
    }

    // ================= ANALYTICS =================

    @GetMapping("/analytics")
    public AnalyticsResponse analytics(Authentication auth) {
        return service.analytics(current(auth));
    }
}
