package com.threatguard;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.threatguard.persistence.ConversationEntity;
import com.threatguard.persistence.ConversationRepository;
import com.threatguard.persistence.IncidentEntity;
import com.threatguard.persistence.IncidentRepository;
import com.threatguard.persistence.MessageEntity;
import com.threatguard.persistence.MessageRepository;
import com.threatguard.persistence.MessageRepository.ContextEntry;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static com.threatguard.ApiModels.*;

@Service
@Transactional(readOnly = true)
class ChatStore {
    private static final int RECENT_LIMIT = 12;
    private static final int SUMMARY_LIMIT = 3_000;

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final IncidentRepository incidents;
    private final EntityManager entityManager;
    private final ObjectMapper json;

    ChatStore(ConversationRepository conversations, MessageRepository messages, IncidentRepository incidents,
              EntityManager entityManager, ObjectMapper json) {
        this.conversations = conversations;
        this.messages = messages;
        this.incidents = incidents;
        this.entityManager = entityManager;
        this.json = json;
    }

    void checkDatabase() {
        entityManager.createQuery("select 1", Integer.class).getSingleResult();
    }

    @Transactional
    Chat create(String title) {
        return chat(conversations.saveAndFlush(new ConversationEntity(title)));
    }

    List<Chat> chats(int limit, int offset) {
        return conversations.findWindow(limit, offset).stream().map(ChatStore::chat).toList();
    }

    Chat chat(UUID id) {
        return conversations.findById(id).map(ChatStore::chat).orElseThrow(ChatStore::missingChat);
    }

    @Transactional
    void delete(UUID id) {
        if (conversations.deleteConversation(id) == 0) {
            throw missingChat();
        }
    }

    List<Message> messages(UUID chatId, int limit, int offset) {
        if (!conversations.existsById(chatId)) {
            throw missingChat();
        }
        return messages.findWindow(chatId, limit, offset).stream()
                .map(entry -> message(entry, entry.getAnalysis() == null ? null : analysis(entry)))
                .toList();
    }

    Incident incident(UUID id) {
        return incidents.findById(id)
                .flatMap(entry -> messages.findByConversation_IdAndReplyTo(
                                entry.getConversationId(), entry.getMessageId())
                        .map(reply -> incident(entry, analysis(reply))))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
    }

    @Transactional
    StartedTurn start(UUID chatId, String content, UUID requestKey, int leaseSeconds) {
        ConversationEntity conversation = conversations.findForUpdate(chatId).orElseThrow(ChatStore::missingChat);
        MessageEntity user = requestKey == null ? null :
                messages.findByConversation_IdAndRequestKey(chatId, requestKey).orElse(null);
        if (user != null) {
            if (!user.getContent().equals(content)) {
                throw conflict("This idempotency key is already associated with a different message.");
            }
            Turn previous = completedTurn(user);
            if (previous != null) {
                return new StartedTurn(previous.userMessage(), null, null, previous);
            }
            if (messages.existsByConversation_IdAndSequenceGreaterThan(chatId, user.getSequence())) {
                throw conflict("This failed analysis can only be retried before sending a newer message.");
            }
        }

        if (conversation.isProcessing(Instant.now())) {
            throw conflict("An analysis is already running for this conversation.");
        }
        if (user == null) {
            user = messages.save(MessageEntity.user(conversation, content, requestKey));
        }

        var recent = new ArrayList<>(messages.findRecent(chatId, user.getSequence(), RECENT_LIMIT));
        Collections.reverse(recent);
        var summary = summarize(conversation, recent);
        var context = recent.stream().map(entry -> new ContextMessage(entry.getRole(),
                truncate(entry.getContent(), 2_000))).toList();

        UUID token = UUID.randomUUID();
        conversation.startProcessing(token, Instant.now().plusSeconds(leaseSeconds), summary.text(), summary.through());
        return new StartedTurn(message(user, null), token, new AiRequest(content, summary.text(), context), null);
    }

    @Transactional
    Turn finish(StartedTurn turn, Analysis analysis) {
        ConversationEntity conversation = conversations.findForUpdate(turn.user().conversationId())
                .orElseThrow(ChatStore::staleTurn);
        if (!conversation.releaseProcessing(turn.token())) {
            throw staleTurn();
        }

        MessageEntity reply = messages.save(MessageEntity.reply(conversation, analysis.message(), turn.user().id(),
                json.valueToTree(analysis)));
        Incident incident = null;
        if (analysis.incidentDetected()) {
            IncidentEntity stored = incidents.saveAndFlush(new IncidentEntity(conversation, turn.user().id()));
            incident = incident(stored, analysis);
        }
        return new Turn(turn.user(), message(reply, null), analysis, incident);
    }

    @Transactional
    void clearProcessing(UUID chatId, UUID token) {
        conversations.findForUpdate(chatId).ifPresent(conversation -> conversation.releaseProcessing(token));
    }

    private Turn completedTurn(MessageEntity user) {
        UUID chatId = user.getConversationId();
        return messages.findByConversation_IdAndReplyTo(chatId, user.getId()).map(reply -> {
            Analysis analysis = analysis(reply);
            Incident incident = incidents.findByConversation_IdAndMessageId(chatId, user.getId())
                    .map(entry -> incident(entry, analysis)).orElse(null);
            return new Turn(message(user, null), message(reply, null), analysis, incident);
        }).orElse(null);
    }

    private Summary summarize(ConversationEntity conversation, List<ContextEntry> recent) {
        String text = conversation.getSummary();
        long through = conversation.getSummaryThrough();
        if (recent.size() == RECENT_LIMIT) {
            for (ContextEntry entry : messages.findContextRange(conversation.getId(), through,
                    recent.getFirst().getSequence())) {
                String excerpt = truncate(entry.getContent().replaceAll("\\s+", " ").strip(), 220);
                text = appendToSummary(text, entry.getRole() + ": " + excerpt);
                through = entry.getSequence();
            }
        }
        return new Summary(text, through);
    }

    private static Chat chat(ConversationEntity entry) {
        return new Chat(entry.getId(), entry.getTitle(), entry.getSummary(), entry.getCreatedAt(), entry.getUpdatedAt());
    }

    private static Message message(MessageEntity entry, Analysis analysis) {
        return new Message(entry.getId(), entry.getConversationId(), entry.getRole(), entry.getContent(),
                entry.getCreatedAt(), analysis);
    }

    private static Incident incident(IncidentEntity entry, Analysis analysis) {
        return new Incident(entry.getId(), entry.getConversationId(), entry.getMessageId(), entry.getCreatedAt(), analysis);
    }

    private Analysis analysis(MessageEntity entry) {
        return json.convertValue(entry.getAnalysis(), Analysis.class);
    }

    private static String appendToSummary(String summary, String excerpt) {
        String combined = summary == null ? excerpt : summary + "\n" + excerpt;
        if (combined.length() <= SUMMARY_LIMIT) {
            return combined;
        }
        return combined.substring(combined.indexOf('\n', combined.length() - SUMMARY_LIMIT) + 1);
    }

    private static String truncate(String text, int limit) {
        if (text.length() <= limit) {
            return text;
        }
        int end = Character.isHighSurrogate(text.charAt(limit - 2)) ? limit - 2 : limit - 1;
        return text.substring(0, end) + "…";
    }

    private static ResponseStatusException missingChat() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found.");
    }

    private static ResponseStatusException conflict(String detail) {
        return new ResponseStatusException(HttpStatus.CONFLICT, detail);
    }

    private static ResponseStatusException staleTurn() {
        return conflict("The conversation changed before analysis finished.");
    }

    private record Summary(String text, long through) {}
    record StartedTurn(Message user, UUID token, AiRequest request, Turn completed) {}
}
