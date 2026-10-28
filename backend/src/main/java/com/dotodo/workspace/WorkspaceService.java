package com.dotodo.workspace;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.dotodo.todo.infrastructure.TodoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.Map;

@Service
public class WorkspaceService {
    public record Snapshot(Long revision,JsonNode data) {}
    private final WorkspaceRepository repository;
    private final TodoRepository todos;
    private final ObjectMapper mapper;
    private final WorkspaceValidator validator;
    private final TransactionTemplate transaction;
    public WorkspaceService(WorkspaceRepository repository,TodoRepository todos,ObjectMapper mapper,WorkspaceValidator validator,PlatformTransactionManager manager) {
        this.repository=repository;this.todos=todos;this.mapper=mapper;this.validator=validator;this.transaction=new TransactionTemplate(manager);
    }
    // Commit inside the lock: concurrent first loads cannot create duplicate documents.
    public synchronized Snapshot get() { return transaction.execute(status -> snapshot(document())); }
    public synchronized Snapshot save(Long revision,JsonNode data) {
        validator.validate(data);
        return transaction.execute(status -> {
            WorkspaceDocument document=document();
            if(revision==null || !revision.equals(document.getRevision())) throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 창에서 데이터가 변경됐어요. 새로 불러온 후 다시 시도해 주세요.");
            document.setContent(data.toString()); repository.saveAndFlush(document);
            return snapshot(document);
        });
    }
    private WorkspaceDocument document() { return repository.findById("personal").orElseGet(() -> repository.saveAndFlush(new WorkspaceDocument(initial().toString()))); }
    private Snapshot snapshot(WorkspaceDocument document) { try { return new Snapshot(document.getRevision(),mapper.readTree(document.getContent())); } catch(Exception e) { throw new IllegalStateException("Stored workspace is invalid",e); } }
    private JsonNode initial() {
        ObjectNode w=mapper.createObjectNode();w.put("schema",2);
        ArrayNode lists=w.putArray("lists"); String[] names={"업무","개인","건강","배움"};String[] ids={"work","personal","health","learn"};String[] colors={"#4776e6","#8a6ed7","#45a48a","#d99b43"};
        for(int i=0;i<ids.length;i++) lists.addObject().put("id",ids[i]).put("name",names[i]).put("color",colors[i]).put("icon","list");
        ArrayNode tasks=w.putArray("tasks");Map<String,String> mapped=Map.of("업무","work","개인","personal","건강","health","배움","learn");
        todos.findAll().forEach(old -> {ObjectNode t=tasks.addObject();t.put("id",old.getId()).put("title",old.getTitle()).put("notes","").put("listId",mapped.getOrDefault(old.getCategory(),"inbox")).put("date",old.getDueDate().toString()).put("time","").put("priority",old.isImportant()?1:0).put("repeat","none").put("completed",old.isCompleted()).put("createdAt",Instant.now().toString()).put("order",tasks.size());if(old.isCompleted())t.put("completedAt",Instant.now().toString());else t.putNull("completedAt");t.putNull("deletedAt");t.putArray("tags");t.putArray("checklist");});
        w.putArray("habits");w.putArray("sessions");w.putObject("timer").put("mode","focus").putNull("taskId").putNull("endAt").put("remaining",1500).put("duration",1500);
        w.putObject("settings").put("name","나").put("theme","light").put("accent","#4776e6").put("weekStart",0).put("focusMinutes",25).put("breakMinutes",5).put("showCompleted",true);
        return w;
    }
}
