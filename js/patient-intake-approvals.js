// Purpose: Staff dashboard logic for reviewing, approving, and rejecting patient intake submissions

(function() {
  const VERBOSE_LOGGING = localStorage.getItem("enableVerboseLogs") === "true";
  const trace = () => {};
  const traceWarn = () => {};
  const traceError = () => {};

  const FILTER_DEFAULT = "pending";
  const statusSummaryEl = document.getElementById("submissions-summary");
  const submissionListEl = document.getElementById("submission-list");
  const submissionEmptyEl = document.getElementById("submission-empty");
  const filterButtons = document.querySelectorAll(".filter-button");
  const shareLinkInput = document.getElementById("intake-share-link");
  const copyShareLinkBtn = document.getElementById("copy-share-link");
  const orgBannerEl = document.getElementById("approvals-org-banner");
  const orgNameEl = document.getElementById("approvals-org-name");
  const orgSubtitleEl = document.getElementById("approvals-org-subtitle");
  const userChipEl = document.getElementById("approvals-user-chip");
  const userFooterEl = document.getElementById("approvals-user-footer");
  const detailDrawer = document.getElementById("detail-drawer");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailSubtitle = document.getElementById("detail-subtitle");
  const approveBtn = document.getElementById("approve-submission");
  const rejectBtn = document.getElementById("reject-submission");
  const closeDetailBtn = document.getElementById("close-detail");
  const toastEl = document.getElementById("approvals-toast");

  const localQueueKey = "mediForge.pendingIntakeSubmissions";
  const SUPABASE_TIMEOUT_MS = 10000;

  let supabaseClient = null;
  let organizationContext = { id: null, name: null, prefix: "MEC" };
  let currentFilter = FILTER_DEFAULT;
  let submissions = [];
  let activeSubmission = null;
  let reviewerUser = null;
  let localOnlyMode = false;
  let hasLocalSupplements = false;
  let localFallbackMessage = "";
  let filterFallbackNotice = "";

  if (!submissionListEl) {
    traceWarn("Patient intake approvals container not found. Skipping script.");
    return;
  }

  function showToast(message, variant = "default") {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.style.background =
      variant === "error" ? "rgba(200,30,30,0.92)" :
      variant === "success" ? "rgba(5,125,107,0.92)" :
      "#102a43";
    toastEl.classList.add("visible");
    setTimeout(() => toastEl.classList.remove("visible"), 3200);
  }

  async function waitForSupabase() {
    const start = Date.now();
    while (!window.supabaseClient) {
      if (Date.now() - start > SUPABASE_TIMEOUT_MS) {
        throw new Error("Supabase client failed to initialize for approvals dashboard");
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return window.supabaseClient;
  }

  async function derivePrefix(name, orgId) {
    const client = supabaseClient || window.supabaseClient;
    if (client && orgId) {
      try {
        const { data: org } = await client.from("organizations").select("settings").eq("id", orgId).maybeSingle();
        if (org?.settings?.patient_id_prefix && typeof org.settings.patient_id_prefix === "string") {
          return org.settings.patient_id_prefix.trim().toUpperCase();
        }
      } catch (e) { /* fall through */ }
    }
    if (
      orgId &&
      typeof window.ehrIsMfascOrganization === "function" &&
      window.ehrIsMfascOrganization(orgId)
    ) {
      return window.EHR_MFASC_DEFAULT_PATIENT_ID_PREFIX || "MFA-SC";
    }
    try {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const org = Object.values(organizations || {}).find(entry => entry?.id === orgId);
      if (org?.settings?.patient_id_prefix) return String(org.settings.patient_id_prefix).trim().toUpperCase();
      if (org?.name) return org.name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) || "MEC";
    } catch (error) { /* ignore */ }
    if (name) {
      const sanitized = name.replace(/[^A-Za-z]/g, "").toUpperCase();
      if (sanitized.length >= 3) return sanitized.slice(0, 3);
    }
    return "MEC";
  }

  function getStaffSession() {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (error) {
      return {};
    }
  }

  function buildStaffDisplayName(staff) {
    if (!staff) return "Unknown user";
    const fullName = [staff.firstName, staff.lastName].map(part => (part || "").trim()).filter(Boolean).join(" ");
    return fullName || staff.username || staff.email || staff.phone || "Staff user";
  }

  function updateOrgContextUI() {
    if (!organizationContext || !orgBannerEl) return;
    const displayName = organizationContext.name || "Your Clinic";
    if (orgNameEl) orgNameEl.textContent = displayName;
    if (orgSubtitleEl) {
      orgSubtitleEl.textContent = `Reviewing intake submissions for ${displayName}`;
      orgSubtitleEl.hidden = false;
    }
    orgBannerEl.hidden = false;
  }

  function updateUserContextUI() {
    const staff = getStaffSession();
    const displayName = buildStaffDisplayName(staff);
    const orgLabel = organizationContext?.name || staff.org || staff.organization || "—";
    if (userChipEl) {
      userChipEl.textContent = `${displayName} · ${orgLabel}`;
      userChipEl.hidden = false;
    }
    if (userFooterEl) {
      userFooterEl.textContent = `${displayName} from ${orgLabel} is signed in`;
      userFooterEl.hidden = false;
    }
  }

  async function resolveOrganizationContext() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgId = urlParams.get("org");
    const urlOrgName = urlParams.get("orgName");

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const platformContext = JSON.parse(localStorage.getItem("platformAdminContext") || "{}");

    let orgId = urlOrgId || user.organizationId || user.organization_id || user.orgId || platformContext.organizationId || null;
    let orgName = urlOrgName || user.org || user.organizationName || platformContext.organizationName || null;

    if (!orgId && typeof user.org === "string" && user.org.includes("-")) {
      orgId = user.org;
    }

    if (!orgId && user.org && supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("organizations")
          .select("id, name")
          .eq("name", user.org)
          .maybeSingle();
        if (!error && data) {
          orgId = data.id;
          orgName = data.name;
        }
      } catch (error) {
      traceWarn("Could not resolve organization ID from name:", error.message);
      }
    }

    if (!orgName && orgId && supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .maybeSingle();
        if (!error && data?.name) {
          orgName = data.name;
        }
      } catch (error) {
      traceWarn("Could not resolve organization name from ID:", error.message);
      }
    }

    if (!orgId) {
      throw new Error("Unable to determine organization. Please sign in again or contact support.");
    }

    const prefix = await derivePrefix(orgName || "MEC", orgId);
    return {
      id: orgId,
      name: orgName || "Your Clinic",
      prefix
    };
  }

  function formatDateTime(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch (error) {
      return value;
    }
  }

  function formatPhone(value) {
    return value && value.trim() ? value.trim() : "—";
  }

  function buildFullName(payload) {
    const parts = [payload.firstName, payload.middleName, payload.lastName]
      .map(part => (part || "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(" ") : "Unnamed Patient";
  }

  function buildEmergencyContact(payload) {
    const contactName = [payload.emergencyFirstName, payload.emergencyLastName]
      .map(part => (part || "").trim())
      .filter(Boolean)
      .join(" ");
    return contactName || "—";
  }

  function getLocalQueue() {
    try {
      return JSON.parse(localStorage.getItem(localQueueKey) || "[]");
    } catch (error) {
      traceWarn("Unable to parse local intake queue:", error);
      return [];
    }
  }

  function clearLocalSubmission(submissionId) {
    const queue = getLocalQueue();
    if (!queue.length) return;
    const filtered = queue.filter(entry => entry.localQueueId !== submissionId && entry.id !== submissionId);
    localStorage.setItem(localQueueKey, JSON.stringify(filtered));
  }

  function mapLocalSubmission(entry) {
    const payload = entry.patient_payload ? { ...entry.patient_payload } : {};
    payload.firstName = payload.firstName || entry.first_name || "";
    payload.middleName = payload.middle_name || payload.middleName || entry.middle_name || "";
    payload.lastName = payload.lastName || entry.last_name || "";
    payload.email = payload.email || entry.email || "";
    payload.phone = payload.phone || entry.phone || "";
    payload.medicalHistory = payload.medicalHistory || entry.medical_history || [];
    payload.medications = payload.medications || entry.medications || [];
    payload.allergies = payload.allergies || entry.allergies || [];
    payload.immunizations = payload.immunizations || entry.immunizations || [];

    return {
      id: entry.id || entry.localQueueId || `local_${Math.random().toString(36).slice(2, 10)}`,
      status: entry.status || "pending",
      created_at: entry.created_at || entry.submitted_at || entry.submittedAt || entry.queued_at || null,
      patient_payload: payload,
      custom_field_values: entry.custom_field_values || {},
      isLocalOnly: true
    };
  }

  function loadSubmissionsFromLocal(status = FILTER_DEFAULT, { reason } = {}) {
    localOnlyMode = true;
    hasLocalSupplements = false;
    localFallbackMessage = reason || "";

    const queue = getLocalQueue().filter(entry => entry.organization_id === organizationContext.id);
    const filtered = status === "all"
      ? queue
      : queue.filter(entry => (entry.status || "pending") === status);

    submissions = filtered.map(mapLocalSubmission);
    renderSubmissions();
  }

  function buildLocalPatientRecord(payload, patientId, createdAt, intakeSubmissionId, customFieldValues) {
    let emergencyAddressLine1 = payload.emergencyAddressLine1 || "";
    let emergencyAddressLine2 = payload.emergencyAddressLine2 || "";
    let emergencyCity = payload.emergencyCity || "";
    let emergencyState = payload.emergencyState || "";
    let emergencyCountry = payload.emergencyCountry || "";

    const emergencyAddressMissing =
      !emergencyAddressLine1 &&
      !emergencyAddressLine2 &&
      !emergencyCity &&
      !emergencyState &&
      !emergencyCountry;

    if (emergencyAddressMissing) {
      emergencyAddressLine1 = payload.addressLine1 || "";
      emergencyAddressLine2 = payload.addressLine2 || "";
      emergencyCity = payload.city || "";
      emergencyState = payload.state || "";
      emergencyCountry = payload.country || "";
    }

    const emergencyAddressCombined = [
      emergencyAddressLine1,
      emergencyAddressLine2,
      emergencyCity,
      emergencyState,
      emergencyCountry
    ]
      .map(part => (part || "").trim())
      .filter(Boolean)
      .join(", ");

    return {
      id: patientId,
      firstName: payload.firstName || "",
      middleName: payload.middleName || "",
      lastName: payload.lastName || "",
      dob: payload.dob || "",
      gender: payload.gender || "",
      maritalStatus: payload.maritalStatus || "",
      tribe: payload.tribe || "",
      email: payload.email || "",
      phone: payload.phone || "",
      addressLine1: payload.addressLine1 || "",
      addressLine2: payload.addressLine2 || "",
      city: payload.city || "",
      state: payload.state || "",
      country: payload.country || "",
      emergencyFirstName: payload.emergencyFirstName || "",
      emergencyLastName: payload.emergencyLastName || "",
      emergencyRelationship: payload.emergencyRelationship || "",
      emergencyPhone: payload.emergencyPhone || "",
      emergencyEmail: payload.emergencyEmail || "",
      emergencyAddressLine1,
      emergencyAddressLine2,
      emergencyCity,
      emergencyState,
      emergencyCountry,
      emergencyAddressCombined,
      hasDiabetes: Boolean(payload.hasDiabetes),
      paymentSource: payload.paymentSource || "",
      visits: [],
      preventiveGaps: [],
      medicalHistory: payload.medicalHistory || [],
      medications: payload.medications || [],
      allergies: payload.allergies || [],
      immunizations: payload.immunizations || [],
      intakeCustomFields: customFieldValues || {},
      intakeSubmissionId,
      createdFromIntake: true,
      createdAt: createdAt || new Date().toISOString()
    };
  }

  function refreshLocalPatientsCache(patientRecord) {
    try {
      const key = getDataKey("patients");
      const patients = JSON.parse(localStorage.getItem(key) || "[]");
      patients.push(patientRecord);
      localStorage.setItem(key, JSON.stringify(patients));
    } catch (error) {
      traceWarn("Unable to update local patient cache:", error);
    }
  }

  function resolveSubmissionId(submission) {
    if (!submission) return null;
    const candidate = submission.submission_id
      ?? submission.submissionId
      ?? submission.intake_submission_id
      ?? submission.intakeSubmissionId
      ?? submission.patient_payload?.submission_id
      ?? submission.patient_payload?.submissionId
      ?? submission.id;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
      }
    }
    return null;
  }

  function createDetailItem(label, value) {
    const item = document.createElement("div");
    item.className = "detail-item";

    const labelEl = document.createElement("span");
    labelEl.className = "detail-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "detail-value";
    valueEl.textContent = value || "—";

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    return item;
  }

  function createDetailSection(title, items) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    items.forEach(item => grid.appendChild(item));
    section.appendChild(grid);

    return section;
  }

  function createDetailTableSection(title, columns, rows) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "detail-item";
      const labelEl = document.createElement("span");
      labelEl.className = "detail-label";
      labelEl.textContent = "Entries";
      const valueEl = document.createElement("span");
      valueEl.className = "detail-value";
      valueEl.textContent = "No entries provided.";
      empty.appendChild(labelEl);
      empty.appendChild(valueEl);
      section.appendChild(empty);
      return section;
    }

    const table = document.createElement("table");
    table.className = "detail-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach(col => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(row => {
      const tr = document.createElement("tr");
      row.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell || "—";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    section.appendChild(table);

    return section;
  }

  function buildStatusBadge(status, { isLocal } = {}) {
    const normalized = (status || "unknown").toString().toLowerCase();
    const span = document.createElement("span");
    span.className = `status-badge status-${normalized}`;
    span.textContent = isLocal ? `${status || "pending"} (offline)` : (status || "unknown");
    if (isLocal) {
      span.classList.add("status-offline");
    }
    return span;
  }

  function buildSubmissionCard(submission) {
    const card = document.createElement("div");
    card.className = "submission-card";
    card.dataset.id = submission.id;
    const isLocal = Boolean(submission.isLocalOnly);
    if (isLocal) {
      card.classList.add("submission-card-local");
    }

    const meta = document.createElement("div");
    meta.className = "submission-meta";

    const nameHeading = document.createElement("h3");
    nameHeading.textContent = buildFullName(submission.patient_payload);

    const submittedLine = document.createElement("span");
    submittedLine.textContent = isLocal
      ? "Awaiting sync — stored locally on this device"
      : `Submitted ${formatDateTime(submission.created_at)}`;

    const contactLine = document.createElement("span");
    contactLine.textContent = `Phone: ${formatPhone(submission.patient_payload.phone)} · Email: ${submission.patient_payload.email || "—"}`;

    meta.appendChild(nameHeading);
    meta.appendChild(submittedLine);
    meta.appendChild(contactLine);

    const actions = document.createElement("div");
    actions.className = "submission-actions";

    actions.appendChild(buildStatusBadge(submission.status, { isLocal }));

    const reviewButton = document.createElement("button");
    reviewButton.type = "button";
    reviewButton.className = "btn btn-primary";
    reviewButton.textContent = isLocal
      ? "View (sync required)"
      : (submission.status === "pending" ? "Review submission" : "View details");
    reviewButton.addEventListener("click", () => openDetail(submission));
    actions.appendChild(reviewButton);

    card.appendChild(meta);
    card.appendChild(actions);
    return card;
  }

  function renderSubmissions() {
    submissionListEl.innerHTML = "";

    if (!submissions.length) {
      submissionEmptyEl.hidden = false;
      submissionListEl.hidden = true;
      statusSummaryEl.textContent = localOnlyMode
        ? (localFallbackMessage || "No locally queued submissions found.")
        : "No submissions available.";
      return;
    }

    submissionEmptyEl.hidden = true;
    submissionListEl.hidden = false;

    submissions.forEach(submission => {
      submissionListEl.appendChild(buildSubmissionCard(submission));
    });

    const notices = [];
    if (filterFallbackNotice) notices.push(filterFallbackNotice);
    if (localOnlyMode) {
      notices.push(localFallbackMessage || "Showing locally stored submissions.");
    } else if (hasLocalSupplements) {
      notices.push("Includes locally stored submissions awaiting sync.");
    }
    const prefix = notices.length ? `${notices.join(" ")} ` : "";
    const readableFilter = currentFilter === "all" ? "all statuses" : currentFilter;
    const summaryText = `${prefix}${submissions.length} submission${submissions.length === 1 ? "" : "s"} found (${readableFilter}).`;
    statusSummaryEl.textContent = summaryText;
  }

  async function loadSubmissions(status = FILTER_DEFAULT) {
    const normalizedStatus = (status || FILTER_DEFAULT).toLowerCase();
    currentFilter = normalizedStatus;

    filterButtons.forEach(button => {
      const buttonStatus = (button.dataset.status || FILTER_DEFAULT).toLowerCase();
      button.classList.toggle("active", buttonStatus === currentFilter);
    });

    submissions = [];
    submissionListEl.innerHTML = "";
    submissionEmptyEl.hidden = true;
    statusSummaryEl.textContent = "Loading submissions…";
    localOnlyMode = false;
    hasLocalSupplements = false;
    localFallbackMessage = "";
    filterFallbackNotice = "";

    let rows = [];
    let rpcError = null;

    try {
      if (typeof window.secureSupabaseRpc === "function") {
        const rpcData = await window.secureSupabaseRpc(
          "get_patient_intake_submissions",
          {
            p_org_id: organizationContext.id,
            p_status: normalizedStatus === "all" ? null : normalizedStatus
          }
        );
        if (Array.isArray(rpcData)) {
          rows = rpcData;
        }
      } else {
        throw new Error("secureSupabaseRpc helper is unavailable");
      }
    } catch (error) {
      rpcError = error;
      if (VERBOSE_LOGGING) {
        traceWarn("RPC get_patient_intake_submissions failed:", error);
      }
    }

    if (!rows.length && normalizedStatus !== "all") {
      try {
        if (typeof window.secureSupabaseRpc === "function") {
          const fallbackData = await window.secureSupabaseRpc(
            "get_patient_intake_submissions",
            { p_org_id: organizationContext.id, p_status: null }
          );
          if (Array.isArray(fallbackData) && fallbackData.length) {
            rows = fallbackData;
            filterFallbackNotice = `No submissions found for "${normalizedStatus}". Showing all submissions instead.`;
          }
        } else {
          throw new Error("secureSupabaseRpc helper is unavailable");
        }
      } catch (fallbackError) {
        if (VERBOSE_LOGGING) {
          traceWarn("Fallback RPC call failed:", fallbackError);
        }
      }
    }

    if (!rows.length && rpcError) {
      loadSubmissionsFromLocal(status, {
        reason: "Unable to reach clinic submissions. Showing locally stored submissions from this device."
      });

      if (!submissions.length) {
        statusSummaryEl.textContent = "Unable to load submissions right now. Please refresh.";
        submissionEmptyEl.hidden = false;
      }
      return;
    }
    const filteredRows = normalizedStatus === "all"
      ? rows
      : rows.filter(entry => (entry.status || "").toLowerCase() === normalizedStatus);

    submissions = filteredRows.map(entry => {
      const numericId = Number.isInteger(entry.submission_id)
        ? entry.submission_id
        : (Number.isInteger(entry.id) ? entry.id : null);
      const parsedSubmissionId = typeof entry.submission_id === "string" && /^\d+$/.test(entry.submission_id.trim())
        ? Number(entry.submission_id.trim())
        : null;
      return {
        ...entry,
        submission_id: numericId ?? parsedSubmissionId ?? entry.submission_id ?? entry.submissionId ?? entry.intake_submission_id ?? entry.intakeSubmissionId,
        submissionId: numericId ?? parsedSubmissionId ?? entry.submission_id ?? entry.submissionId ?? entry.intake_submission_id ?? entry.intakeSubmissionId,
        patient_payload: entry.patient_payload || {},
        custom_field_values: entry.custom_field_values || {}
      };
    });

    const localQueue = getLocalQueue().filter(entry => entry.organization_id === organizationContext.id);
    if (localQueue.length) {
      const eligible = normalizedStatus === "all"
        ? localQueue
        : localQueue.filter(entry => (entry.status || "pending").toString().toLowerCase() === normalizedStatus);
      if (eligible.length) {
        hasLocalSupplements = true;
        submissions = submissions.concat(eligible.map(mapLocalSubmission));
      }
    }

    renderSubmissions();
    console.info("[INTAKE-APPROVALS] Loaded submissions", {
      count: submissions.length,
      sample: submissions.slice(0, 3).map(item => ({
        id: item.id,
        submission_id: item.submission_id,
        submissionId: item.submissionId,
        status: item.status,
        isLocalOnly: item.isLocalOnly
      }))
    });
  }

  function renderCustomFieldsSection(customFields) {
    if (!customFields || Object.keys(customFields).length === 0) {
      return null;
    }

    const section = document.createElement("section");
    section.className = "detail-section";

    const heading = document.createElement("h3");
    heading.textContent = "Additional Intake Responses";
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    Object.entries(customFields).forEach(([key, value]) => {
      const item = createDetailItem(key.replace(/_/g, " "), Array.isArray(value) ? value.join(", ") : (typeof value === "boolean" ? (value ? "Yes" : "No") : (value || "—")));
      grid.appendChild(item);
    });
    section.appendChild(grid);
    return section;
  }

  function openDetail(submission) {
    const submissionId = resolveSubmissionId(submission);
    if (submissionId) {
      console.info("[INTAKE-APPROVALS] Opening detail page for submission", {
        submissionId,
        status: submission?.status,
        isLocalOnly: submission?.isLocalOnly
      });
      window.location.href = `patient-intake-approval-details?submissionId=${submissionId}`;
      return;
    }

    if (submission?.isLocalOnly) {
      console.warn("[INTAKE-APPROVALS] Local-only submission; opening detail in read-only mode", {
        localId: submission?.id
      });
      window.location.href = `patient-intake-approval-details?localId=${encodeURIComponent(submission.id)}`;
      return;
    }

    const submissionKey = submission?.submission_id ?? submission?.submissionId ?? submission?.id ?? null;
    if (submissionKey) {
      console.info("[INTAKE-APPROVALS] Opening detail page with submissionKey", {
        submissionKey,
        status: submission?.status
      });
      window.location.href = `patient-intake-approval-details?submissionKey=${encodeURIComponent(submissionKey)}`;
      return;
    }

    console.error("[INTAKE-APPROVALS] Unable to resolve submission ID for review", {
      submission
    });
    showToast("Unable to open this submission. Please refresh or sync.", "error");
  }

  function closeDetail() {
    detailDrawer.classList.remove("active");
    detailDrawer.hidden = true;
    activeSubmission = null;
  }

  async function approveSubmission() {
    if (!activeSubmission) return;
    if (activeSubmission.isLocalOnly) {
      showToast("Sync this submission to Supabase before approving from the dashboard.", "error");
      return;
    }
    if (!window.confirm("Approve this submission and create a patient record?")) {
      return;
    }

    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    approveBtn.textContent = "Approving…";

    try {
      if (typeof window.secureSupabaseRpc !== "function") {
        throw new Error("secureSupabaseRpc helper is unavailable");
      }

      const payload = activeSubmission.patient_payload || {};
      const reviewerName = (JSON.parse(localStorage.getItem("user") || "{}").username) || "Unknown Reviewer";

      const submissionId = resolveSubmissionId(activeSubmission);
      if (!submissionId) {
        throw new Error("Unable to resolve submission ID for approval.");
      }

      const approvalData = await window.secureSupabaseRpc(
        "approve_patient_intake_submission",
        {
          p_submission_id: submissionId,
          p_prefix: organizationContext.prefix,
          p_reviewer_name: reviewerName,
          p_reviewer_id: reviewerUser?.id || null
        }
      );

      const approvalInfo = Array.isArray(approvalData) ? approvalData[0] : approvalData;
      const patientIdentifier = approvalInfo?.patient_identifier || approvalInfo?.patient_id || null;
      const createdAt = new Date().toISOString();

      if (patientIdentifier) {
        const localPatient = buildLocalPatientRecord(
          payload,
          patientIdentifier,
          createdAt,
          submissionId,
          activeSubmission.custom_field_values
        );
        localPatient.emergencyAddressLine1 = payload.emergencyAddressLine1 || "";
        localPatient.emergencyAddressLine2 = payload.emergencyAddressLine2 || "";
        localPatient.emergencyCity = payload.emergencyCity || "";
        localPatient.emergencyState = payload.emergencyState || "";
        localPatient.emergencyCountry = payload.emergencyCountry || "";
        refreshLocalPatientsCache(localPatient);
      }

      clearLocalSubmission(activeSubmission.id);
      showToast("Submission approved and patient created successfully.", "success");

      if (typeof window.logAuditEvent === "function") {
        window.logAuditEvent("intake_submission_approved", {
          submissionId: submissionId,
          patientId: approvalInfo?.patient_identifier || null,
          reviewer: reviewerName
        });
      }

      closeDetail();
      await loadSubmissions(currentFilter);
    } catch (error) {
      console.error("Unexpected error approving submission:", error);
      showToast("We encountered an error approving this submission. Please try again.", "error");
    } finally {
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
      approveBtn.textContent = "Approve & Create Patient";
    }
  }

  async function rejectSubmission() {
    if (!activeSubmission) return;
    if (activeSubmission.isLocalOnly) {
      showToast("Sync this submission to Supabase before rejecting from the dashboard.", "error");
      return;
    }
    const reason = window.prompt("Enter a brief reason for rejection (optional):", "");
    if (reason === null) return; // Cancelled

    rejectBtn.disabled = true;
    approveBtn.disabled = true;
    rejectBtn.textContent = "Rejecting…";

    try {
      if (typeof window.secureSupabaseRpc !== "function") {
        throw new Error("secureSupabaseRpc helper is unavailable");
      }

      const reviewerId = reviewerUser?.id || null;
      const reviewerName = (JSON.parse(localStorage.getItem("user") || "{}").username) || "Unknown Reviewer";

      const submissionId = resolveSubmissionId(activeSubmission);
      if (!submissionId) {
        throw new Error("Unable to resolve submission ID for rejection.");
      }

      await window.secureSupabaseRpc("reject_patient_intake_submission", {
        p_submission_id: submissionId,
        p_reason: reason?.trim() || null,
        p_reviewer_name: reviewerName,
        p_reviewer_id: reviewerId
      });

      clearLocalSubmission(activeSubmission.id);
      showToast("Submission rejected.", "success");

      if (typeof window.logAuditEvent === "function") {
        window.logAuditEvent("intake_submission_rejected", {
          submissionId: submissionId,
          reviewer: reviewerName,
          reason: reason?.trim() || null
        });
      }

      closeDetail();
      await loadSubmissions(currentFilter);
    } catch (error) {
      console.error("Unexpected error rejecting submission:", error);
      showToast("We encountered an error rejecting this submission. Please try again.", "error");
    } finally {
      rejectBtn.disabled = false;
      approveBtn.disabled = false;
      rejectBtn.textContent = "Reject Submission";
    }
  }

  async function copyShareLink() {
    const link = shareLinkInput?.value;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Patient intake link copied to clipboard.", "success");
    } catch (error) {
      console.warn("Clipboard copy failed:", error);
      shareLinkInput.select();
      document.execCommand("copy");
      showToast("Copied link using fallback method.", "success");
    }
  }

  async function updateShareLink() {
    const url = new URL("patient-intake", window.location.origin);
    url.searchParams.set("org", organizationContext.id);
    if (organizationContext.name) {
      url.searchParams.set("orgName", organizationContext.name);
    }
    url.searchParams.set("source", "intake-invite");
    shareLinkInput.value = url.toString();
  }

  async function initializeReviewer() {
    try {
      const { data, error } = await supabaseClient.auth.getUser();
      if (!error) {
        reviewerUser = data?.user || null;
      }
    } catch (error) {
      reviewerUser = null;
    }
  }

  async function initialize() {
    try {
      supabaseClient = await waitForSupabase();
      await initializeReviewer();
      organizationContext = await resolveOrganizationContext();
      updateOrgContextUI();
      updateUserContextUI();
      await updateShareLink();
      await loadSubmissions(FILTER_DEFAULT);
    } catch (error) {
      console.error("Initialization error in patient intake approvals:", error);
      statusSummaryEl.textContent = error.message || "Unable to initialize approvals dashboard.";
      submissionEmptyEl.hidden = false;
    }
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      filterButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      loadSubmissions(button.dataset.status || FILTER_DEFAULT);
    });
  });

  copyShareLinkBtn?.addEventListener("click", copyShareLink);
  approveBtn?.addEventListener("click", approveSubmission);
  rejectBtn?.addEventListener("click", rejectSubmission);
  closeDetailBtn?.addEventListener("click", closeDetail);
  detailDrawer?.addEventListener("click", event => {
    if (event.target === detailDrawer) {
      closeDetail();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && detailDrawer?.classList.contains("active")) {
      closeDetail();
    }
  });

  document.addEventListener("DOMContentLoaded", initialize);
})();


