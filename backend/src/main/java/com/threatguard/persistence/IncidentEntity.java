package com.threatguard.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SourceType;

@Entity
@Table(name = "incidents")
public class IncidentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false, updatable = false)
    private ConversationEntity conversation;

    @Column(nullable = false, updatable = false)
    private UUID messageId;

    @CreationTimestamp(source = SourceType.DB)
    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected IncidentEntity() {}

    public IncidentEntity(ConversationEntity conversation, UUID messageId) {
        this.conversation = conversation;
        this.messageId = messageId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConversationId() {
        return conversation.getId();
    }

    public UUID getMessageId() {
        return messageId;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
