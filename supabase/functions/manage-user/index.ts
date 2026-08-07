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
    const callerId = authData.user.id;

    const { data: caller } = await callerClient.from("profiles").select("role,enabled").eq("id", callerId).single();
    if (!caller || caller.role !== "admin" || caller.enabled === false) return json({ error: "Somente administradores ativos podem gerenciar usuários." }, 403);

    const body = await req.json();
    const action = String(body.action || "");
    const userId = String(body.userId || "");
    if (!userId) return json({ error: "Usuário não informado." }, 400);
    if (["delete", "toggle"].includes(action) && userId === callerId) return json({ error: "Você não pode excluir ou desabilitar a própria conta." }, 400);

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    if (action === "update") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const role = body.role === "admin" ? "admin" : "corretor";
      const password = String(body.password || "");
      if (!name || !email) return json({ error: "Nome e e-mail são obrigatórios." }, 400);
      if (password && password.length < 6) return json({ error: "A nova senha precisa ter pelo menos 6 caracteres." }, 400);

      const attributes: any = { email, user_metadata: { name, role } };
      if (password) attributes.password = password;
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, attributes);
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      const { error: profileError } = await admin.from("profiles").update({ name, email, role }).eq("id", userId);
      if (profileError) return json({ error: profileError.message }, 400);
      return json({ ok: true });
    }

    if (action === "toggle") {
      const enabled = Boolean(body.enabled);
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: enabled ? "none" : "876000h"
      });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);
      const { error: profileError } = await admin.from("profiles").update({ enabled }).eq("id", userId);
      if (profileError) return json({ error: profileError.message }, 400);
      return json({ ok: true, enabled });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
