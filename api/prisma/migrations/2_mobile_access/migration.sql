-- Enable RLS on the users table (it was previously not enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own profile by matching their email with the Supabase Auth JWT
CREATE POLICY "Users can view their own profile"
ON users
FOR SELECT
USING (
  email::text = (auth.jwt() ->> 'email')::text
  OR 
  id::text = current_setting('app.current_user_id', true)
);

-- Update buyers policy to also support email match from Supabase Auth
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
    AND users.email = (auth.jwt() ->> 'email')::text
  )
);
