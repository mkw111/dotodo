package com.dotodo.todo.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "todos")
public class Todo {
    @Id private String id;
    @Column(nullable = false, length = 150) private String title;
    @Column(nullable = false) private String category;
    @Column(nullable = false) private LocalDate dueDate;
    private boolean important;
    private boolean completed;

    protected Todo() {}
    public Todo(String title, String category, LocalDate dueDate, boolean important, boolean completed) {
        this.id = UUID.randomUUID().toString();
        update(title, category, dueDate, important, completed);
    }
    public void update(String title, String category, LocalDate dueDate, boolean important, boolean completed) {
        this.title = title.trim(); this.category = category; this.dueDate = dueDate;
        this.important = important; this.completed = completed;
    }
    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getCategory() { return category; }
    public LocalDate getDueDate() { return dueDate; }
    public boolean isImportant() { return important; }
    public boolean isCompleted() { return completed; }
}
