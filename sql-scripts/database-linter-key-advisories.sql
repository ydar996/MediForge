-- ---------------------------------------------------------------------------
-- Reproduce Supabase DB linter findings for three common security advisories
-- (Splinter-aligned). Run in SQL Editor connected to your project DB.
--
-- Advisories approximated here:
--   - rls_disabled_in_public           (lint 0013)
--   - policy_exists_rls_disabled       (lint 0007)
--   - sensitive_columns_exposed        (lint 0023)
--
-- Schemas exposed to PostgREST: Splinter reads current_setting('pgrst.db_schemas').
-- In the Editor that GUC may be unset; COALESCE(.., 'public') matches typical projects.
-- If you expose tables from other schemas via the API, add them to exposed_schemas.
-- ---------------------------------------------------------------------------

WITH excluded_schemas AS (
  SELECT unnest(ARRAY[
    '_timescaledb_cache', '_timescaledb_catalog', '_timescaledb_config', '_timescaledb_internal',
    'auth', 'cron', 'extensions', 'graphql', 'graphql_public', 'information_schema',
    'net', 'pgmq', 'pgroonga', 'pgsodium', 'pgsodium_masks', 'pgtle', 'pgbouncer',
    'pg_catalog', 'realtime', 'repack', 'storage', 'supabase_functions', 'supabase_migrations',
    'tiger', 'topology', 'vault'
  ]::text[]) AS schema_name
),
exposed_schemas AS (
  SELECT DISTINCT trim(x) AS schema_name
  FROM unnest(
    string_to_array(
      coalesce(nullif(trim(current_setting('pgrst.db_schemas', true)), ''), 'public'),
      ','
    )
  ) AS t(x)
  WHERE trim(x) <> ''
),
dependency_ext AS (
  SELECT DISTINCT dep.objid
  FROM pg_catalog.pg_depend dep
  WHERE dep.deptype = 'e'
),
-- 0007: policies exist but RLS not enabled on the table
policy_rls_disabled AS (
  SELECT
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    array_agg(p.polname::text ORDER BY p.polname::text) AS policy_names
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON p.polrelid = c.oid
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  LEFT JOIN dependency_ext dep ON dep.objid = c.oid
  WHERE c.relkind = 'r'
    AND NOT c.relrowsecurity
    AND n.nspname::text NOT IN (SELECT schema_name FROM excluded_schemas)
    AND dep.objid IS NULL
  GROUP BY n.nspname, c.relname
),
-- 0013: RLS disabled, table selectable by anon or authenticated via API-exposed schemas
rls_disabled AS (
  SELECT
    n.nspname::text AS schema_name,
    c.relname::text AS table_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relkind = 'r'
    AND NOT c.relrowsecurity
    AND (
      pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
    )
    AND n.nspname::text NOT IN (SELECT schema_name FROM excluded_schemas)
    AND n.nspname::text IN (SELECT schema_name FROM exposed_schemas)
),
-- 0023 helpers
sensitive_patterns AS (
  SELECT unnest(array[
    'password', 'passwd', 'pwd', 'passphrase',
    'secret', 'secret_key', 'private_key', 'api_key', 'apikey',
    'auth_key', 'token', 'jwt', 'access_token', 'refresh_token',
    'oauth_token', 'session_token', 'bearer_token', 'auth_code',
    'session_id', 'session_key', 'session_secret',
    'recovery_code', 'backup_code', 'verification_code',
    'otp', 'two_factor', '2fa_secret', '2fa_code',
    'ssn', 'social_security', 'social_security_number',
    'driver_license', 'drivers_license', 'license_number',
    'passport_number', 'passport_id', 'national_id', 'tax_id',
    'credit_card', 'card_number', 'cvv', 'cvc', 'cvn',
    'bank_account', 'account_number', 'routing_number',
    'iban', 'swift_code', 'bic',
    'health_record', 'medical_record', 'patient_id',
    'insurance_number', 'health_insurance', 'medical_insurance',
    'treatment',
    'mac_address', 'macaddr', 'imei', 'device_uuid',
    'pgp_key', 'gpg_key', 'ssh_key', 'certificate',
    'license_key', 'activation_key',
    'facial_recognition'
  ]::text[]) AS pattern
),
exposed_tables AS (
  SELECT
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    c.oid AS table_oid
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relkind = 'r'
    AND (
      pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
    )
    AND n.nspname::text NOT IN (SELECT schema_name FROM excluded_schemas)
    AND n.nspname::text IN (SELECT schema_name FROM exposed_schemas)
    AND NOT c.relrowsecurity
),
sensitive_hit AS (
  SELECT
    et.schema_name,
    et.table_name,
    a.attname::text AS column_name,
    sp.pattern AS matched_pattern
  FROM exposed_tables et
  JOIN pg_catalog.pg_attribute a
    ON a.attrelid = et.table_oid
   AND a.attnum > 0
   AND NOT a.attisdropped
  CROSS JOIN sensitive_patterns sp
  WHERE replace(lower(a.attname::text), '-', '_') = sp.pattern
)
SELECT
  'policy_exists_rls_disabled'::text AS advisory,
  schema_name,
  table_name,
  policy_names::text AS extra
FROM policy_rls_disabled
UNION ALL
SELECT
  'rls_disabled_in_public'::text,
  schema_name,
  table_name,
  NULL::text
FROM rls_disabled
UNION ALL
SELECT
  'sensitive_columns_exposed'::text,
  schema_name,
  table_name,
  string_agg(
    column_name::text || ' ← ' || matched_pattern::text,
    ', '
    ORDER BY column_name::text, matched_pattern::text
  )::text AS extra
FROM sensitive_hit
GROUP BY schema_name, table_name
ORDER BY advisory, schema_name, table_name;
