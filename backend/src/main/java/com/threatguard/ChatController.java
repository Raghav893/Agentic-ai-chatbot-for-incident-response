package com.threatguard;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static com.threatguard.ApiModels.*;

@RestController
class ChatController {
    private final ChatStore store;
    private final AiClient ai;
    ChatController(ChatStore store, AiClient ai) {
        this.store = store;
        this.ai = ai;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        store.checkDatabase();
        return Map.of("status", "UP");
    }

    @GetMapping("/api/chats")
    List<Chat> chats(@RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
                     @RequestParam(defaultValue = "0") @Min(0) int offset) {
        return store.chats(limit, offset);
    }

    @PostMapping("/api/chats")
    ResponseEntity<Chat> create(@RequestBody(required = false) @Valid CreateChat body) {
        String title = body == null || body.title() == null ? "" : body.title().strip();
        Chat chat = store.create(title.isEmpty() ? "New conversation" : title);
        return ResponseEntity.created(URI.create("/api/chats/" + chat.id())).body(chat);
    }

    @GetMapping("/api/chats/{chatId}")
    Chat chat(@PathVariable UUID chatId) {
        return store.chat(chatId);
    }

    @DeleteMapping("/api/chats/{chatId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID chatId) {
        store.delete(chatId);
    }

    @GetMapping("/api/chats/{chatId}/messages")
    List<Message> messages(@PathVariable UUID chatId,
                           @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
                           @RequestParam(defaultValue = "0") @Min(0) int offset) {
        return store.messages(chatId, limit, offset);
    }

    @PostMapping("/api/chats/{chatId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    Turn send(@PathVariable UUID chatId, @RequestBody @Valid SendMessage body,
              @RequestHeader(name = "Idempotency-Key", required = false) UUID requestKey) {
        var turn = store.start(chatId, body.content(), requestKey, ai.processingLeaseSeconds());
        if (turn.completed() != null) {
            return turn.completed();
        }
        try {
            return store.finish(turn, ai.analyze(turn.request()));
        } catch (RuntimeException exception) {
            try {
                store.clearProcessing(chatId, turn.token());
            } catch (RuntimeException cleanupFailure) {
                exception.addSuppressed(cleanupFailure);
            }
            throw exception;
        }
    }

    @GetMapping("/api/incidents/{id}")
    Incident incident(@PathVariable UUID id) {
        return store.incident(id);
    }
}
