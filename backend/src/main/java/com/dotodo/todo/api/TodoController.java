package com.dotodo.todo.api;

import com.dotodo.todo.application.TodoService;
import com.dotodo.todo.domain.Todo;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/todos")
public class TodoController {
    private final TodoService service;
    public TodoController(TodoService service) { this.service = service; }
    @GetMapping public List<Todo> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Todo create(@Valid @RequestBody TodoRequest request) { return service.create(request); }
    @PutMapping("/{id}") public Todo update(@PathVariable String id, @Valid @RequestBody TodoRequest request) { return service.update(id, request); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { service.delete(id); }
}
