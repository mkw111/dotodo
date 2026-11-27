package com.dotodo.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

final class WidgetWorkspace {
    private WidgetWorkspace() {}

    static boolean prepareDaily(ObjectNode data, LocalDate day) {
        ArrayNode tasks = (ArrayNode) data.get("tasks");
        Set<String> parents = new HashSet<>();
        for (JsonNode task : tasks) {
            if (task.has("recurrenceSource")) parents.add(task.get("recurrenceSource").asText());
        }
        int before = tasks.size();
        for (int i = 0; i < tasks.size() && tasks.size() < 10000; i++) {
            ObjectNode task = (ObjectNode) tasks.get(i);
            if (!"daily".equals(task.path("repeat").asText()) || task.path("actual").asBoolean()
                || !task.path("deletedAt").isNull() && task.has("deletedAt")
                || task.path("date").asText().isEmpty() || parents.contains(task.path("id").asText())) continue;
            LocalDate date = LocalDate.parse(task.get("date").asText());
            if (!date.isBefore(day)) continue;
            tasks.add(successor(task));
            parents.add(task.get("id").asText());
        }
        return tasks.size() != before;
    }

    static boolean complete(ObjectNode data, String id, LocalDate day) {
        ArrayNode tasks = (ArrayNode) data.get("tasks");
        ObjectNode task = null;
        boolean hasSuccessor = false;
        for (JsonNode item : tasks) {
            if (id.equals(item.path("id").asText())) task = (ObjectNode) item;
            if (id.equals(item.path("recurrenceSource").asText())) hasSuccessor = true;
        }
        if (task == null || !task.path("deletedAt").isNull() && task.has("deletedAt")) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "할 일을 찾을 수 없어요.");
        }
        if (task.path("completed").asBoolean()) return false;
        task.put("completed", true).put("completedAt", Instant.now().toString());
        if (task.has("habitId")) {
            for (JsonNode habit : data.path("habits")) {
                if (task.get("habitId").asText().equals(habit.path("id").asText())) {
                    ObjectNode checks = (ObjectNode) habit.get("checks");
                    checks.put(day.toString(), Math.min(100, checks.path(day.toString()).asInt() + 1));
                }
            }
        }
        if (!"none".equals(task.path("repeat").asText()) && !"daily".equals(task.path("repeat").asText()) && !hasSuccessor && tasks.size() < 10000) {
            tasks.add(successor(task));
        }
        return true;
    }

    private static ObjectNode successor(ObjectNode task) {
        ObjectNode next = task.deepCopy();
        LocalDate date = LocalDate.parse(task.get("date").asText());
        String repeat = task.get("repeat").asText();
        LocalDate nextDate = date.plusDays("weekly".equals(repeat) ? 7 : 1);
        if ("monthly".equals(repeat)) {
            LocalDate month = date.withDayOfMonth(1).plusMonths(1);
            nextDate = month.withDayOfMonth(Math.min(task.path("repeatDay").asInt(date.getDayOfMonth()), month.lengthOfMonth()));
        }
        while ("weekdays".equals(repeat) && (nextDate.getDayOfWeek() == DayOfWeek.SATURDAY || nextDate.getDayOfWeek() == DayOfWeek.SUNDAY)) nextDate = nextDate.plusDays(1);
        next.put("id", UUID.randomUUID().toString()).put("date", nextDate.toString())
            .put("repeatDay", task.path("repeatDay").asInt(date.getDayOfMonth()))
            .put("recurrenceSource", task.get("id").asText()).put("completed", false)
            .putNull("completedAt").putNull("deletedAt").put("createdAt", Instant.now().toString())
            .put("order", System.currentTimeMillis());
        if (task.has("endDate")) next.put("endDate", nextDate.plusDays(ChronoUnit.DAYS.between(date, LocalDate.parse(task.get("endDate").asText()))).toString());
        for (JsonNode item : next.path("checklist")) ((ObjectNode) item).put("id", UUID.randomUUID().toString()).put("done", false);
        return next;
    }
}
