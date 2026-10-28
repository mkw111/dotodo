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
        ObjectNode reward=data.putArray("rewards").addObject().put("id","task:timed-task").put("type","task").put("title","시간표 일정").put("xp",20).put("earnedAt","2026-10-28T05:00:00Z").put("active",true);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[0].durationMinutes").value(60)).andExpect(jsonPath("$.data.rewards[0].xp").value(20));
        snapshot=load(); ((ObjectNode)snapshot.path("data").path("tasks").get(0)).put("durationMinutes",0);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
        snapshot=load(); ((ObjectNode)snapshot.path("data").path("rewards").get(0)).put("xp",999);
        mvc.perform(put("/api/workspace").contentType("application/json").content(snapshot.toString())).andExpect(status().isBadRequest());
    }
}
