// Purpose: Staff detail page for a single patient intake submission
(function() {
  const SUPABASE_TIMEOUT_MS = 10000;
  const detailBody = document.getElementById("detail-body");
  const detailSubtitle = document.getElementById("detail-subtitle");
  const approveBtn = document.getElementById("approve-submission");
  const rejectBtn = document.getElementById("reject-submission");
  const toastEl = document.getElementById("approvals-toast");

  let supabaseClient = null;
  let organizationContext = { id: null, name: null, prefix: "MEC" };
  let reviewerUser = null;
  let activeSubmission = null;
  let resolvedSubmissionId = null;
  const localQueueKey = "mediForge.pendingIntakeSubmissions";

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
        throw new Error("Supabase client failed to initialize for intake details");
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
      typeof window.mfIsMfascOrganization === "function" &&
      window.mfIsMfascOrganization(orgId)
    ) {
      return window.MFASC_DEFAULT_PATIENT_ID_PREFIX || "MFA-SC";
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
      } catch (error) {}
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
      } catch (error) {}
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
      return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
      empty.appendChild(createDetailItem("Entries", "No entries provided."));
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
      const item = createDetailItem(
        key.replace(/_/g, " "),
        Array.isArray(value) ? value.join(", ") : (typeof value === "boolean" ? (value ? "Yes" : "No") : (value || "—"))
      );
      grid.appendChild(item);
    });
    section.appendChild(grid);
    return section;
  }

  function resolveSubmissionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get("submissionId");
    if (!submissionId) {
      return null;
    }
    const trimmed = submissionId.trim();
    // Accept UUIDs or numeric strings
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^\d+$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  function resolveSubmissionKeyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const submissionKey = urlParams.get("submissionKey");
    return submissionKey ? submissionKey.trim() : null;
  }

  function resolveLocalIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const localId = urlParams.get("localId");
    return localId ? localId.trim() : null;
  }

  function getLocalQueue() {
    try {
      return JSON.parse(localStorage.getItem(localQueueKey) || "[]");
    } catch (error) {
      console.warn("[INTAKE-DETAIL] Unable to parse local intake queue:", error);
      return [];
    }
  }

  function hydrateSubmission(entry) {
    return {
      ...entry,
      patient_payload: entry.patient_payload || {},
      custom_field_values: entry.custom_field_values || {}
    };
  }

  async function loadSubmission() {
    const submissionId = resolveSubmissionIdFromUrl();
    const submissionKey = resolveSubmissionKeyFromUrl();
    const localId = resolveLocalIdFromUrl();

    console.info("[INTAKE-DETAIL] loadSubmission params", {
      submissionId,
      submissionKey,
      localId
    });

    if (!submissionId && !submissionKey && !localId) {
      throw new Error("Invalid submission link. Please return to the approvals list and try again.");
    }

    if (localId) {
      const queue = getLocalQueue();
      const entry = queue.find(item => item.localQueueId === localId || item.id === localId);
      if (!entry) {
        throw new Error("Local submission not found. Please sync before approving.");
      }
      const hydrated = hydrateSubmission({
        ...entry,
        id: entry.id || entry.localQueueId,
        status: entry.status || "pending",
        created_at: entry.created_at || entry.submitted_at || entry.submittedAt || entry.queued_at || null,
        patient_payload: entry.patient_payload || entry.patient_payload || entry
      });
      activeSubmission = hydrated;
      renderSubmission(hydrated);
      approveBtn.hidden = true;
      rejectBtn.hidden = true;
      showToast("This submission is stored locally and must be synced before approval.", "error");
      return;
    }

    console.info("[INTAKE-DETAIL] Fetching submissions via RPC", {
      orgId: organizationContext.id
    });
    const rows = await window.secureSupabaseRpc("get_patient_intake_submissions", {
      p_org_id: organizationContext.id,
      p_status: null
    });
    console.info("[INTAKE-DETAIL] RPC rows received", {
      count: Array.isArray(rows) ? rows.length : 0
    });

    const normalized = Array.isArray(rows) ? rows.map(hydrateSubmission) : [];
    const matched = normalized.find(row => {
      if (submissionId) {
        return String(row.id) === String(submissionId) ||
          String(row.submission_id) === String(submissionId) ||
          String(row.submissionId) === String(submissionId);
      }
      if (submissionKey) {
        return String(row.id) === submissionKey ||
          String(row.submission_id) === submissionKey ||
          String(row.submissionId) === submissionKey ||
          String(row.intake_submission_id) === submissionKey;
      }
      return false;
    });
    console.info("[INTAKE-DETAIL] Submission match result", {
      matched: Boolean(matched),
      matchedId: matched?.id || null,
      matchedSubmissionId: matched?.submission_id || null
    });

    if (!matched) {
      throw new Error("Submission not found. It may have been processed already.");
    }

    activeSubmission = matched;
    resolvedSubmissionId = matched.id || matched.submission_id || matched.submissionId || null;
    renderSubmission(matched);
  }

  function renderSubmission(submission) {
    const payload = submission.patient_payload || {};
    const fullName = buildFullName(payload);
    detailSubtitle.textContent = `Submitted ${formatDateTime(submission.created_at)} • Status: ${submission.status}`;

    const personalSection = createDetailSection("Patient Details", [
      createDetailItem("Full Name", fullName),
      createDetailItem("Date of Birth", payload.dob || "—"),
      createDetailItem("Gender", payload.gender || "—"),
      createDetailItem("Marital Status", payload.maritalStatus || "—"),
      createDetailItem("Race", payload.race || "—"),
      createDetailItem("Email", payload.email || "—"),
      createDetailItem("Phone", formatPhone(payload.phone)),
      createDetailItem("Payment Source", payload.paymentSource || "—"),
      createDetailItem("Has Diabetes", payload.hasDiabetes === true ? "Yes" : payload.hasDiabetes === false ? "No" : "—")
    ]);

    const addressSection = createDetailSection("Address", [
      createDetailItem("Address Line 1", payload.addressLine1 || "—"),
      createDetailItem("Address Line 2", payload.addressLine2 || "—"),
      createDetailItem("City / Town", payload.city || "—"),
      createDetailItem("State / Region", payload.state || "—"),
      createDetailItem("Country", payload.country || "—")
    ]);

    const emergencySection = createDetailSection("Emergency Contact", [
      createDetailItem("Full Name", buildEmergencyContact(payload)),
      createDetailItem("Relationship", payload.emergencyRelationship || "—"),
      createDetailItem("Phone", formatPhone(payload.emergencyPhone)),
      createDetailItem("Email", payload.emergencyEmail || "—"),
      createDetailItem("Address Line 1", payload.emergencyAddressLine1 || "—"),
      createDetailItem("Address Line 2", payload.emergencyAddressLine2 || "—"),
      createDetailItem("City / Town", payload.emergencyCity || "—"),
      createDetailItem("State / Region", payload.emergencyState || "—"),
      createDetailItem("Country", payload.emergencyCountry || "—")
    ]);

    const medicalHistorySection = createDetailTableSection(
      "Past Medical History",
      ["Date", "Event / Condition", "Notes"],
      (payload.medicalHistory || []).map(entry => [entry.date || "—", entry.event || "—", entry.notes || "—"])
    );

    const medicationsSection = createDetailTableSection(
      "Patient-Reported Medications",
      ["Name", "Dosage", "Start Date", "End Date", "Notes"],
      (payload.medications || []).map(entry => [
        entry.name || "—",
        entry.dosage || "—",
        entry.startDate || entry.start || "—",
        entry.endDate || entry.end || "—",
        entry.notes || "—"
      ])
    );

    const allergiesSection = createDetailTableSection(
      "Allergies",
      ["Category", "Allergen", "Severity", "Reactions", "Notes"],
      (payload.allergies || []).map(entry => [
        entry.category || "—",
        entry.allergen || "—",
        entry.severity || "—",
        Array.isArray(entry.reactions) ? entry.reactions.join(", ") : (entry.reactions || "—"),
        entry.notes || "—"
      ])
    );

    const immunizationsSection = createDetailTableSection(
      "Immunizations",
      ["Vaccine", "Date", "Notes"],
      (payload.immunizations || []).map(entry => [
        entry.vaccine || "—",
        entry.date || "—",
        entry.notes || "—"
      ])
    );

    const customFieldsSection = renderCustomFieldsSection(submission.custom_field_values);

    detailBody.innerHTML = "";
    [
      personalSection,
      addressSection,
      emergencySection,
      medicalHistorySection,
      medicationsSection,
      allergiesSection,
      immunizationsSection,
      customFieldsSection
    ].forEach(section => {
      if (section) detailBody.appendChild(section);
    });

    const isPending = (submission.status || "").toLowerCase() === "pending";
    approveBtn.hidden = !isPending;
    rejectBtn.hidden = !isPending;
    if (!resolvedSubmissionId) {
      approveBtn.hidden = true;
      rejectBtn.hidden = true;
      showToast("Unable to resolve submission ID. Please refresh.", "error");
    }
  }

  async function approveSubmission() {
    if (!activeSubmission) return;
    if (!window.confirm("Approve this submission and create a patient record?")) return;
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    approveBtn.textContent = "Approving…";

    try {
      const reviewerName = (JSON.parse(localStorage.getItem("user") || "{}").username) || "Unknown Reviewer";
      const submissionId = resolvedSubmissionId || resolveSubmissionIdFromUrl();
      if (!submissionId) {
        throw new Error("Unable to resolve submission ID for approval.");
      }

      await window.secureSupabaseRpc("approve_patient_intake_submission", {
        p_submission_id: submissionId,
        p_prefix: organizationContext.prefix,
        p_reviewer_name: reviewerName,
        p_reviewer_id: reviewerUser?.id || null
      });

      showToast("Submission approved and patient created successfully.", "success");
      setTimeout(() => {
        window.location.href = "patient-intake-approvals";
      }, 600);
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
    const reason = window.prompt("Enter a brief reason for rejection (optional):", "");
    if (reason === null) return;
    rejectBtn.disabled = true;
    approveBtn.disabled = true;
    rejectBtn.textContent = "Rejecting…";

    try {
      const reviewerName = (JSON.parse(localStorage.getItem("user") || "{}").username) || "Unknown Reviewer";
      const submissionId = resolvedSubmissionId || resolveSubmissionIdFromUrl();
      if (!submissionId) {
        throw new Error("Unable to resolve submission ID for rejection.");
      }

      await window.secureSupabaseRpc("reject_patient_intake_submission", {
        p_submission_id: submissionId,
        p_reason: reason?.trim() || null,
        p_reviewer_name: reviewerName,
        p_reviewer_id: reviewerUser?.id || null
      });

      showToast("Submission rejected.", "success");
      setTimeout(() => {
        window.location.href = "patient-intake-approvals";
      }, 600);
    } catch (error) {
      console.error("Unexpected error rejecting submission:", error);
      showToast("We encountered an error rejecting this submission. Please try again.", "error");
    } finally {
      rejectBtn.disabled = false;
      approveBtn.disabled = false;
      rejectBtn.textContent = "Reject Submission";
    }
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
      console.info("[INTAKE-DETAIL] Initializing intake detail page");
      supabaseClient = await waitForSupabase();
      await initializeReviewer();
      organizationContext = await resolveOrganizationContext();
      console.info("[INTAKE-DETAIL] Organization resolved", organizationContext);
      await loadSubmission();
    } catch (error) {
      console.error("[INTAKE-DETAIL] Initialization error", error);
      detailSubtitle.textContent = error.message || "Unable to load submission.";
      showToast("Unable to load submission details.", "error");
    }
  }

  approveBtn?.addEventListener("click", approveSubmission);
  rejectBtn?.addEventListener("click", rejectSubmission);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
