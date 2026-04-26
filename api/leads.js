// GET    /api/leads          - lista todos los leads (autenticado)
// PATCH  /api/leads?id=:id   - actualiza notes de un lead (autenticado)
//
// Auth: Bearer token de Supabase en header Authorization.
// Verifica que el email del usuario coincida con NOTIFICATION_EMAIL (allowlist de uno).
// Si querés sumar más admins, expandir ALLOWED_EMAILS.

import { createClient } from '@supabase/supabase-js';

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'missing_token', status: 401 };

  const token = match[1];
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { error: 'server_misconfigured', status: 500 };

  // Verificar el token con Supabase (devuelve user si es válido)
  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { error: 'invalid_token', status: 401 };

  // Allowlist por email
  const allowedEmail = (process.env.NOTIFICATION_EMAIL || '').toLowerCase();
  const userEmail = (data.user.email || '').toLowerCase();
  if (!allowedEmail || userEmail !== allowedEmail) {
    return { error: 'forbidden', status: 403 };
  }

  return { user: data.user };
}

function getAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export default async function handler(req, res) {
  // Auth check para todos los métodos
  const authResult = await authenticate(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const admin = getAdminClient();

  if (req.method === 'GET') {
    // Listar leads (max 1000 — si crece, paginar)
    const { data, error } = await admin
      .from('ag_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[leads:list] error:', error);
      return res.status(500).json({ error: 'query_failed', detail: error.message });
    }

    return res.status(200).json({ leads: data });
  }

  if (req.method === 'PATCH') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_json' }); }
    }
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid_body' });

    // Solo permitimos editar `notes` por ahora — los datos del lead no se tocan después de captura
    const updates = {};
    if (typeof body.notes === 'string') {
      updates.notes = body.notes.slice(0, 5000); // límite razonable
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no_updates' });
    }

    const { data, error } = await admin
      .from('ag_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[leads:patch] error:', error);
      return res.status(500).json({ error: 'update_failed', detail: error.message });
    }

    return res.status(200).json({ lead: data });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
