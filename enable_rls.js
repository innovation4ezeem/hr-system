const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const tables = [
  'notifications',
  'system_audit_logs',
  'system_settings',
  'scoring_categories',
  'performance_sheets',
  'historical_records',
  'archive_runs',
  'leave_workflow_configs',
  'leave_holidays',
  'leave_types',
  'leave_balances',
  'leave_balance_ledger',
  'leave_requests',
  'leave_request_days',
  'leave_approvals',
  'leave_calendar_entries',
  'leave_control_state',
  'leave_archive',
  'leave_year_config',
  'performance_config',
  'employee_service_years',
  'penalty_types',
  'penalties',
  'employee_leave_attendance_records',
  'performance_inputs',
  'performance_scores',
  'users',
  'profile_update_requests',
  'activity_score_entries'
];

async function enableRLS() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    for (const table of tables) {
      try {
        await client.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
        console.log(`Enabled RLS on public.${table}`);
      } catch (err) {
        console.error(`Error enabling RLS on public.${table}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.end();
  }
}

enableRLS();
