package com.dotodo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.dotodo.todo.infrastructure.TodoRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:dotodo-test;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class TodoApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TodoRepository repository;
    @BeforeEach void clean() { repository.deleteAll(); }
    private static final String CREATE = """
        {"title":"첫 번째 할 일","category":"개인","dueDate":"2026-10-28","important":true,"completed":false}
        """;
    @Test void createReadUpdateDelete() throws Exception {
        String body = mvc.perform(post("/api/todos").contentType("application/json").content(CREATE)).andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("첫 번째 할 일")).andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(body).get("id").asText();
        mvc.perform(get("/api/todos")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(put("/api/todos/" + id).contentType("application/json").content(CREATE.replace("\"completed\":false", "\"completed\":true"))).andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true));
        assertTrue(repository.findById(id).orElseThrow().isCompleted());
        mvc.perform(delete("/api/todos/" + id)).andExpect(status().isNoContent());
        assertEquals(0, repository.count());
    }
    @Test void rejectsInvalidInputAndUnknownIds() throws Exception {
        for (String invalid : new String[]{CREATE.replace("첫 번째 할 일", " "), CREATE.replace("개인", "unknown"), CREATE.replace("2026-10-28", "not-a-date")}) {
            mvc.perform(post("/api/todos").contentType("application/json").content(invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        }
        assertEquals(0, repository.count());
        mvc.perform(put("/api/todos/missing").contentType("application/json").content(CREATE)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/todos/missing")).andExpect(status().isNotFound());
    }
}
