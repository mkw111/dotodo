package com.dotodo.todo.infrastructure;

import com.dotodo.todo.domain.Todo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, String> {}
