// NEW APPROACH: Proper Table Layout for ALL Tables
// This script ensures tables use proper table layout with containment to prevent UI spillover

(function() {
    'use strict';
    
    // Function to ensure proper table layout for any table
    function ensureProperTableLayout(table) {
        if (!table) return;
        
        // console.log('Ensuring proper table layout for:', table.className || table.id || 'unnamed table');
        
        // Minimal intervention - just ensure text wrapping
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.setProperty('word-wrap', 'break-word', 'important');
            cell.style.setProperty('overflow-wrap', 'break-word', 'important');
            cell.style.setProperty('hyphens', 'auto', 'important');
            cell.style.setProperty('white-space', 'normal', 'important');
            cell.style.setProperty('box-sizing', 'border-box', 'important');
        });
    }
    
    // Function to apply proper layout to all tables
    function ensureAllTablesAlignment() {
        // Get all tables that need proper layout treatment
        // Note: appointments-table uses table-layout: fixed, so it's excluded from treatment
        const tableSelectors = [
            '#patients-table',
            'table.patients-list-table',
            'table.history-table',
            'table.note-history-table',
            'table.diagnoses-table',
            'table.note-diagnoses-table',
            'table.allergies-table',
            'table.note-allergies-table',
            'table.immunizations-table',
            'table.note-immunizations-table',
            'table.medical-visits-table',
            'table.patient-medications-table',
            'table.prescriptions-summary-table',
            'table.clinical-note-prescriptions-table',
            'table.active-medications-table',
            'table.generated-orders-table',
            'table.generated-referrals-table',
            'table.upcoming-appointments-table',
            'table.non-visit-encounters-table',
            'table.deleted-patients-table',
            'table.encounters-prescriptions-table',
            'table.conditions-breakdown-table',
            'table.condition-stats-table',
            'table.imaging-orders-table',
            'table.lab-orders-table',
            '#vitals-table',
            '#lab-table',
            '#imaging-table'
        ];
        
        tableSelectors.forEach(selector => {
            const tables = document.querySelectorAll(selector);
            tables.forEach(table => {
                ensureProperTableLayout(table);
            });
        });
        
        // Also apply to any other tables that might exist
        const allTables = document.querySelectorAll('table');
        allTables.forEach(table => {
            // Skip if already processed or if it's the appointments table (uses table-layout: fixed)
            // Also skip modal tables that need specific alignment, gaps-summary-table, unaddressed-patients-table, and add-patient tables
            if ((!table.style.display || table.style.display !== 'table') && 
                !table.classList.contains('appointments-table') &&
                !table.classList.contains('order-modal-table') &&
                !table.classList.contains('gaps-summary-table') &&
                !table.classList.contains('unaddressed-patients-table') &&
                !table.classList.contains('add-patient-history-table') &&
                !table.classList.contains('add-patient-diagnoses-table') &&
                !table.classList.contains('add-patient-medications-table') &&
                !table.classList.contains('add-patient-allergies-table') &&
                !table.classList.contains('add-patient-immunizations-table') &&
                table.id !== 'revenue-payments-table') {
                ensureProperTableLayout(table);
            }
        });
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureAllTablesAlignment);
    } else {
        ensureAllTablesAlignment();
    }
    
    // Run when window loads
    window.addEventListener('load', ensureAllTablesAlignment);
    
    // Run when tables are added to the DOM
    const observer = new MutationObserver(function(mutations) {
        let shouldFix = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'TABLE' || (node.querySelector && node.querySelector('table'))) {
            // Skip appointments table, modal tables, gaps-summary-table, unaddressed-patients-table, and add-patient tables
            if (!node.classList || (!node.classList.contains('appointments-table') && !node.classList.contains('order-modal-table') && !node.classList.contains('gaps-summary-table') && !node.classList.contains('unaddressed-patients-table') && !node.classList.contains('add-patient-history-table') && !node.classList.contains('add-patient-diagnoses-table') && !node.classList.contains('add-patient-medications-table') && !node.classList.contains('add-patient-allergies-table') && !node.classList.contains('add-patient-immunizations-table'))) {
                shouldFix = true;
                break;
            }
                        }
                    }
                }
            }
        });
        if (shouldFix) {
            setTimeout(ensureAllTablesAlignment, 100);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
})();
