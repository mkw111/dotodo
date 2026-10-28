package com.dotodo.todo.api;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record TodoRequest(
    @NotBlank(message = "할 일을 입력해 주세요.") @Size(max = 150, message = "할 일은 150자 이내로 입력해 주세요.") String title,
    @NotNull @Pattern(regexp = "개인|업무|건강|배움", message = "올바른 카테고리를 선택해 주세요.") String category,
    @NotNull(message = "날짜를 선택해 주세요.") LocalDate dueDate,
    boolean important,
    boolean completed
) {}
