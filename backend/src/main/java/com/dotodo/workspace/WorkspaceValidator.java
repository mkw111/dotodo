package com.dotodo.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.Instant;
import java.util.*;

@Component
public class WorkspaceValidator {
    public void validate(JsonNode w) {
        try {
            require(w != null && w.isObject() && w.path("schema").asInt() == 2);
            array(w.get("lists"), 200); array(w.get("tasks"), 10000); array(w.get("habits"), 200); array(w.get("sessions"), 50000);
            if (w.has("calendarPlans")) {
                JsonNode plans = w.get("calendarPlans");
                require(plans.isObject() && plans.size() <= 1200);
                plans.fields().forEachRemaining(entry -> require(
                    entry.getKey().matches("[0-9]{4}(-(?:0[1-9]|1[0-2]))?")
                    && entry.getValue().isTextual() && entry.getValue().asText().length() <= 3000
                ));
            }
            if(w.has("rewards")) {
                array(w.get("rewards"),100000); Set<String> rewardIds = new HashSet<>();
                for(JsonNode r:w.get("rewards")) require(text(r,"id",1,180) && rewardIds.add(r.get("id").asText()) && text(r,"type",1,10) && Set.of("task","habit","focus","quest").contains(r.get("type").asText()) && text(r,"title",0,150) && integer(r,"xp",1,60) && bool(r,"active") && stamp(r,"earnedAt",false));
            }
            Set<String> lists = new HashSet<>(); lists.add("inbox");
            for (JsonNode l : w.get("lists")) {
                require(text(l,"id",1,100) && lists.add(l.get("id").asText()));
                require(text(l,"name",1,50) && color(l,"color") && text(l,"icon",1,30));
                if (l.has("autoCarry")) require(bool(l, "autoCarry"));
            }
            unique(w.get("tasks")); unique(w.get("habits")); unique(w.get("sessions"));
            Set<String> habits = new HashSet<>();
            for (JsonNode h : w.get("habits")) habits.add(h.path("id").asText());
            for (JsonNode t : w.get("tasks")) {
                if (t.has("actual")) require(t.get("actual").isBoolean());
                require(text(t,"title",1,150) && !t.get("title").asText().isBlank() && text(t,"notes",0,20000));
                require(text(t,"listId",1,100) && lists.contains(t.get("listId").asText()) && date(t,"date",true));
                require(text(t,"time",0,5) && (t.get("time").asText().isEmpty() || t.get("time").asText().matches("([01]\\d|2[0-3]):[0-5]\\d")));
                if (t.has("endDate")) require(date(t, "endDate", false)
                    && !t.get("date").asText().isEmpty()
                    && t.get("endDate").asText().compareTo(t.get("date").asText()) >= 0
                    && t.get("time").asText().isEmpty());
                require(integer(t,"priority",0,4) && bool(t,"completed") && stamp(t,"completedAt",true) && stamp(t,"deletedAt",true) && stamp(t,"createdAt",false));
                require(t.path("order").isNumber() && Double.isFinite(t.get("order").asDouble()));
                require(text(t,"repeat",1,20) && Set.of("none","daily","weekdays","weekly","monthly").contains(t.get("repeat").asText()));
                require(t.get("repeat").asText().equals("none") || !t.get("date").asText().isEmpty());
                array(t.get("tags"),30); for (JsonNode tag : t.get("tags")) require(tag.isTextual() && !tag.asText().isEmpty() && tag.asText().length() <= 40);
                array(t.get("checklist"),100); unique(t.get("checklist")); for (JsonNode c : t.get("checklist")) require(text(c,"title",1,150) && !c.get("title").asText().isBlank() && bool(c,"done"));
                if (t.has("habitId")) require(text(t, "habitId", 1, 100) && habits.contains(t.get("habitId").asText()));
                if(t.has("recurrenceSource")) require(text(t,"recurrenceSource",1,100));
                if(t.has("repeatDay")) require(integer(t,"repeatDay",1,31));
                if (t.has("reminderMinutes")) require(integer(t, "reminderMinutes", 0, 10080));
                if(t.has("durationMinutes")) require(integer(t,"durationMinutes",t.path("actual").asBoolean() ? 1 : 15,720));
            }
            for (JsonNode h : w.get("habits")) {
                require(text(h,"name",1,100) && text(h,"icon",1,30) && color(h,"color") && integer(h,"goal",1,100));
                require(h.path("checks").isObject() && h.get("checks").size() <= 50000);
                h.get("checks").fields().forEachRemaining(e -> { require(validDate(e.getKey()) && e.getValue().isIntegralNumber() && e.getValue().asInt() >= 0 && e.getValue().asInt() <= 100); });
            }
            for (JsonNode s : w.get("sessions")) require(text(s,"title",0,150) && nullableId(s,"taskId") && s.path("minutes").isNumber() && s.get("minutes").asDouble() > 0 && s.get("minutes").asDouble() <= 180 && stamp(s,"completedAt",false));
            JsonNode s = w.path("settings"); JsonNode t = w.path("timer");
            require(text(s,"name",1,40) && !s.get("name").asText().isBlank() && text(s,"theme",1,10) && Set.of("light","dark","system").contains(s.get("theme").asText()) && color(s,"accent") && integer(s,"weekStart",0,1) && integer(s,"focusMinutes",1,180) && integer(s,"breakMinutes",1,60) && bool(s,"showCompleted"));
            require(text(t,"mode",1,10) && Set.of("focus","break").contains(t.get("mode").asText()) && nullableId(t,"taskId"));
            require(t.has("endAt") && (t.get("endAt").isNull() || t.get("endAt").isNumber() && Double.isFinite(t.get("endAt").asDouble()) && t.get("endAt").asDouble() > 0));
            require(t.path("duration").isNumber() && t.get("duration").asDouble() >= 60 && t.get("duration").asDouble() <= 10800 && t.path("remaining").isNumber() && t.get("remaining").asDouble() >= 0 && t.get("remaining").asDouble() <= t.get("duration").asDouble());
            require(w.toString().length() <= 8 * 1024 * 1024);
        } catch (ResponseStatusException e) { throw e; } catch (RuntimeException e) { invalid(); }
    }
    private void unique(JsonNode array) { Set<String> ids = new HashSet<>(); for(JsonNode n : array) require(text(n,"id",1,100) && ids.add(n.get("id").asText())); }
    private void array(JsonNode a,int max) { require(a != null && a.isArray() && a.size() <= max); }
    private boolean text(JsonNode n,String key,int min,int max) { JsonNode v=n.get(key); return v!=null && v.isTextual() && v.asText().length()>=min && v.asText().length()<=max; }
    private boolean integer(JsonNode n,String key,int min,int max) { JsonNode v=n.get(key); return v!=null && v.isIntegralNumber() && v.asLong()>=min && v.asLong()<=max; }
    private boolean bool(JsonNode n,String key) { return n.path(key).isBoolean(); }
    private boolean color(JsonNode n,String key) { return text(n,key,7,7) && n.get(key).asText().matches("#[0-9a-fA-F]{6}"); }
    private boolean nullableId(JsonNode n,String key) { return n.has(key) && (n.get(key).isNull() || text(n,key,1,100)); }
    private boolean date(JsonNode n,String key,boolean empty) { return text(n,key,0,10) && (empty && n.get(key).asText().isEmpty() || validDate(n.get(key).asText())); }
    private boolean validDate(String v) { try { return LocalDate.parse(v).toString().equals(v); } catch(Exception e) { return false; } }
    private boolean stamp(JsonNode n,String key,boolean nullable) { if(!n.has(key))return false; if(n.get(key).isNull())return nullable; try { return n.get(key).isTextual() && Instant.parse(n.get(key).asText())!=null; } catch(Exception e) { return false; } }
    private void require(boolean value) { if(!value)invalid(); }
    private void invalid() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"워크스페이스 데이터 형식을 확인해 주세요."); }
}
