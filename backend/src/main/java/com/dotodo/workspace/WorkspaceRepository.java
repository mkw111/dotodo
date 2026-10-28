package com.dotodo.workspace;
import org.springframework.data.jpa.repository.JpaRepository;
public interface WorkspaceRepository extends JpaRepository<WorkspaceDocument, String> {}
