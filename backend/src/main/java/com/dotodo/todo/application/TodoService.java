package com.dotodo.todo.application;

import com.dotodo.todo.api.TodoRequest;
import com.dotodo.todo.domain.Todo;
import com.dotodo.todo.infrastructure.TodoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.Comparator;

@Service
@Transactional
public class TodoService {
    private final TodoRepository repository;
    public TodoService(TodoRepository repository) { this.repository = repository; }
    @Transactional(readOnly = true)
    public List<Todo> list() {
        return repository.findAll().stream().sorted(Comparator.comparing(Todo::getDueDate).thenComparing(Todo::getId)).toList();
    }
    public Todo create(TodoRequest request) {
        return repository.save(new Todo(request.title(), request.category(), request.dueDate(), request.important(), request.completed()));
    }
    public Todo update(String id, TodoRequest request) {
        Todo todo = find(id);
        todo.update(request.title(), request.category(), request.dueDate(), request.important(), request.completed());
        return repository.save(todo);
    }
    public void delete(String id) { repository.delete(find(id)); }
    private Todo find(String id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "할 일을 찾을 수 없어요."));
    }
}
