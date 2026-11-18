package com.threatguard.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.threatguard.MessageRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MessageRepository extends JpaRepository<MessageEntity, Long> {
    Optional<MessageEntity> findByConversation_IdAndRequestKey(UUID conversationId, UUID requestKey);

    Optional<MessageEntity> findByConversation_IdAndReplyTo(UUID conversationId, UUID messageId);

    boolean existsByConversation_IdAndSequenceGreaterThan(UUID conversationId, long sequence);

    @Query("""
            select m from MessageEntity m where m.conversation.id = :chatId
            order by m.sequence
            limit :limit offset :offset
            """)
    List<MessageEntity> findWindow(UUID chatId, int limit, int offset);

    @Query("""
            select m.sequence as sequence, m.role as role, m.content as content from MessageEntity m
            where m.conversation.id = :chatId and m.sequence < :before
            order by m.sequence desc
            limit :limit
            """)
    List<ContextEntry> findRecent(UUID chatId, long before, int limit);

    @Query("""
            select m.sequence as sequence, m.role as role, m.content as content from MessageEntity m
            where m.conversation.id = :chatId and m.sequence > :after and m.sequence < :before
            order by m.sequence
            """)
    List<ContextEntry> findContextRange(UUID chatId, long after, long before);

    interface ContextEntry {
        long getSequence();
        MessageRole getRole();
        String getContent();
    }
}
