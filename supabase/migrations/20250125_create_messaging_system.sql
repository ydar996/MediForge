-- ============================================
-- Create Messaging and Task Management System
-- ============================================
-- Purpose: Enable in-app messaging and task management for all organizational roles
-- ============================================

-- ============================================
-- 1. MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Message Details
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type TEXT DEFAULT 'message', -- 'message', 'task', 'announcement'
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Participants
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for broadcast messages
    
    -- Task Management (if message_type = 'task')
    task_status TEXT DEFAULT 'outstanding', -- 'outstanding', 'in-process', 'addressed', 'completed'
    task_due_date TIMESTAMPTZ,
    task_completed_at TIMESTAMPTZ,
    task_completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Threading
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE, -- For replies
    thread_id UUID, -- Group related messages together
    
    -- Status Tracking
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Attachments (stored as JSON array of file references)
    attachments JSONB DEFAULT '[]',
    
    -- System Fields
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. MESSAGE RECIPIENTS TABLE (for group messages)
-- ============================================
CREATE TABLE IF NOT EXISTS message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    task_status TEXT DEFAULT 'outstanding', -- Individual task status for this recipient
    
    -- System Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(message_id, recipient_id)
);

-- ============================================
-- 3. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    
    -- Notification Details
    type TEXT NOT NULL, -- 'new_message', 'task_assigned', 'task_due', 'task_completed', 'message_reply'
    title TEXT NOT NULL,
    body TEXT,
    priority TEXT DEFAULT 'normal',
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    action_url TEXT, -- URL to navigate when notification is clicked
    
    -- System Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_organization ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_task_status ON messages(task_status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;

-- Message recipients indexes
CREATE INDEX IF NOT EXISTS idx_message_recipients_message ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient ON message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_org ON message_recipients(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_unread ON message_recipients(recipient_id, is_read) WHERE is_read = false;

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view messages in their organization"
    ON messages FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their organization"
    ON messages FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        AND sender_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages or messages sent to them"
    ON messages FOR UPDATE
    USING (
        sender_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
        OR recipient_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Message recipients policies
CREATE POLICY "Users can view message recipients in their organization"
    ON message_recipients FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create message recipients in their organization"
    ON message_recipients FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own message recipient records"
    ON message_recipients FOR UPDATE
    USING (
        recipient_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create notifications in their organization"
    ON notifications FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically create notifications when messages are created
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Create notification for recipient if message is not a broadcast
    IF NEW.recipient_id IS NOT NULL THEN
        INSERT INTO notifications (
            organization_id,
            user_id,
            message_id,
            type,
            title,
            body,
            priority,
            action_url
        ) VALUES (
            NEW.organization_id,
            NEW.recipient_id,
            NEW.id,
            CASE 
                WHEN NEW.message_type = 'task' THEN 'task_assigned'
                ELSE 'new_message'
            END,
            NEW.subject,
            LEFT(NEW.body, 200), -- First 200 characters
            NEW.priority,
            '/messages?message=' || NEW.id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notifications
CREATE TRIGGER trigger_create_message_notification
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION create_message_notification();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_recipients_updated_at
    BEFORE UPDATE ON message_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

