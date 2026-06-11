# Handover Instructions: Messaging & Task Management System

## Overview
This document provides comprehensive handover instructions for the in-app messaging and task management system implemented for the MediForge application. The system allows all registered organizational roles to send messages, receive notifications, respond to messages, and manage tasks.

## System Architecture

### Technology Stack
- **Frontend**: HTML/CSS/JavaScript (vanilla)
- **Backend**: Supabase (PostgreSQL database with Row Level Security)
- **Storage**: Hybrid architecture - Supabase-first with localStorage fallback
- **Deployment**: Netlify
- **Database**: Supabase PostgreSQL

### Hybrid Architecture Pattern
The system follows a **Supabase-first with localStorage fallback** pattern:
1. Primary: Attempt Supabase operations first
2. Fallback: Use localStorage if Supabase is unavailable
3. Sync: Data is synced when Supabase becomes available

## Database Schema

### Tables Created
All schema definitions are in: `supabase/migrations/20250125_create_messaging_system.sql`

#### 1. `messages` Table
- **Purpose**: Stores all messages and tasks
- **Key Fields**:
  - `id` (UUID, primary key)
  - `organization_id` (UUID, foreign key)
  - `subject` (TEXT)
  - `body` (TEXT)
  - `message_type` (TEXT: 'message', 'task')
  - `priority` (TEXT: 'low', 'normal', 'high', 'urgent')
  - `sender_id` (UUID)
  - `recipient_id` (UUID, nullable for group messages)
  - `task_status` (TEXT: 'pending', 'in-process', 'addressed', 'completed')
  - `task_due_date` (TIMESTAMP)
  - `task_completed_at` (TIMESTAMP)
  - `task_completed_by` (UUID)
  - `is_read` (BOOLEAN)
  - `read_at` (TIMESTAMP)
  - `is_archived` (BOOLEAN)
  - `archived_at` (TIMESTAMP)
  - `archived_by` (UUID)
  - `created_at`, `updated_at` (TIMESTAMPS)

#### 2. `message_recipients` Table
- **Purpose**: Handles group messages (multiple recipients)
- **Key Fields**:
  - `id` (UUID, primary key)
  - `message_id` (UUID, foreign key to messages)
  - `recipient_id` (UUID)
  - `organization_id` (UUID)
  - `is_read` (BOOLEAN)
  - `read_at` (TIMESTAMP)
  - `task_status` (TEXT)
  - `created_at`, `updated_at` (TIMESTAMPS)

#### 3. `notifications` Table
- **Purpose**: Stores user notifications for new messages
- **Key Fields**:
  - `id` (UUID, primary key)
  - `organization_id` (UUID)
  - `user_id` (UUID)
  - `message_id` (UUID, foreign key to messages)
  - `type` (TEXT: 'message', 'task')
  - `title` (TEXT)
  - `body` (TEXT)
  - `priority` (TEXT)
  - `is_read` (BOOLEAN)
  - `read_at` (TIMESTAMP)
  - `action_url` (TEXT)
  - `created_at`, `updated_at` (TIMESTAMPS)

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring:
- Users can only access data within their organization
- Users can only see their own messages/notifications
- Proper authentication checks using `auth.uid()`

### Database Functions & Triggers
1. **`create_message_notification()`**: Automatically creates notifications when new messages are inserted
2. **`update_updated_at_column()`**: Updates `updated_at` timestamp on record changes
3. **Triggers**: 
   - `trigger_create_message_notification` - fires on message insert
   - `update_messages_updated_at` - fires on message update
   - `update_message_recipients_updated_at` - fires on recipient update
   - `update_notifications_updated_at` - fires on notification update

## Key Files & Their Purposes

### Frontend Files

#### `messages.html`
- **Purpose**: Main messaging dashboard page
- **Features**:
  - Inbox, Sent, and Tasks tabs
  - Message list display
  - Message detail view
  - Auto-switches to Inbox tab when unread messages exist
  - Shows unread count badge on Inbox tab
  - Message actions: Mark as Read, Archive, Reply
  - Task status management: Mark In Process, Mark as Addressed
- **Key Functions**:
  - `loadMessages()`: Loads messages with unread badge management
  - `switchTab(tab)`: Switches between Inbox/Sent/Tasks
  - `displayMessages()`: Renders message list
  - `selectMessage(messageId)`: Shows message details
  - `markAsRead(messageId)`: Marks message as read
  - `updateTaskStatus(messageId, status)`: Updates task status
  - `archiveMessage(messageId)`: Archives a message
  - `resolveDeliveryStatuses()`: Checks read status for sent messages

#### `compose-message.html`
- **Purpose**: Dedicated page for composing new messages
- **Features**:
  - Recipient type selection (Staff/Patient)
  - Searchable recipient dropdown
  - Message type selection (Message/Task)
  - Priority selection
  - Task due date (for tasks)
  - Subject and body fields
- **Key Functions**:
  - `loadRecipients()`: Loads staff and patients
  - `switchRecipientType()`: Handles recipient type changes
  - `filterRecipientsForDropdown()`: Filters recipients based on search
  - `showRecipientDropdown()`: Displays filtered recipients
  - `selectRecipient(recipient)`: Selects a recipient
  - `sendMessage()`: Sends the message

#### `js/messages.js`
- **Purpose**: Core messaging system logic
- **Key Functions**:
  - `getCurrentUserId()`: Gets current user ID (async, checks multiple sources)
  - `getCurrentOrgId()`: Gets current organization ID (uses `window.resolveOrganizationId()`)
  - `loadOrganizationUsers()`: Loads staff members (filters out patients)
  - `loadOrganizationPatients()`: Loads patients
  - `getUserNameById(userId)`: Resolves user/patient name by ID (queries Supabase users/patients tables, then fallback arrays, then localStorage)
  - `sendMessage(messageData)`: Sends a message (Supabase-first with localStorage fallback)
  - `updateMessageStatus(messageId, updates)`: Updates message status (read, archived, task status)
  - `loadMessagesWithSupabasePriority()`: Loads messages (Supabase-first)
  - `loadUnreadMessageCount()`: Gets unread message count for badge

#### `js/utils.js`
- **Purpose**: Utility functions used across the app
- **Key Functions**:
  - `window.resolveOrganizationId()`: Standardized organization ID resolution
  - `window.hasRole(role)`: Role checking utility

#### `dashboard.html`
- **Purpose**: Main dashboard with messaging integration
- **Features**:
  - "💬 Messages & Tasks" button with unread count badge
  - Links to `messages.html`
  - Calls `loadUnreadMessageCount()` on page load

### Database Files

#### `supabase/migrations/20250125_create_messaging_system.sql`
- **Purpose**: Complete database schema for messaging system
- **Contains**:
  - Table definitions
  - Indexes for performance
  - RLS policies
  - Database functions
  - Triggers
- **Important**: This migration must be run in Supabase before the system works

### Configuration Files

#### `netlify.toml`
- **Purpose**: Netlify deployment configuration
- **Contains**: Redirect rule for `/compose-message` → `compose-message.html`

## Critical Implementation Details

### 1. Infinite Recursion Prevention
**Issue**: Local wrapper functions were causing infinite recursion when calling `window.updateMessageStatus` and `window.getUserNameById`.

**Solution**: 
- Removed local wrapper functions in `messages.html`
- All functions now call `window.updateMessageStatus` and `window.getUserNameById` directly
- Functions like `markAsRead`, `updateTaskStatus`, `archiveMessage` check for `window.updateMessageStatus` before calling

### 2. User ID Resolution
**Pattern**: `getCurrentUserId()` checks multiple localStorage fields:
- `localStorage.user.id`
- `localStorage.user.userId`
- `localStorage.user.user_id`
- `localStorage.user.auth_user_id`
- Falls back to Supabase query if not found

### 3. Organization ID Resolution
**Pattern**: Uses `window.resolveOrganizationId()` from `utils.js` for consistency across the app.

### 4. Staff vs Patient Filtering
**Critical**: Staff and patients must be strictly separated:
- `loadOrganizationUsers()` filters out users with `role: 'patient'` (case-insensitive)
- `loadOrganizationPatients()` only loads from patients table
- `compose-message.html` applies additional filtering at load time and display time
- Multiple layers of filtering prevent mixing

### 5. Recipient Name Resolution
**Pattern**: `getUserNameById()` tries in order:
1. Supabase `users` table query
2. Supabase `patients` table query
3. `allStaff` array lookup
4. `allPatients` array lookup
5. localStorage fallback
6. Returns "Unknown User" if all fail

### 6. Auto-Switch to Inbox
**Feature**: When page loads and unread messages exist:
- Automatically switches to Inbox tab
- Shows red badge with unread count on Inbox tab button
- Badge updates dynamically as messages are read

### 7. Delivery Status for Sent Messages
**Feature**: Sent messages show delivery status:
- "✅ Delivered" if recipient has read the message
- "📬 Sent" if not yet read
- Status is resolved via `resolveDeliveryStatuses()` which checks `message_recipients.is_read`

## Known Issues & Fixes Applied

### Fixed Issues

1. **Infinite Recursion in `updateMessageStatus`**
   - **Error**: `RangeError: Maximum call stack size exceeded`
   - **Cause**: Local wrapper function calling itself
   - **Fix**: Removed local wrapper, use `window.updateMessageStatus` directly

2. **Infinite Recursion in `getUserNameById`**
   - **Error**: `RangeError: Maximum call stack size exceeded`
   - **Cause**: Local function in `messages.html` calling `window.getUserNameById` which pointed back to itself
   - **Fix**: Removed local wrapper, use `window.getUserNameById` directly

3. **"Missing user ID or organization ID" Error**
   - **Cause**: `getCurrentUserId()` and `getCurrentOrgId()` not robust enough
   - **Fix**: Made `getCurrentUserId()` async, checks multiple localStorage fields, falls back to Supabase

4. **"Unknown User" in Sent Messages**
   - **Cause**: `getUserNameById()` not querying Supabase directly
   - **Fix**: Enhanced to query Supabase `users` and `patients` tables directly

5. **Recipient Dropdown Issues**
   - **Issues**: Frozen input, showing both staff and patients when only one type selected
   - **Fixes**: 
     - Enabled input, added `autocomplete="off"`
     - Added strict filtering at load time and display time
     - Added `onclick` and `onfocus` handlers to show dropdown

6. **400 Bad Request on Patients Query**
   - **Error**: "column patients.deleted does not exist"
   - **Fix**: Removed `.eq('deleted', false)` from query

7. **400 Bad Request on Patients Query Order**
   - **Error**: "order by clause is not valid"
   - **Fix**: Removed `.order('first_name', { ascending: true })`, implemented client-side sorting

8. **RLS Policy Type Mismatch**
   - **Error**: `ERROR: 42883: operator does not exist: uuid = text`
   - **Fix**: Changed RLS policies from `id = auth.uid()::text` to `auth_user_id = auth.uid()`

9. **Check-in Button Issues**
   - **Issues**: Page refresh on click, timer not activating
   - **Fixes**: 
     - Added `type="button"` to prevent form submission
     - Added `event.preventDefault()` and `event.stopPropagation()`
     - Wrapped in try-catch
     - Created `clearAppointmentsCache()` for cache management

### Current Warnings (Non-Critical)
- Line 157 in `messages.html`: CSS `-webkit-line-clamp` should also define standard `line-clamp` property (compatibility warning, not breaking)

## Testing Procedures

### Manual Testing Checklist

1. **Message Sending**
   - [ ] Send message to staff member
   - [ ] Send message to patient
   - [ ] Send task with due date
   - [ ] Verify message appears in Sent tab
   - [ ] Verify recipient receives notification

2. **Message Receiving**
   - [ ] Receive message as staff
   - [ ] Receive message as patient
   - [ ] Verify unread count badge appears
   - [ ] Verify auto-switch to Inbox tab
   - [ ] Click message to view details
   - [ ] Verify message marked as read

3. **Task Management**
   - [ ] Create task
   - [ ] Mark task as "In Process"
   - [ ] Mark task as "Addressed"
   - [ ] Verify task status updates

4. **Message Actions**
   - [ ] Mark message as read
   - [ ] Archive message
   - [ ] Reply to message
   - [ ] Verify delivery status on sent messages

5. **Recipient Selection**
   - [ ] Select Staff type, verify only staff shown
   - [ ] Select Patient type, verify only patients shown
   - [ ] Search for recipient by name
   - [ ] Select recipient from dropdown

6. **Offline Functionality**
   - [ ] Disconnect from internet
   - [ ] Verify localStorage fallback works
   - [ ] Reconnect and verify sync

## Deployment Process

### Prerequisites
1. Supabase project set up
2. Database migration run: `supabase/migrations/20250125_create_messaging_system.sql`
3. Netlify account configured
4. Environment variables set (if any)

### Deployment Steps
```bash
# Deploy to Netlify production
npx --yes netlify-cli deploy --prod --dir . --message "YOUR_DEPLOY_MESSAGE"
```

### Post-Deployment Verification
1. Check Netlify build logs for errors
2. Verify database migration ran successfully
3. Test message sending/receiving
4. Check browser console for errors
5. Verify RLS policies are working

## Common Debugging Steps

### Issue: Messages Not Loading
1. Check browser console for errors
2. Verify Supabase client is initialized (`window.supabaseClient`)
3. Check RLS policies allow access
4. Verify user ID and organization ID are resolved correctly
5. Check network tab for Supabase API calls

### Issue: "Unknown User" Displayed
1. Check `getUserNameById()` console logs
2. Verify user exists in Supabase `users` or `patients` table
3. Check `auth_user_id` matches between tables
4. Verify `allStaff` and `allPatients` arrays are populated

### Issue: Infinite Recursion
1. Check for local wrapper functions calling `window.*` functions
2. Verify `window.*` functions are defined before use
3. Check call stack in browser console
4. Look for circular references

### Issue: Recipient Dropdown Not Working
1. Check `loadRecipients()` is called
2. Verify `allStaff` and `allPatients` arrays are populated
3. Check filtering logic in `showRecipientDropdown()`
4. Verify input is enabled and has event handlers

## Future Enhancements (Not Implemented)

1. **Group Messages**: UI for selecting multiple recipients (backend supports it)
2. **Message Threading**: Full thread view (partial support via `thread_id`)
3. **File Attachments**: Upload and download attachments
4. **Message Search**: Search messages by subject/body
5. **Message Filtering**: Filter by priority, date, sender
6. **Email Notifications**: Send email when message received
7. **Push Notifications**: Browser push notifications
8. **Message Templates**: Pre-defined message templates
9. **Task Reminders**: Automatic reminders for due tasks
10. **Message Export**: Export messages to PDF/CSV

## Important Notes

1. **Never break existing functionality**: Always test existing features after changes
2. **Follow hybrid architecture**: Always implement Supabase-first with localStorage fallback
3. **RLS is critical**: All database queries must respect RLS policies
4. **User ID resolution**: Must be robust, check multiple sources
5. **Staff/Patient separation**: Must be strictly enforced at multiple levels
6. **Error handling**: Always wrap async operations in try-catch
7. **Console logging**: Extensive logging helps debug issues (can be reduced in production)

## Contact & Support

### Key Files to Review
- `messages.html` - Main UI
- `compose-message.html` - Message composition
- `js/messages.js` - Core logic
- `supabase/migrations/20250125_create_messaging_system.sql` - Database schema

### When Making Changes
1. Test in development first
2. Check browser console for errors
3. Verify Supabase queries work
4. Test offline functionality
5. Deploy to staging before production
6. Monitor Netlify build logs

## Version History

- **2025-01-25**: Initial messaging system implementation
- **2025-01-25**: Fixed infinite recursion issues
- **2025-01-25**: Added auto-switch to Inbox with unread badge
- **2025-01-25**: Fixed "Unknown User" display issue
- **2025-01-25**: Added delivery status for sent messages

---

**Last Updated**: 2025-01-25
**System Status**: Production Ready
**Maintainer**: Next Agent













