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
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  // Try multiple possible field names for user ID
  if (user.id && user.id.includes('-')) {
    return user.id; // UUID format
  }
  if (user.userId && user.userId.includes('-')) {
    return user.userId;
  }
  if (user.user_id && user.user_id.includes('-')) {
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
  
  return null;
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

// Load all users in organization for message recipients (staff only)
async function loadOrganizationUsers() {
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
      console.log('🔄 Supabase client not ready, attempting initialization...');
      const initialized = window.initSupabase();
      if (initialized) {
        supabaseClient = window.supabaseClient;
      }
    }
    
    if (supabaseClient) {
      try {
        console.log('🔍 [SUPABASE FIRST] Loading staff from Supabase, orgId:', orgId);
        const { data: users, error } = await supabaseClient
          .from('users')
          .select('id, username, first_name, last_name, role, email')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('first_name', { ascending: true });
        
        if (error) {
          console.warn('⚠️ [SUPABASE] Error loading users:', error);
          // Fall through to localStorage fallback
        } else if (users && Array.isArray(users) && users.length > 0) {
          // Filter out patients (case-insensitive) after fetching
          // This handles both 'patient' and 'Patient' and any other case variations
          const staffUsers = users.filter(u => {
            const role = (u.role || '').toLowerCase();
            return role !== 'patient';
          });

          if (staffUsers && staffUsers.length > 0) {
            const staffList = staffUsers.map(u => ({
              id: u.id,
              name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
              username: u.username,
              role: u.role,
              email: u.email,
              type: 'staff' // Explicitly set type
            }));
            console.log('✅ [SUPABASE] Loaded staff:', staffList.length, 'Total users:', users.length);
            console.log('✅ [SUPABASE] Staff roles:', [...new Set(staffList.map(s => s.role))]);
            return staffList; // Return immediately - Supabase first!
          } else {
            console.warn('⚠️ [SUPABASE] No staff found after filtering patients from', users.length, 'users');
            // Fall through to localStorage fallback
          }
        } else {
          console.warn('⚠️ [SUPABASE] No users returned (empty array or null)');
          // Fall through to localStorage fallback
        }
      } catch (supabaseError) {
        console.error('❌ [SUPABASE] Exception loading users:', supabaseError);
        // Fall through to localStorage fallback
      }
    } else {
      console.warn('⚠️ [SUPABASE] Client not available, using localStorage fallback');
    }

    // LOCALSTORAGE FALLBACK: Only if Supabase failed or unavailable
    console.log('📦 [FALLBACK] Loading staff from localStorage...');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const orgUsers = users.filter(u => {
      const userOrgId = u.organizationId || u.organization_id;
      const role = (u.role || '').toLowerCase();
      return userOrgId === orgId && role !== 'patient';
    });

    const staffList = orgUsers.map(u => {
      // Ensure id exists - try multiple possible fields
      const userId = u.id || u.userId || u.user_id || u.auth_user_id || null;
      if (!userId) {
        console.warn('⚠️ [FALLBACK] User missing id field:', u);
      }
      return {
        id: userId || `temp-${u.username}-${Date.now()}`, // Fallback ID if missing
        name: `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() || u.username,
        username: u.username,
        role: u.role,
        email: u.email,
        type: 'staff' // Explicitly set type
      };
    }).filter(u => u.id); // Remove any without valid id
    
    console.log('✅ [FALLBACK] Loaded staff from localStorage:', staffList.length);
    if (staffList.length === 0) {
      console.warn('⚠️ [FALLBACK] No staff found in localStorage. Check organization ID:', orgId);
    }
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
          
          const patientList = sortedPatients.map(p => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim(),
            patientId: p.patient_id,
            email: p.email,
            phone: p.phone,
            type: 'patient' // Explicitly set type
          }));
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

// Send message
async function sendMessage(messageData) {
  try {
    const userId = await getCurrentUserId();
    const orgId = await getCurrentOrgId();

    if (!userId || !orgId) {
      throw new Error('Missing user ID or organization ID');
    }

    const message = {
      organization_id: orgId,
      subject: messageData.subject,
      body: messageData.body,
      message_type: messageData.messageType || 'message',
      priority: messageData.priority || 'normal',
      sender_id: userId,
      recipient_id: messageData.recipientId || null,
      task_status: messageData.taskStatus || 'outstanding',
      task_due_date: messageData.taskDueDate || null,
      thread_id: messageData.threadId || null,
      parent_message_id: messageData.parentMessageId || null,
      attachments: messageData.attachments || []
    };

    // Try Supabase first
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // If group message (multiple recipients), create message_recipients records
      if (messageData.recipientIds && messageData.recipientIds.length > 0) {
        const recipients = messageData.recipientIds.map(recipientId => ({
          message_id: data.id,
          recipient_id: recipientId,
          organization_id: orgId,
          task_status: messageData.taskStatus || 'outstanding'
        }));

        await window.supabaseClient
          .from('message_recipients')
          .insert(recipients);
      }

      // Save to localStorage
      const localMessage = convertSupabaseMessage(data);
      const sent = JSON.parse(localStorage.getItem(getDataKey("messages_sent")) || "[]");
      sent.unshift(localMessage);
      localStorage.setItem(getDataKey("messages_sent"), JSON.stringify(sent));

      return localMessage;
    }

    // Fallback to localStorage only
    const localMessage = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sent = JSON.parse(localStorage.getItem(getDataKey("messages_sent")) || "[]");
    sent.unshift(localMessage);
    localStorage.setItem(getDataKey("messages_sent"), JSON.stringify(sent));

    return localMessage;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
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
window.updateMessageStatus = updateMessageStatus;
window.loadMessagesWithSupabasePriority = loadMessagesWithSupabasePriority;
window.loadOrganizationUsers = loadOrganizationUsers;
window.loadOrganizationPatients = loadOrganizationPatients;
window.loadNotifications = loadNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markNotificationAsAddressed = markNotificationAsAddressed;
window.getUnreadMessageCount = getUnreadMessageCount;
window.getUserNameById = getUserNameById;

