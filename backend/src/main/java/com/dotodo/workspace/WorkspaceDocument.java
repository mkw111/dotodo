package com.dotodo.workspace;

import jakarta.persistence.*;
import org.hibernate.Length;

@Entity
@Table(name = "workspace_documents")
public class WorkspaceDocument {
    @Id private String id;
    @Version private Long revision;
    @Lob @Column(nullable = false, length = Length.LONG32) private String content;
    protected WorkspaceDocument() {}
    public WorkspaceDocument(String content) { this.id = "personal"; this.content = content; }
    public Long getRevision() { return revision; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
