// Purpose: In-app messaging and task management system
// Features: Send/receive messages, task assignment, notifications, categorized dashboard

// Get data key with organization prefix (use existing if available, otherwise define)
// This ensures compatibility with existing codebase
// CRITICAL FIX: Avoid infinite recursion by checking if we're already the global function
let getDataKey;
if (typeof window.getDataKey === 'function' && window.getDataKey !== getDataKey) {
  // Use existing global getDataKey if it exists and is different
  getDataKey = window.getDataKey;
} else {
  // Define our own implementation
  getDataKey = function(key) {
    const user = JSON.parse(localStorage.getItem("user") || '{}');
    return user && user.org ? `${user.org}_${key}` : key;
  };
  // Make it available globally
  window.getDataKey = getDataKey;
}

// Get current user ID (use existing pattern, try Supabase if needed)
async function getCurrentUserId() {
  if (typeof window.restoreStaffSessionIfNeeded === 'function') {
    try { window.restoreStaffSessionIfNeeded(); } catch (e) { /* ignore */ }
  }
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  // Prefer users table UUID (with hyphens); also accept any non-empty id
  if (user.id && String(user.id).includes('-')) {
    return user.id;
  }
  if (user.userId && String(user.userId).includes('-')) {
    return user.userId;
  }
  if (user.user_id && String(user.user_id).includes('-')) {
    return user.user_id;
  }
  
  // Try to get from Supabase users table using auth_user_id
  if (user.auth_user_id || user.authUserId) {
    const authUserId = user.auth_user_id || user.authUserId;
    if (window.supabaseClient) {
      try {
        const { data: userData, error } = await window.supabaseClient
          .from('users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        
        if (!error && userData && userData.id) {
          return userData.id;
        }
      } catch (error) {
        console.warn('⚠️ Error fetching user ID from Supabase:', error);
      }
    }
  }

  // Last resort: active Supabase auth session → users.auth_user_id
  if (window.supabaseClient?.auth) {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session?.user?.id) {
        const { data: userData, error } = await window.supabaseClient
          .from('users')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        if (!error && userData?.id) return userData.id;
      }
    } catch (e) {
      console.warn('⚠️ getCurrentUserId from auth session:', e);
    }
  }
  
  return user.id || null;
}

// Get current organization ID (use standardized utility if available)
async function getCurrentOrgId() {
  // Use standardized utility from utils.js if available
  if (typeof window.resolveOrganizationId === 'function') {
    const orgId = await window.resolveOrganizationId();
    if (orgId) return orgId;
  }
  
  // Fallback to direct lookup
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user.organizationId && user.organizationId.includes('-')) {
    return user.organizationId;
  }
  if (user.organization_id && user.organization_id.includes('-')) {
    return user.organization_id;
  }
  if (user.org && user.org.includes('-')) {
    return user.org;
  }
  
  // Try organizations lookup
  if (user.org) {
    const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
    const orgData = organizations[user.org];
    if (orgData && orgData.id) {
      return orgData.id;
    }
  }
  
  return null;
}

function isPatientMessagingRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'patient' || r === 'client' || r === 'client-patient';
}

function mapStaffRecipient(u) {
  const userId = u.id || u.userId || u.user_id || null;
  return {
    id: userId,
    name: `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() || u.username || u.email || 'Staff',
    username: u.username,
    role: u.role || 'Staff',
    email: u.email,
    type: 'staff'
  };
}

function readLocalStaffUsers(orgId) {
  const keys = [];
  try {
    if (typeof getDataKey === 'function') keys.push(getDataKey('users'));
  } catch (e) { /* ignore */ }
  keys.push('users');

  const seen = new Set();
  const out = [];
  keys.forEach((key) => {
    let raw = [];
    try {
      raw = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      raw = [];
    }
    if (!Array.isArray(raw)) return;
    raw.forEach((u) => {
      if (!u) return;
      const userOrgId = u.organizationId || u.organization_id;
      if (orgId && userOrgId && userOrgId !== orgId) return;
      if (isPatientMessagingRole(u.role)) return;
      const mapped = mapStaffRecipient(u);
      if (!mapped.id || seen.has(mapped.id)) return;
      seen.add(mapped.id);
      out.push(mapped);
    });
  });
  return out;
}

// Load all users in organization for message recipients (staff only)
async function loadOrganizationUsers() {
  try {
    if (typeof window.restoreStaffSessionIfNeeded === 'function') {
      window.restoreStaffSessionIfNeeded();
    }
    if (typeof window.ensureStaffSession === 'function') {
      try {
        await window.ensureStaffSession({ redirectOnFailure: false });
      } catch (e) {
        console.warn('[messages] ensureStaffSession:', e);
      }
    }

    const orgId = await getCurrentOrgId();
    const currentUserId = await getCurrentUserId();
    if (!orgId) {
      console.warn('⚠️ No organization ID found for staff recipients');
      return [];
    }

    let supabaseClient = window.supabaseClient;
    if (!supabaseClient && typeof window.initSupabase === 'function') {
      window.initSupabase();
      supabaseClient = window.supabaseClient;
    }
    if (!supabaseClient && typeof window.waitForSupabaseClient === 'function') {
      try {
        await window.waitForSupabaseClient();
        supabaseClient = window.supabaseClient;
      } catch (e) { /* continue */ }
    }

    if (supabaseClient) {
      try {
        console.log('🔍 [SUPABASE FIRST] Loading staff from Supabase, orgId:', orgId);
        // Do not require is_active=true - NULL/false would empty the dropdown for many clinics
        let { data: users, error } = await supabaseClient
          .from('users')
          .select('id, username, first_name, last_name, role, email, is_active')
          .eq('organization_id', orgId)
          .order('first_name', { ascending: true });

        if (error) {
          console.warn('⚠️ [SUPABASE] Error loading users:', error);
          users = null;
        }

        // Retry without order if the sort column is missing in some envs
        if (error && /order|column/i.test(String(error.message || ''))) {
          const retry = await supabaseClient
            .from('users')
            .select('id, username, first_name, last_name, role, email, is_active')
            .eq('organization_id', orgId);
          if (!retry.error) {
            users = retry.data;
            error = null;
          }
        }

        if (!error && Array.isArray(users) && users.length > 0) {
          const staffUsers = users.filter((u) => {
            if (!u || !u.id) return false;
            if (isPatientMessagingRole(u.role)) return false;
            if (u.is_active === false) return false;
            if (currentUserId && u.id === currentUserId) return false;
            return true;
          });

          if (staffUsers.length > 0) {
            const staffList = staffUsers.map(mapStaffRecipient).filter((u) => u.id);
            console.log('✅ [SUPABASE] Loaded staff:', staffList.length, 'of', users.length, 'users');
            return staffList;
          }
          console.warn('⚠️ [SUPABASE] No staff after filtering from', users.length, 'users');
        } else {
          console.warn('⚠️ [SUPABASE] No users returned for org', orgId);
        }
      } catch (supabaseError) {
        console.error('❌ [SUPABASE] Exception loading users:', supabaseError);
      }
    } else {
      console.warn('⚠️ [SUPABASE] Client not available, using localStorage fallback');
    }

    console.log('📦 [FALLBACK] Loading staff from localStorage...');
    const staffList = readLocalStaffUsers(orgId).filter((u) => !currentUserId || u.id !== currentUserId);
    console.log('✅ [FALLBACK] Loaded staff from localStorage:', staffList.length);
    return staffList;
  } catch (error) {
    console.error('❌ Error loading organization users:', error);
    return [];
  }
}

// Load all patients in organization for message recipients
async function loadOrganizationPatients() {
  try {
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      console.warn('⚠️ No organization ID found');
      return [];
    }

    // SUPABASE FIRST: Try Supabase with proper initialization check
    let supabaseClient = window.supabaseClient;
    
    // Wait a bit for Supabase to initialize if it's not ready yet
    if (!supabaseClient && typeof window.initSupabase === 'function') {
      console.log('🔄 [SUPABASE] Client not ready, attempting initialization...');
      const initialized = window.initSupabase();
      if (initialized) {
        supabaseClient = window.supabaseClient;
      }
    }
    
    if (supabaseClient) {
      try {
        console.log('🔍 [SUPABASE FIRST] Loading patients from Supabase, orgId:', orgId);
        // Query without order clause to avoid 400 errors - we'll sort in JavaScript
        // Note: Removed .eq('deleted', false) as the patients table may not have a 'deleted' column
        const { data: patients, error } = await supabaseClient
          .from('patients')
          .select('id, patient_id, first_name, last_name, middle_name, email, phone')
          .eq('organization_id', orgId);
        
        if (error) {
          console.warn('⚠️ [SUPABASE] Error loading patients:', error.message || error);
          // Fall through to localStorage fallback
        } else if (patients && Array.isArray(patients) && patients.length > 0) {
          // Sort manually by first name
          const sortedPatients = [...patients].sort((a, b) => {
            const nameA = (a.first_name || '').toLowerCase();
            const nameB = (b.first_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          
          const patientList = sortedPatients.map(p => {
            const rawPid = p.patient_id || '';
            const displayPid =
              typeof window.patientMrnDisplay === 'function'
                ? window.patientMrnDisplay(p, rawPid)
                : (rawPid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPid) ? rawPid : ':');
            return {
              id: p.id,
              name: `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim(),
              patientId: displayPid === ':' ? '' : displayPid,
              email: p.email,
              phone: p.phone,
              type: 'patient'
            };
          });
          console.log('✅ [SUPABASE] Loaded patients:', patientList.length);
          return patientList; // Return immediately - Supabase first!
        } else {
          console.warn('⚠️ [SUPABASE] No patients returned (empty array or null)');
          // Fall through to localStorage fallback
        }
      } catch (supabaseError) {
        console.error('❌ [SUPABASE] Exception loading patients:', supabaseError);
        // Fall through to localStorage fallback
      }
    } else {
      console.warn('⚠️ [SUPABASE] Client not available, using localStorage fallback');
    }

    // Fallback to localStorage using universal data loader
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      const patientsData = await window.loadPatientsWithSupabasePriority();
      // Handle both array and object responses
      const patients = Array.isArray(patientsData) ? patientsData : (patientsData?.received || patientsData?.patients || []);
      
      if (!Array.isArray(patients)) {
        console.warn('⚠️ loadPatientsWithSupabasePriority did not return an array:', patientsData);
        return [];
      }
      
      const patientList = patients.map(p => ({
        id: p.id,
        name: `${p.firstName || p.first_name || ''} ${p.middleName || p.middle_name || ''} ${p.lastName || p.last_name || ''}`.trim(),
        patientId: p.patient_id || p.patientId,
        email: p.email,
        phone: p.phone,
        type: 'patient' // Explicitly set type
      }));
      console.log('✅ Loaded patients from localStorage:', patientList.length);
      return patientList;
    }

    return [];
  } catch (error) {
    console.error('❌ Error loading organization patients:', error);
    return [];
  }
}

// Load messages with Supabase priority
async function loadMessagesWithSupabasePriority(forceRefresh = false) {
  try {
    const userId = await getCurrentUserId();
    const orgId = await getCurrentOrgId();

    if (!userId || !orgId) {
      console.warn('⚠️ Missing user ID or organization ID');
      return { received: [], sent: [] };
    }

    // Try Supabase first
    if (window.supabaseClient) {
      // Load received messages (where user is recipient)
      const { data: receivedMessages, error: receivedError } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('organization_id', orgId)
        .eq('recipient_id', userId)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      // Also check message_recipients for group messages
      const { data: groupRecipients, error: groupError } = await window.supabaseClient
        .from('message_recipients')
        .select('*, messages(*)')
        .eq('recipient_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      // Load sent messages
      const { data: sentMessages, error: sentError } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('organization_id', orgId)
        .eq('sender_id', userId)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (!receivedError && !sentError) {
        // Process received messages
        let received = (receivedMessages || []).map(convertSupabaseMessage);
        
        // Add group messages
        if (!groupError && groupRecipients) {
          const groupMessages = groupRecipients
            .filter(mr => mr.messages)
            .map(mr => {
              const converted = convertSupabaseMessage(mr);
              // Override with recipient-specific status
              converted.isRead = mr.is_read || false;
              converted.readAt = mr.read_at;
              converted.taskStatus = mr.task_status || converted.taskStatus;
              return converted;
            });
          received = [...received, ...groupMessages];
        }

        // Deduplicate (same message can appear via recipient_id and message_recipients)
        const seenIds = new Set();
        received = received.filter((m) => {
          if (!m || !m.id || seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        });

        // Process sent messages
        const sent = (sentMessages || []).map(convertSupabaseMessage);

        // Save to localStorage for offline use
        localStorage.setItem(getDataKey("messages_received"), JSON.stringify(received));
        localStorage.setItem(getDataKey("messages_sent"), JSON.stringify(sent));

        return { received, sent };
      }
    }

    // Fallback to localStorage
    const received = JSON.parse(localStorage.getItem(getDataKey("messages_received")) || "[]");
    const sent = JSON.parse(localStorage.getItem(getDataKey("messages_sent")) || "[]");
    return { received, sent };
  } catch (error) {
    console.error('❌ Error loading messages:', error);
    const received = JSON.parse(localStorage.getItem(getDataKey("messages_received")) || "[]");
    const sent = JSON.parse(localStorage.getItem(getDataKey("messages_sent")) || "[]");
    return { received, sent };
  }
}

// Convert Supabase message format to localStorage format
// Handles both direct messages and messages from message_recipients join
function convertSupabaseMessage(msg) {
  // Handle nested message from message_recipients join
  const message = msg.messages || msg;
  
  return {
    id: message.id,
    subject: message.subject,
    body: message.body,
    messageType: message.message_type || 'message',
    priority: message.priority || 'normal',
    senderId: message.sender_id,
    recipientId: message.recipient_id,
    taskStatus: msg.task_status || message.task_status || 'outstanding', // Use recipient status if available
    taskDueDate: message.task_due_date,
    taskCompletedAt: message.task_completed_at,
    taskCompletedBy: message.task_completed_by,
    parentMessageId: message.parent_message_id,
    threadId: message.thread_id,
    isRead: msg.is_read !== undefined ? msg.is_read : (message.is_read || false), // Use recipient read status if available
    readAt: msg.read_at || message.read_at,
    isArchived: msg.is_archived !== undefined ? msg.is_archived : (message.is_archived || false),
    archivedAt: msg.archived_at || message.archived_at,
    attachments: message.attachments || [],
    createdAt: message.created_at,
    updatedAt: message.updated_at
  };
}

// Send message to one or more staff recipients (messages + message_recipients)
async function sendMessage(messageData) {
  try {
    const userId = await getCurrentUserId();
    const orgId = await getCurrentOrgId();

    if (!userId || !orgId) {
      throw new Error('Missing user ID or organization ID');
    }

    const recipientIds = Array.isArray(messageData.recipientIds)
      ? messageData.recipientIds.filter(Boolean)
      : (messageData.recipientId ? [messageData.recipientId] : []);

    if (!recipientIds.length) {
      throw new Error('Please select at least one recipient');
    }

    const uniqueRecipientIds = [...new Set(recipientIds)];
    const isGroup = uniqueRecipientIds.length > 1;
    // Single: set recipient_id (notification trigger). Multi: null + message_recipients + notifications.
    const primaryRecipientId = isGroup ? null : uniqueRecipientIds[0];

    const message = {
      organization_id: orgId,
      subject: messageData.subject,
      body: messageData.body,
      message_type: messageData.messageType || 'message',
      priority: messageData.priority || 'normal',
      sender_id: userId,
      recipient_id: primaryRecipientId,
      task_status: messageData.taskStatus || 'outstanding',
      task_due_date: messageData.taskDueDate || null,
      thread_id: messageData.threadId || null,
      parent_message_id: messageData.parentMessageId || null,
      attachments: messageData.attachments || []
    };

    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Always record junction rows so multi-recipient inbox works; single also OK with dedupe on load
      {
        const recipients = uniqueRecipientIds.map((recipientId) => ({
          message_id: data.id,
          recipient_id: recipientId,
          organization_id: orgId,
          task_status: messageData.taskStatus || 'outstanding'
        }));

        const { error: recipError } = await window.supabaseClient
          .from('message_recipients')
          .insert(recipients);
        if (recipError) {
          console.warn('⚠️ message_recipients insert:', recipError);
        }
      }

      // Notification trigger only covers messages.recipient_id - notify everyone for group sends
      if (isGroup) {
        const notifs = uniqueRecipientIds.map((rid) => ({
          organization_id: orgId,
          user_id: rid,
          message_id: data.id,
          type: (messageData.messageType === 'task') ? 'task_assigned' : 'new_message',
          title: messageData.subject,
          body: String(messageData.body || '').slice(0, 200),
          priority: messageData.priority || 'normal',
          action_url: '/messages?message=' + data.id
        }));
        const { error: notifError } = await window.supabaseClient
          .from('notifications')
          .insert(notifs);
        if (notifError) {
          console.warn('⚠️ group notifications insert:', notifError);
        }
      }

      const localMessage = convertSupabaseMessage(data);
      const sent = JSON.parse(localStorage.getItem(getDataKey('messages_sent')) || '[]');
      sent.unshift(localMessage);
      localStorage.setItem(getDataKey('messages_sent'), JSON.stringify(sent));

      return localMessage;
    }

    const localMessage = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
      recipientIds: uniqueRecipientIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sent = JSON.parse(localStorage.getItem(getDataKey('messages_sent')) || '[]');
    sent.unshift(localMessage);
    localStorage.setItem(getDataKey('messages_sent'), JSON.stringify(sent));

    return localMessage;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

/**
 * Staff → patient messages go through portal_messages (not messages.recipient_id,
 * which only accepts users.id).
 */
async function sendStaffMessageToPatients(patientIds, subject, body) {
  const orgId = await getCurrentOrgId();
  const userId = await getCurrentUserId();
  if (!orgId || !userId) throw new Error('Missing user ID or organization ID');
  if (!window.supabaseClient) throw new Error('Database connection not available');

  const ids = [...new Set((patientIds || []).filter(Boolean))];
  if (!ids.length) throw new Error('Please select at least one patient');

  const text = [subject ? String(subject).trim() : '', String(body || '').trim()]
    .filter(Boolean)
    .join('\n\n');
  if (!text) throw new Error('Message body is required');

  const errors = [];
  for (const patientId of ids) {
    try {
      if (window.MediForgePatientPortal && typeof window.MediForgePatientPortal.staffReplyToPatient === 'function') {
        await window.MediForgePatientPortal.staffReplyToPatient(patientId, orgId, text);
      } else {
        const { error } = await window.supabaseClient.from('portal_messages').insert({
          organization_id: orgId,
          patient_id: patientId,
          from_patient: false,
          sender_user_id: userId,
          body: text,
          is_read_by_patient: false,
          is_read_by_staff: true
        });
        if (error) throw error;
      }
    } catch (e) {
      errors.push(`${patientId}: ${e.message || e}`);
    }
  }

  if (errors.length === ids.length) {
    throw new Error('Could not deliver to patients: ' + errors.join('; '));
  }
  if (errors.length) {
    console.warn('⚠️ Partial patient message delivery:', errors);
  }
  return { sent: ids.length - errors.length, failed: errors.length };
}

// Update message status (read, archived, task status)
async function updateMessageStatus(messageId, updates) {
  try {
    const userId = await getCurrentUserId();
    const orgId = await getCurrentOrgId();

    if (!userId || !orgId) {
      throw new Error('Missing user ID or organization ID');
    }

    // Try Supabase first
    if (window.supabaseClient) {
      const updateData = {};
      if (updates.isRead !== undefined) {
        updateData.is_read = updates.isRead;
        updateData.read_at = updates.isRead ? new Date().toISOString() : null;
      }
      if (updates.isArchived !== undefined) {
        updateData.is_archived = updates.isArchived;
        updateData.archived_at = updates.isArchived ? new Date().toISOString() : null;
        updateData.archived_by = updates.isArchived ? userId : null;
      }
      if (updates.taskStatus !== undefined) {
        updateData.task_status = updates.taskStatus;
        if (updates.taskStatus === 'completed' || updates.taskStatus === 'addressed') {
          updateData.task_completed_at = new Date().toISOString();
          updateData.task_completed_by = userId;
        }
      }

      const { error } = await window.supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', messageId)
        .eq('organization_id', orgId);

      if (error) {
        throw error;
      }

      // Also update message_recipients if it's a group message
      if (updates.taskStatus !== undefined || updates.isRead !== undefined) {
        const recipientUpdate = {};
        if (updates.isRead !== undefined) {
          recipientUpdate.is_read = updates.isRead;
          recipientUpdate.read_at = updates.isRead ? new Date().toISOString() : null;
        }
        if (updates.taskStatus !== undefined) {
          recipientUpdate.task_status = updates.taskStatus;
        }

        if (Object.keys(recipientUpdate).length > 0) {
          await window.supabaseClient
            .from('message_recipients')
            .update(recipientUpdate)
            .eq('message_id', messageId)
            .eq('recipient_id', userId);
        }
      }
    }

    // Update localStorage
    const received = JSON.parse(localStorage.getItem(getDataKey("messages_received")) || "[]");
    const sent = JSON.parse(localStorage.getItem(getDataKey("messages_sent")) || "[]");
    
    const allMessages = [...received, ...sent];
    const messageIndex = allMessages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      Object.assign(allMessages[messageIndex], updates);
      if (updates.isRead) {
        allMessages[messageIndex].readAt = new Date().toISOString();
      }
      if (updates.isArchived) {
        allMessages[messageIndex].archivedAt = new Date().toISOString();
      }
      if (updates.taskStatus) {
        allMessages[messageIndex].taskStatus = updates.taskStatus;
        if (updates.taskStatus === 'completed' || updates.taskStatus === 'addressed') {
          allMessages[messageIndex].taskCompletedAt = new Date().toISOString();
          allMessages[messageIndex].taskCompletedBy = userId;
        }
      }

      // Save back to appropriate list
      if (received.find(m => m.id === messageId)) {
        localStorage.setItem(getDataKey("messages_received"), JSON.stringify(received));
      } else {
        localStorage.setItem(getDataKey("messages_sent"), JSON.stringify(sent));
      }
    }
  } catch (error) {
    console.error('❌ Error updating message status:', error);
    throw error;
  }
}

// Load notifications
async function loadNotifications() {
  try {
    const userId = await getCurrentUserId();
    const orgId = await getCurrentOrgId();

    if (!userId || !orgId) {
      return [];
    }

    // Try Supabase first
    if (window.supabaseClient) {
      const { data: notifications, error } = await window.supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && notifications) {
        localStorage.setItem(getDataKey("notifications"), JSON.stringify(notifications));
        return notifications;
      }
    }

    // Fallback to localStorage
    return JSON.parse(localStorage.getItem(getDataKey("notifications")) || "[]");
  } catch (error) {
    console.error('❌ Error loading notifications:', error);
    return JSON.parse(localStorage.getItem(getDataKey("notifications")) || "[]");
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  try {
    const userId = await getCurrentUserId();

    if (window.supabaseClient) {
      await window.supabaseClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);
    }

    // Update localStorage
    const notifications = JSON.parse(localStorage.getItem(getDataKey("notifications")) || "[]");
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.is_read = true;
      notification.read_at = new Date().toISOString();
      localStorage.setItem(getDataKey("notifications"), JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
}

// Mark notification as addressed (user has taken appropriate action)
async function markNotificationAsAddressed(notificationId) {
  try {
    const userId = await getCurrentUserId();

    if (window.supabaseClient) {
      await window.supabaseClient
        .from('notifications')
        .update({ is_addressed: true, addressed_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);
    }

    // Update localStorage
    const notifications = JSON.parse(localStorage.getItem(getDataKey("notifications")) || "[]");
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.is_addressed = true;
      notification.addressed_at = new Date().toISOString();
      localStorage.setItem(getDataKey("notifications"), JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('❌ Error marking notification as addressed:', error);
  }
}

// Get unread message count (messages + notifications for dashboard badge)
async function getUnreadMessageCount() {
  try {
    const messages = await loadMessagesWithSupabasePriority();
    const msgCount = messages.received.filter(m => !m.isRead && !m.isArchived).length;
    let notifCount = 0;
    try {
      const notifications = await loadNotifications();
      notifCount = (notifications || []).filter(n => !n.is_read).length;
    } catch (_) {}
    return msgCount + notifCount;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}

// Get user name by ID
// Get user name by ID (checks both users and patients tables)
async function getUserNameById(userId) {
  try {
    if (!userId) return 'Unknown User';
    
    // Try Supabase first - check users table
    if (window.supabaseClient) {
      // First, try users table
      const { data: user, error: userError } = await window.supabaseClient
        .from('users')
        .select('first_name, last_name, username')
        .eq('id', userId)
        .single();
      
      if (!userError && user) {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        return name || user.username || 'Unknown User';
      }
      
      // If not found in users, try patients table
      const { data: patient, error: patientError } = await window.supabaseClient
        .from('patients')
        .select('first_name, last_name, middle_name, patient_id')
        .eq('id', userId)
        .single();
      
      if (!patientError && patient) {
        const name = `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim();
        const rawPid = String(patient.patient_id || '').trim();
        const pidUi =
          typeof window.patientMrnDisplay === 'function'
            ? window.patientMrnDisplay(rawPid)
            : (/^[Mm][Ii][Nn][0-9]{4}$/.test(rawPid) ? '\u2014' : rawPid);
        return name || `Patient ${pidUi}` || 'Unknown Patient';
      }
    }
    
    // Fallback: Check loaded staff and patients
    try {
      const staff = await loadOrganizationUsers();
      const staffMember = staff.find(u => u.id === userId);
      if (staffMember) {
        return staffMember.name || 'Unknown User';
      }
      
      const patients = await loadOrganizationPatients();
      const patient = patients.find(p => p.id === userId);
      if (patient) {
        return patient.name || 'Unknown Patient';
      }
    } catch (loadError) {
      console.warn('Error loading recipients for name lookup:', loadError);
    }
    
    // Final fallback to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => (u.id === userId) || (u.userId === userId) || (u.user_id === userId));
    if (user) {
      const name = `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim();
      return name || user.username || 'Unknown User';
    }
    
    return 'Unknown User';
  } catch (error) {
    console.error('❌ Error getting user name:', error);
    return 'Unknown User';
  }
}

// Export functions
window.sendMessage = sendMessage;
window.sendStaffMessageToPatients = sendStaffMessageToPatients;
window.updateMessageStatus = updateMessageStatus;
window.loadMessagesWithSupabasePriority = loadMessagesWithSupabasePriority;
window.loadOrganizationUsers = loadOrganizationUsers;
window.loadOrganizationPatients = loadOrganizationPatients;
window.loadNotifications = loadNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markNotificationAsAddressed = markNotificationAsAddressed;
window.getUnreadMessageCount = getUnreadMessageCount;
window.getUserNameById = getUserNameById;

