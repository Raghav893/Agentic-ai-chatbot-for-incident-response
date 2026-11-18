package com.threatguard.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.threatguard.MessageRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SourceType;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "messages")
public class MessageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "seq")
    private Long sequence;

    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false, updatable = false)
    private ConversationEntity conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private MessageRole role;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String content;

    @Column(updatable = false)
    private UUID requestKey;

    @Column(updatable = false)
    private UUID replyTo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(updatable = false, columnDefinition = "jsonb")
    private JsonNode analysis;

    @CreationTimestamp(source = SourceType.DB)
    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected MessageEntity() {}

    private MessageEntity(ConversationEntity conversation, MessageRole role, String content,
                          UUID requestKey, UUID replyTo, JsonNode analysis) {
        this.id = UUID.randomUUID();
        this.conversation = conversation;
        this.role = role;
        this.content = content;
        this.requestKey = requestKey;
        this.replyTo = replyTo;
        this.analysis = analysis;
    }

    public static MessageEntity user(ConversationEntity conversation, String content, UUID requestKey) {
        return new MessageEntity(conversation, MessageRole.USER, content, requestKey, null, null);
    }

    public static MessageEntity reply(ConversationEntity conversation, String content, UUID replyTo, JsonNode analysis) {
        return new MessageEntity(conversation, MessageRole.ASSISTANT, content, null, replyTo, analysis);
    }

    public long getSequence() {
        return sequence;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConversationId() {
        return conversation.getId();
    }

    public MessageRole getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public JsonNode getAnalysis() {
        return analysis;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
