package com.threatguard.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SourceType;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "conversations")
public class ConversationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(nullable = false)
    private long summaryThrough;

    private UUID processingToken;
    private Instant processingUntil;

    @CreationTimestamp(source = SourceType.DB)
    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp(source = SourceType.DB)
    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    protected ConversationEntity() {}

    public ConversationEntity(String title) {
        this.title = title;
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public long getSummaryThrough() {
        return summaryThrough;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public boolean isProcessing(Instant now) {
        return processingUntil != null && processingUntil.isAfter(now);
    }

    public void startProcessing(UUID token, Instant until, String summary, long summaryThrough) {
        processingToken = token;
        processingUntil = until;
        this.summary = summary;
        this.summaryThrough = summaryThrough;
    }

    public boolean releaseProcessing(UUID token) {
        if (!token.equals(processingToken)) {
            return false;
        }
        processingToken = null;
        processingUntil = null;
        return true;
    }
}
