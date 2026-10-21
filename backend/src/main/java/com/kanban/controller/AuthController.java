
package com.kanban.controller;

import com.kanban.dto.ApiDtos.*;
import com.kanban.model.AppUser;
import com.kanban.model.Role;
import com.kanban.repository.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager manager;
    private final UserRepository users;
    private final SecurityContextRepository contextRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            AuthenticationManager manager,
            UserRepository users,
            SecurityContextRepository contextRepository,
            PasswordEncoder passwordEncoder) {

        this.manager = manager;
        this.users = users;
        this.contextRepository = contextRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // REGISTER A MEMBER
    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegisterRequest req) {

        String email = req.email().trim();

        if (users.existsByEmailIgnoreCase(email)) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse(
                            "Email is already registered."));
        }

        AppUser user = new AppUser();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPassword(
                passwordEncoder.encode(req.password()));

        // Public registration cannot create Admin accounts.
        user.setRole(Role.MEMBER);
        user.setApproved(true);

        AppUser savedUser = users.save(user);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(UserResponse.from(savedUser));
    }

    // REGISTER A FACULTY ACCOUNT
    // Faculty accounts must be approved by an Admin before login.
    @PostMapping("/register-faculty")
    public ResponseEntity<?> registerFaculty(
            @Valid @RequestBody RegisterRequest req) {

        String email = req.email().trim();

        if (users.existsByEmailIgnoreCase(email)) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse(
                            "Email is already registered."));
        }

        AppUser user = new AppUser();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPassword(
                passwordEncoder.encode(req.password()));

        user.setRole(Role.FACULTY);
        user.setApproved(false);

        users.save(user);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(Map.of(
                        "message",
                        "Faculty registration submitted. Please wait for Admin approval."
                ));
    }

    // LOGIN EXISTING USER
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response) {

        try {
            Authentication authentication =
                    manager.authenticate(
                            new UsernamePasswordAuthenticationToken(
                                    req.email().trim(),
                                    req.password()
                            )
                    );

            SecurityContext context =
                    SecurityContextHolder.createEmptyContext();

            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);

            contextRepository.saveContext(
                    context, request, response);

            AppUser user = users
                    .findByEmailIgnoreCase(
                            req.email().trim())
                    .orElseThrow();

            return ResponseEntity.ok(
                    UserResponse.from(user));

        } catch (AuthenticationException ex) {

            SecurityContextHolder.clearContext();

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse(
                            "Invalid email or password, or the account is awaiting approval."));
        }
    }

    // GET CURRENTLY LOGGED-IN USER
    @GetMapping("/me")
    public UserResponse me(Authentication auth) {

        return UserResponse.from(
                users.findByEmailIgnoreCase(
                        auth.getName())
                        .orElseThrow()
        );
    }

    // LOGOUT
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            HttpServletRequest request) {

        SecurityContextHolder.clearContext();

        HttpSession session =
                request.getSession(false);

        if (session != null) {
            session.invalidate();
        }

        return ResponseEntity.ok(
                Map.of("message", "Logged out"));
    }
}
