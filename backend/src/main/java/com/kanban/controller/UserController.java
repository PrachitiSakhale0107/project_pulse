
package com.kanban.controller;

import com.kanban.dto.ApiDtos.UserResponse;
import com.kanban.model.AppUser;
import com.kanban.model.Role;
import com.kanban.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    // List all users for Admin and Faculty.
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','FACULTY')")
    public List<UserResponse> list() {
        return users.findAll()
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    // List approved members for team creation.
    @GetMapping("/members")
    @PreAuthorize("hasAnyRole('MEMBER','ADMIN')")
    public List<UserResponse> listApprovedMembers() {
        return users.findAll()
                .stream()
                .filter(user -> user.getRole() == Role.MEMBER)
                .filter(AppUser::isApproved)
                .map(UserResponse::from)
                .toList();
    }

    // List approved faculty for team assignment.
    @GetMapping("/faculty")
    @PreAuthorize("hasAnyRole('MEMBER','ADMIN')")
    public List<UserResponse> listApprovedFaculty() {
        return users.findAll()
                .stream()
                .filter(user -> user.getRole() == Role.FACULTY)
                .filter(AppUser::isApproved)
                .map(UserResponse::from)
                .toList();
    }

    // List faculty accounts awaiting Admin approval.
    @GetMapping("/pending-faculty")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> pendingFaculty() {
        return users.findByRoleAndApprovedFalse(Role.FACULTY)
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    // Approve a faculty account.
    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse approveFaculty(@PathVariable Long id) {

        AppUser user = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found."
                ));

        if (user.getRole() != Role.FACULTY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only faculty accounts can be approved here."
            );
        }

        user.setApproved(true);

        return UserResponse.from(users.save(user));
    }
}
