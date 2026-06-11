-- Update Mecure Clinics with complete address information and correct org code

UPDATE organizations
SET 
    address = '1 Oregun Street',
    address_line1 = '1 Oregun Street',
    address_line2 = '',
    city = 'Opebi',
    state = 'Lagos',
    country = 'Nigeria',
    phone = '08033123394',
    org_code = 'MEC-2025-JB8C',  -- Matching backup
    updated_at = NOW()
WHERE name = 'Mecure Clinics';

-- Verify the update
SELECT 
    name,
    address,
    address_line1,
    address_line2,
    city,
    state,
    country,
    phone,
    org_code,
    created_at,
    updated_at
FROM organizations
WHERE name = 'Mecure Clinics';

