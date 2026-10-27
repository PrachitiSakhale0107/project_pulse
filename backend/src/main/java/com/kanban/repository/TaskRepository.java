
package com.kanban.repository;

import com.kanban.model.KanbanTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<KanbanTask, Long> {

    List<KanbanTask> findAllByOrderByUpdatedAtDesc();

    // Fetch tasks assigned to a particular user.
    List<KanbanTask> findByAssigneeIdOrderByUpdatedAtDesc(Long assigneeId);

}
