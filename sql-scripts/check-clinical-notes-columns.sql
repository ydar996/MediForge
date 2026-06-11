SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
ORDER BY ordinal_position;


