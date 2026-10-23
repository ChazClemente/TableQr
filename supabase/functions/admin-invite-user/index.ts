import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedRoles = new Set(['admin', 'cashier', 'kitchen']);
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function jsonResponse(status: number, body: Record<string, unknown>, origin?: string) {
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'application/json');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? undefined;
  const configuredOrigin = Deno.env.get('APP_ALLOWED_ORIGIN');
  const allowedOrigins = new Set([
    'http://localhost:4200',
     'https://table-qr-gray.vercel.app',
    'http://127.0.0.1:4200',
    ...(configuredOrigin ? [configuredOrigin] : []),
  ]);

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(403, { error: 'Origin is not allowed.' });
  }
  if (request.method === 'OPTIONS') {
    return jsonResponse(204, {}, origin);
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' }, origin);
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: 'Authentication is required.' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error('Required Supabase function environment variables are missing.');
    return jsonResponse(500, { error: 'User invitation is unavailable.' }, origin);
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: 'The access token is invalid or expired.' }, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('display_name, role, is_active')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (callerProfileError) {
    console.error('Failed to verify the caller profile:', callerProfileError.message);
    return jsonResponse(500, { error: 'Could not verify administrator access.' }, origin);
  }
  if (callerProfile?.role !== 'admin' || callerProfile.is_active !== true) {
    return jsonResponse(403, { error: 'An active administrator role is required.' }, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' }, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { error: 'Request body must be an object.' }, origin);
  }

  const input = body as Record<string, unknown>;
  const email = typeof input['email'] === 'string' ? input['email'].trim().toLowerCase() : '';
  const displayName = typeof input['displayName'] === 'string' ? input['displayName'].trim() : '';
  const username = typeof input['username'] === 'string' ? input['username'].trim().toLowerCase() : '';
  const role = typeof input['role'] === 'string' ? input['role'].trim().toLowerCase() : '';

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    displayName.length < 1 ||
    displayName.length > 100 ||
    username.length < 3 ||
    username.length > 32 ||
    !/^[a-z0-9._-]+$/.test(username) ||
    !allowedRoles.has(role)
  ) {
    return jsonResponse(400, {
      error: 'Provide a valid email, display name, username, and supported role.',
    }, origin);
  }

  const { data: existingUsername, error: usernameLookupError } = await adminClient
    .from('profiles')
    .select('user_id')
    .ilike('username', username)
    .maybeSingle();
  if (usernameLookupError) {
    console.error('Failed to check username availability:', usernameLookupError.message);
    return jsonResponse(500, { error: 'Could not verify username availability.' }, origin);
  }
  if (existingUsername) {
    return jsonResponse(409, { error: 'That username is already in use.' }, origin);
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { data: { display_name: displayName, username } },
  );
  if (inviteError || !inviteData.user) {
    console.error('Failed to invite staff user:', inviteError?.message ?? 'No user returned.');
    return jsonResponse(400, { error: 'Could not invite this user. Check the email and try again.' }, origin);
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ display_name: displayName, username, role, is_active: true })
    .eq('user_id', inviteData.user.id);

  if (profileError) {
    console.error('Failed to assign invited user profile:', profileError.message);
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(inviteData.user.id);
    if (rollbackError) {
      console.error('Failed to roll back incomplete invited user:', rollbackError.message);
    }
    return jsonResponse(500, { error: 'Could not finish setting up this user.' }, origin);
  }

  const { error: auditError } = await adminClient.from('audit_log').insert({
    event_type: 'staff_invited',
    actor_user_id: authData.user.id,
    actor_name: callerProfile.display_name,
    subject_user_id: inviteData.user.id,
    subject_name: displayName,
    summary: `Invited ${displayName} as ${role}`,
    details: { role, username },
    severity: 'info',
  });

  if (auditError) {
    console.error('Failed to record staff invitation audit event:', auditError.message);
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(inviteData.user.id);
    if (rollbackError) {
      console.error('Failed to roll back invitation after audit failure:', rollbackError.message);
      return jsonResponse(500, {
        error: 'Invitation audit logging failed, and the incomplete user could not be rolled back. Contact an administrator.',
      }, origin);
    }
    return jsonResponse(500, {
      error: 'Invitation was not completed because its audit event could not be recorded. The pending account was removed.',
    }, origin);
  }

  return jsonResponse(201, {
    user: {
      id: inviteData.user.id,
      email: inviteData.user.email,
      displayName,
      username,
      role,
      isActive: true,
    },
  }, origin);
});