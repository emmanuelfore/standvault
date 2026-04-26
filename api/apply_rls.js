const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const sql = `
-- 1. Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Policy for users: Allow users to see their own record.
-- Supports both backend (app.current_user_id) and mobile (auth.jwt() -> email)
-- We use ILIKE or LOWER to handle case-insensitivity on the policy level.
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
ON users
FOR SELECT
USING (
  LOWER(email::text) = LOWER((auth.jwt() ->> 'email')::text)
  OR 
  id::text = current_setting('app.current_user_id', true)
);

-- 3. Policy for buyers: Allow purchasers to see their own records.
DROP POLICY IF EXISTS "Buyer can view their own profile" ON buyers;
CREATE POLICY "Buyer can view their own profile"
ON buyers
FOR SELECT
USING (
  user_id::text = current_setting('app.current_user_id', true)
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = buyers.user_id
    AND LOWER(users.email) = LOWER((auth.jwt() ->> 'email')::text)
  )
);
`;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function apply() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('RLS Policies applied successfully.');
  } catch (err) {
    console.error('Failed to apply SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

apply();
