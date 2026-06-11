$json = Get-Content 'mediforge-backup-2025-10-14.json' -Raw | ConvertFrom-Json

Write-Host "`n=== BACKUP ANALYSIS ===" -ForegroundColor Cyan
Write-Host "`nBackup Info:"
Write-Host "  Date: $($json.backupInfo.date)"
Write-Host "  Timestamp: $($json.backupInfo.timestamp)"
Write-Host "  App Version: $($json.backupInfo.appVersion)"

Write-Host "`nData Counts from backupInfo:"
Write-Host "  Organizations: $($json.backupInfo.organizationCount)"
Write-Host "  Users: $($json.backupInfo.userCount)"
Write-Host "  Total Patients: $($json.backupInfo.totalPatients)"
Write-Host "  Total Appointments: $($json.backupInfo.totalAppointments)"

Write-Host "`nActual Data in Backup:"
Write-Host "  Organizations: $($json.organizations.PSObject.Properties.Count)"
Write-Host "  Users Array: $($json.users.Count)"

if ($json.organizationData.'Mecure Clinics') {
    Write-Host "`nMecure Clinics Data:"
    Write-Host "  Patients: $($json.organizationData.'Mecure Clinics'.patients.Count)"
    Write-Host "  Appointments: $($json.organizationData.'Mecure Clinics'.appointments.Count)"
    
    # Check for billing data
    $billingCount = 0
    if ($json.organizationData.'Mecure Clinics'.appointments) {
        foreach ($appt in $json.organizationData.'Mecure Clinics'.appointments) {
            if ($appt.invoice) {
                $billingCount++
            }
        }
    }
    Write-Host "  Appointments with Invoices: $billingCount"
}

Write-Host "`nAudit Logs: $($json.auditLogs.Count)"
Write-Host "`n=== END ANALYSIS ===" -ForegroundColor Cyan



