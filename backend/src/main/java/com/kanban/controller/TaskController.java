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

    private AppUser current(Authentication auth) {
        return users.findByEmailIgnoreCase(auth.getName()).orElseThrow();
    }

    @GetMapping("/tasks")
    public List<TaskResponse> list(Authentication auth) {
        return service.list(current(auth));
    }

    @PostMapping("/tasks")
    public TaskResponse create(
            @Valid @RequestBody TaskRequest req,
            Authentication auth) {
        return service.create(req, current(auth));
    }

    @PutMapping("/tasks/{id}")
    public TaskResponse update(
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest req,
            Authentication auth) {
        return service.update(id, req, current(auth));
    }

    @PatchMapping("/tasks/{id}/status")
    public TaskResponse move(
            @PathVariable Long id,
            @Valid @RequestBody StatusRequest req,
            Authentication auth) {
        return service.move(id, req.status(), current(auth));
    }

    @PostMapping("/tasks/{id}/review")
    @PreAuthorize("hasRole('FACULTY')")
    public TaskResponse review(
            @PathVariable Long id,
            @Valid @RequestBody ReviewRequest req,
            Authentication auth) {
        return service.review(id, req, current(auth));
    }

    @GetMapping("/tasks/{id}/activity")
    public List<ActivityResponse> activity(
            @PathVariable Long id,
            Authentication auth) {
        return service.activity(id, current(auth));
    }

    @GetMapping("/analytics")
    public AnalyticsResponse analytics(Authentication auth) {
        return service.analytics(current(auth));
    }
}
