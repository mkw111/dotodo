package com.dotodo.workspace;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {
    public record SaveRequest(Long revision,@NotNull JsonNode data) {}
    private final WorkspaceService service;
    public WorkspaceController(WorkspaceService service) { this.service=service; }
    @GetMapping public WorkspaceService.Snapshot get() { return service.get(); }
    @GetMapping("/widget") public WorkspaceService.Snapshot widget(@RequestParam String day) { return service.widget(day); }
    @PostMapping(value = "/tasks/{id}/complete", consumes = "application/json")
    public WorkspaceService.Snapshot complete(@PathVariable String id, @RequestParam String day) { return service.completeFromWidget(id, day); }
    @PutMapping public WorkspaceService.Snapshot save(@Valid @RequestBody SaveRequest request) { return service.save(request.revision(),request.data()); }
}
