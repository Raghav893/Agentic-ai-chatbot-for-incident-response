package com.threatguard.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ConversationRepository extends JpaRepository<ConversationEntity, UUID> {
    @Query("""
            select c from ConversationEntity c
            order by c.updatedAt desc, c.id
            limit :limit offset :offset
            """)
    List<ConversationEntity> findWindow(int limit, int offset);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ConversationEntity c where c.id = :id")
    Optional<ConversationEntity> findForUpdate(UUID id);

    @Modifying
    @Query("delete from ConversationEntity c where c.id = :id")
    int deleteConversation(UUID id);
}
