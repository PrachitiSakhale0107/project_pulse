
package com.kanban.repository;

import com.kanban.model.Team;
import com.kanban.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TeamRepository extends JpaRepository<Team, Long> {

    boolean existsByNameIgnoreCase(String name);

    List<Team> findByFaculty(AppUser faculty);

    List<Team> findDistinctByMembersContaining(AppUser member);
}
