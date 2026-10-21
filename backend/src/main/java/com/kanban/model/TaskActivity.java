package com.kanban.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="task_activity")
public class TaskActivity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="task_id", nullable=false) private KanbanTask task;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="actor_id", nullable=false) private AppUser actor;
    @Column(nullable=false, length=80) private String action;
    @Column(length=1000) private String comment;
    @Column(nullable=false) private LocalDateTime createdAt;
    @PrePersist void onCreate(){createdAt=LocalDateTime.now();}
    public TaskActivity(){}
    public TaskActivity(KanbanTask task, AppUser actor, String action, String comment){this.task=task;this.actor=actor;this.action=action;this.comment=comment;}
    public Long getId(){return id;} public KanbanTask getTask(){return task;} public AppUser getActor(){return actor;}
    public String getAction(){return action;} public String getComment(){return comment;} public LocalDateTime getCreatedAt(){return createdAt;}
}
