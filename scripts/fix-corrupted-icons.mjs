/**
 * Replace corrupted ? / ?? icon placeholders in user-facing HTML with Font Awesome or safe Unicode.
 * Run: node scripts/fix-corrupted-icons.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FA_LINK =
  '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">\n';

const ICON = {
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  xmark: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>',
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  clock: '<i class="fa-solid fa-clock" aria-hidden="true"></i>',
  close: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
  globe: '<i class="fa-solid fa-globe" aria-hidden="true"></i>',
  users: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
  earth: '<i class="fa-solid fa-earth-americas" aria-hidden="true"></i>',
  building: '<i class="fa-solid fa-building-circle-plus" aria-hidden="true"></i>',
  shield: '<i class="fa-solid fa-shield-check" aria-hidden="true"></i>',
  userCheck: '<i class="fa-solid fa-user-check" aria-hidden="true"></i>',
  approve: '<i class="fa-solid fa-check" aria-hidden="true"></i>',
  magnify: '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
  gauge: '<i class="fa-solid fa-gauge-high" aria-hidden="true"></i>',
  key: '<i class="fa-solid fa-key" aria-hidden="true"></i>',
  spinner: '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
  copy: '<i class="fa-solid fa-copy" aria-hidden="true"></i>',
  unlock: '<i class="fa-solid fa-unlock" aria-hidden="true"></i>',
  fileWarn: '<i class="fa-solid fa-file-circle-exclamation" aria-hidden="true"></i>',
};

function ensureFontAwesome(content) {
  if (content.includes("font-awesome") || content.includes("fa-solid")) {
    if (content.includes("font-awesome")) return content;
  }
  if (content.includes("font-awesome")) return content;
  return content.replace(/<title>/, FA_LINK + "  <title>");
}

function patch(file, edits) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) {
    console.warn("skip missing:", file);
    return;
  }
  let content = fs.readFileSync(fp, "utf8");
  const before = content;
  for (const [from, to] of edits) {
    if (typeof from === "string") {
      content = content.split(from).join(to);
    } else {
      content = content.replace(from, to);
    }
  }
  if (content !== before) {
    fs.writeFileSync(fp, content, "utf8");
    console.log("patched:", file);
  }
}

function patchAddSecurityItem(file) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, "utf8");
  if (content.includes("formatSecurityAuditMessage")) return;

  content = ensureFontAwesome(content);

  const oldFn = `    function addSecurityItem(elementId, message, status = 'info') {
      const element = document.getElementById(elementId);
      if (element.textContent.trim() === '') {
        element.style.display = 'block';
      }
      element.innerHTML += \`<div class="security-item \${status}">\${message}</div>\`;`;

  const newFn = `    function formatSecurityAuditMessage(message, status) {
      const icons = {
        success: '${ICON.check}',
        critical: '${ICON.xmark}',
        warning: '${ICON.warn}',
        info: '${ICON.info}'
      };
      let text = String(message)
        .replace(/^\\?\\s+/, '')
        .replace(/^&#9888;\\s+WARNING:\\s+/, 'WARNING: ')
        .replace(/^&#8505;\\s+/, '');
      const icon = icons[status] || icons.info;
      return \`\${icon} \${text}\`;
    }

    function addSecurityItem(elementId, message, status = 'info') {
      const element = document.getElementById(elementId);
      if (element.textContent.trim() === '') {
        element.style.display = 'block';
      }
      element.innerHTML += \`<div class="security-item \${status}">\${formatSecurityAuditMessage(message, status)}</div>\`;`;

  if (content.includes(oldFn)) {
    content = content.replace(oldFn, newFn);
    fs.writeFileSync(fp, content, "utf8");
    console.log("patched addSecurityItem:", file);
  } else {
    console.warn("addSecurityItem block not found:", file);
  }
}

patchAddSecurityItem("security-audit.html");
patchAddSecurityItem("security-audit-simple.html");

patch("platform-dashboard-clean.html", [
  ['<a href="register-clinic" class="action-btn">? Register New Clinic</a>', `<a href="register-clinic" class="action-btn">${ICON.building} Register New Clinic</a>`],
]);
patch("platform-dashboard-clean.html", []); // ensure FA
{
  const fp = path.join(ROOT, "platform-dashboard-clean.html");
  let c = fs.readFileSync(fp, "utf8");
  const updated = ensureFontAwesome(c);
  if (updated !== c) fs.writeFileSync(fp, updated, "utf8");
}

patch("legal-agreement-view.html", [
  ["<h2>? Agreement ID Missing</h2>", `<h2>${ICON.fileWarn} Agreement ID Missing</h2>`],
  ["<h2>? Error Loading Agreement</h2>", `<h2>${ICON.xmark} Error Loading Agreement</h2>`],
]);
{
  const fp = path.join(ROOT, "legal-agreement-view.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("legal-agreements-admin.html", [
  ["? Compliance Verified", `${ICON.shield} Compliance Verified`],
]);
{
  const fp = path.join(ROOT, "legal-agreements-admin.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("patient-medications.html", [
  ["<label>? Frequency</label>", `<label>${ICON.clock} Frequency</label>`],
]);
{
  const fp = path.join(ROOT, "patient-medications.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("patient-results.html", [
  ["${isNormal ? '? Normal' : '? Review'}", "${isNormal ? '" + ICON.check + " Normal' : '" + ICON.magnify + " Review'}"],
]);
{
  const fp = path.join(ROOT, "patient-results.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("healthcare-staff.html", [
  ['<span style="color: #4CAF50;">? Good:</span>', `<span style="color: #4CAF50;">${ICON.check} Good:</span>`],
  ['<h3 style="margin-top: 0; margin-bottom: 20px;">? Global Gender Distribution by Role</h3>', `<h3 style="margin-top: 0; margin-bottom: 20px;">${ICON.globe} Global Gender Distribution by Role</h3>`],
  ['<h3 style="margin: 0 0 20px 0;">? Patient Population by Gender</h3>', `<h3 style="margin: 0 0 20px 0;">${ICON.users} Patient Population by Gender</h3>`],
  ['<h3 style="margin-top: 0; margin-bottom: 15px;">? Gender Distribution by Country & Role</h3>', `<h3 style="margin-top: 0; margin-bottom: 15px;">${ICON.earth} Gender Distribution by Country & Role</h3>`],
]);

patch("clinical-note-clean.html", [
  ['> ? Close</button>', `> ${ICON.close} Close</button>`],
]);
{
  const fp = path.join(ROOT, "clinical-note-clean.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("disease-analytics.html", [
  ["closeBtn.innerHTML = '?';", `closeBtn.innerHTML = '${ICON.close}';`],
]);

patch("my-download-requests.html", [
  ["<h4>? Waiting for Approval</h4>", `<h4>${ICON.clock} Waiting for Approval</h4>`],
  ["<h4>? Request Approved</h4>", `<h4>${ICON.check} Request Approved</h4>`],
]);
{
  const fp = path.join(ROOT, "my-download-requests.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("data-download-approvals.html", [
  ["`<li>? ${a.approver_username}", "`<li>${ICON.userCheck} ${a.approver_username}"],
  ["? Approve Request", `${ICON.approve} Approve Request`],
  ["alert('? Request approved!", "alert('Request approved!"],
  ["alert(`? Approval recorded.", "alert(`Approval recorded."],
]);
{
  const fp = path.join(ROOT, "data-download-approvals.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("change-password.html", [
  ["successMessage.textContent = '? Password changed successfully!", "successMessage.innerHTML = '" + ICON.check + " Password changed successfully!"],
]);
{
  const fp = path.join(ROOT, "change-password.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

patch("register-clinic.html", [
  ["\\? Clinic registered successfully!", "Clinic registered successfully!"],
  ["alert('? Registration failed:", "alert('Registration failed:"],
]);

patch("platform-dashboard.html", [
  ["alert(`? ${result.message}`)", "alert(result.message)"],
  ["unlockResults.push(`? Unlocked:", "unlockResults.push(`Unlocked:"],
  ["unlockResults.push(`? Error unlocking", "unlockResults.push(`Error unlocking"],
  ["let message = `? Account unlocked successfully!", "let message = `Account unlocked successfully!"],
]);

const setupEncryptionReplacements = [
  [".textContent = '? Encryption is already enabled", ".innerHTML = '" + ICON.info + " Encryption is already enabled"],
  [".textContent = '? Medium password'", ".innerHTML = '" + ICON.gauge + " Medium password'"],
  [".textContent = '? Strong password'", ".innerHTML = '" + ICON.check + " Strong password'"],
  [".textContent = '? Passwords do not match", ".innerHTML = '" + ICON.xmark + " Passwords do not match"],
  [".textContent = '? Password must be at least 12 characters", ".innerHTML = '" + ICON.xmark + " Password must be at least 12 characters"],
  [".textContent = '? Password is too weak", ".innerHTML = '" + ICON.warn + " Password is too weak"],
  [".textContent = '? Organization not found", ".innerHTML = '" + ICON.xmark + " Organization not found"],
  [".textContent = '? Initializing encryption", ".innerHTML = '" + ICON.spinner + " Initializing encryption"],
  [".textContent = '? Encryption initialized!", ".innerHTML = '" + ICON.check + " Encryption initialized!"],
  [".textContent = '? Failed to enable encryption:", ".innerHTML = '" + ICON.xmark + " Failed to enable encryption:"],
  ["alert('? Recovery key copied to clipboard!')", "alert('Recovery key copied to clipboard!')"],
  ["alert('? Could not copy", "alert('Could not copy"],
];
patch("setup-encryption.html", setupEncryptionReplacements);
{
  const fp = path.join(ROOT, "setup-encryption.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

const recoverReplacements = [
  [".textContent = '? Please enter your recovery key.'", ".innerHTML = '" + ICON.key + " Please enter your recovery key.'"],
  [".textContent = '? Organization not found", ".innerHTML = '" + ICON.xmark + " Organization not found"],
  [".textContent = '? Initializing encryption with recovery key", ".innerHTML = '" + ICON.spinner + " Initializing encryption with recovery key"],
  [".textContent = '? Recovery successful!", ".innerHTML = '" + ICON.check + " Recovery successful!"],
  [".textContent = '? Recovery failed:", ".innerHTML = '" + ICON.xmark + " Recovery failed:"],
];
patch("recover-encryption.html", recoverReplacements);
{
  const fp = path.join(ROOT, "recover-encryption.html");
  fs.writeFileSync(fp, ensureFontAwesome(fs.readFileSync(fp, "utf8")), "utf8");
}

console.log("fix-corrupted-icons: done");
