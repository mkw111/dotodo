package com.dotodo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import com.dotodo.workspace.WorkspaceRepository;
import com.dotodo.todo.infrastructure.TodoRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:workspace-test;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class WorkspaceApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired WorkspaceRepository repository;
    @Autowired TodoRepository todos;
    @BeforeEach void clean(){repository.deleteAll();todos.deleteAll();}
    private ObjectNode load() throws Exception {return (ObjectNode)mapper.readTree(mvc.perform(get("/api/workspace")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
    @Test void persistsFullWorkspaceAndRejectsStaleWrites() throws Exception {
        ObjectNode snapshot=load();((ObjectNode)snapshot.path("data").path("settings")).put("name","테스트 사용자");
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.settings.name").value("테스트 사용자"));
        assertEquals("테스트 사용자",load().path("data").path("settings").path("name").asText());
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isConflict());
    }
    @Test void invalidWorkspaceDoesNotOverwriteSavedData() throws Exception {
        ObjectNode snapshot=load();((ObjectNode)snapshot.path("data").path("settings")).put("focusMinutes",-1);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
        assertEquals(25,load().path("data").path("settings").path("focusMinutes").asInt());
        ((ObjectNode)snapshot.path("data")).putNull("tasks");
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
    }
    @Test void migratesLegacyTasksOnlyOnFirstWorkspaceLoad() throws Exception {
        mvc.perform(post("/api/todos").contentType("application/json").content("""
            {"title":"이전 할 일","category":"업무","dueDate":"2026-10-28","important":true,"completed":false}
            """)).andExpect(status().isCreated());
        ObjectNode snapshot=load();assertEquals(1,snapshot.path("data").path("tasks").size());assertEquals("work",snapshot.path("data").path("tasks").get(0).path("listId").asText());
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isOk());
        assertEquals(1,load().path("data").path("tasks").size());
    }
    @Test void acceptsScheduleAndRewardsAndRejectsInvalidExtensions() throws Exception {
        ObjectNode snapshot=load(); ObjectNode data=(ObjectNode)snapshot.get("data");
        ObjectNode task=((ArrayNode)data.get("tasks")).addObject();
        task.put("id","timed-task").put("title","시간표 일정").put("notes","").put("listId","work").put("date","2026-10-28").put("time","14:00").put("durationMinutes",60).put("priority",0).put("repeat","none").put("completed",true).put("completedAt","2026-10-28T05:00:00Z").putNull("deletedAt").put("createdAt","2026-10-28T04:00:00Z").put("order",1);
        task.putArray("tags");task.putArray("checklist");
        task.put("reminderMinutes", 10);
        ObjectNode allDay = task.deepCopy();
        allDay.put("id", "multi-day").put("time", "").put("endDate", "2026-11-02").put("priority", 4);
        allDay.remove("reminderMinutes");
        allDay.put("repeat", "daily").put("habitId", "linked-habit");
        ((ArrayNode) data.get("habits")).addObject()
            .put("id", "linked-habit").put("name", "매일 독서").put("icon", "habit")
            .put("color", "#4776e6").put("goal", 1).putObject("checks");
        ((ArrayNode) data.get("tasks")).add(allDay);
        data.putObject("calendarPlans").put("2026", "연간 목표").put("2026-10", "월간 목표");
        ObjectNode reward=data.putArray("rewards").addObject().put("id","task:timed-task").put("type","task").put("title","시간표 일정").put("xp",20).put("earnedAt","2026-10-28T05:00:00Z").put("active",true);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[0].durationMinutes").value(60)).andExpect(jsonPath("$.data.rewards[0].xp").value(20));
        snapshot = load();
        assertEquals(10, snapshot.path("data").path("tasks").get(0).path("reminderMinutes").asInt());
        assertEquals("linked-habit", snapshot.path("data").path("tasks").get(1).path("habitId").asText());
        assertEquals(4, snapshot.path("data").path("tasks").get(1).path("priority").asInt());
        assertEquals("2026-11-02", snapshot.path("data").path("tasks").get(1).path("endDate").asText());
        assertEquals("월간 목표", snapshot.path("data").path("calendarPlans").path("2026-10").asText());
        ((ObjectNode)snapshot.path("data").path("tasks").get(0)).put("durationMinutes",0);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
        snapshot=load(); ((ObjectNode)snapshot.path("data").path("rewards").get(0)).put("xp",999);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
    }
    @Test void widgetCompletionPreservesHistoryAndIsIdempotent() throws Exception {
        ObjectNode snapshot = load();
        ObjectNode data = (ObjectNode) snapshot.get("data");
        ObjectNode task = ((ArrayNode) data.get("tasks")).addObject();
        task.put("id", "widget-daily").put("title", "기도").put("notes", "").put("listId", "work")
            .put("date", "2026-11-18").put("time", "09:00").put("priority", 1).put("repeat", "daily")
            .put("habitId", "widget-habit").put("completed", false).putNull("completedAt").putNull("deletedAt")
            .put("createdAt", "2026-11-18T00:00:00Z").put("order", 1);
        task.putArray("tags"); task.putArray("checklist").addObject().put("id", "check").put("title", "시작").put("done", true);
        ((ArrayNode) data.get("habits")).addObject().put("id", "widget-habit").put("name", "기도")
            .put("icon", "habit").put("color", "#4776e6").put("goal", 1).putObject("checks");
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isOk());
        ObjectNode prepared = (ObjectNode) mapper.readTree(mvc.perform(get("/api/workspace/widget?day=2026-11-19").header("X-Dotodo-Widget", "1"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(2, prepared.path("data").path("tasks").size());
        assertEquals("2026-11-18", prepared.path("data").path("tasks").get(0).path("date").asText());
        assertFalse(prepared.path("data").path("tasks").get(1).path("checklist").get(0).path("done").asBoolean());
        String id = prepared.path("data").path("tasks").get(1).path("id").asText();
        String endpoint = "/api/workspace/tasks/" + id + "/complete?day=2026-11-19";
        mvc.perform(post(endpoint)).andExpect(status().isUnsupportedMediaType());
        mvc.perform(post(endpoint).contentType("application/json")).andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[1].completed").value(true));
        mvc.perform(post(endpoint).contentType("application/json")).andExpect(status().isOk()).andExpect(jsonPath("$.data.habits[0].checks['2026-11-19']").value(1));
        assertEquals(2, load().path("data").path("tasks").size());
        mvc.perform(put("/api/workspace").contentType("application/json").content(prepared.toString())).andExpect(status().isConflict());
        mvc.perform(post("/api/workspace/tasks/missing/complete?day=2026-11-19").contentType("application/json")).andExpect(status().isNotFound());
        mvc.perform(get("/api/workspace/widget?day=bad-date").header("X-Dotodo-Widget", "1")).andExpect(status().isBadRequest());
    }

}
