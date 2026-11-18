CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    summary TEXT,
    summary_through BIGINT NOT NULL DEFAULT 0,
    processing_token UUID,
    processing_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((processing_token IS NULL) = (processing_until IS NULL))
);

CREATE INDEX conversations_recent ON conversations (updated_at DESC, id);

CREATE TABLE messages (
    seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
    content TEXT NOT NULL,
    request_key UUID,
    reply_to UUID,
    analysis JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, id),
    UNIQUE (conversation_id, request_key),
    UNIQUE (conversation_id, reply_to),
    FOREIGN KEY (conversation_id, reply_to) REFERENCES messages(conversation_id, id) ON DELETE CASCADE,
    CHECK ((role = 'ASSISTANT') = (reply_to IS NOT NULL)),
    CHECK ((role = 'ASSISTANT') = (analysis IS NOT NULL)),
    CHECK (role = 'USER' OR request_key IS NULL)
);

CREATE INDEX messages_conversation_history ON messages (conversation_id, seq DESC);

CREATE TABLE incidents (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    message_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, message_id),
    FOREIGN KEY (conversation_id, message_id) REFERENCES messages(conversation_id, id) ON DELETE CASCADE
);
