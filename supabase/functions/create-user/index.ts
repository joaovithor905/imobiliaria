import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sessão ausente." }, 401);

    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

    const { data: caller } = await callerClient.from("profiles").select("role,enabled").eq("id", authData.user.id).single();
    if (!caller || caller.role !== "admin" || caller.enabled === false) return json({ error: "Somente administradores ativos podem criar usuários." }, 403);

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "corretor";
    if (!name || !email || password.length < 6) return json({ error: "Informe nome, e-mail e uma senha com pelo menos 6 caracteres." }, 400);

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });
    if (error) return json({ error: error.message }, 400);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      name,
      email,
      role,
      enabled: true
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: `Usuário criado no Auth, mas o perfil falhou: ${profileError.message}` }, 500);
    }

    return json({ ok: true, user: { id: data.user.id, name, email, role, enabled: true } });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
