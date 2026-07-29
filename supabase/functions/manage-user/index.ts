import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sessão não informada.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Sessão inválida.");

    const { data: callerProfile, error: profileError } = await adminClient.from("profiles").select("role").eq("id", authData.user.id).single();
    if (profileError || callerProfile?.role !== "admin") throw new Error("Apenas administradores podem gerenciar usuários.");

    const body = await request.json();
    const { action, id } = body;
    if (!id) throw new Error("Usuário não informado.");
    if (["disable", "delete"].includes(action) && id === authData.user.id) throw new Error("Você não pode desabilitar ou excluir a própria conta.");

    if (action === "update") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const role = body.role;
      const password = String(body.password || "");
      if (!name || !email) throw new Error("Nome e e-mail são obrigatórios.");
      if (!["admin", "corretor"].includes(role)) throw new Error("Perfil inválido.");
      if (id === authData.user.id && role !== "admin") throw new Error("Você não pode remover o próprio perfil de administrador.");
      if (password && password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

      const attributes: Record<string, unknown> = {
        email,
        user_metadata: { name, role },
      };
      if (password) attributes.password = password;
      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(id, attributes);
      if (updateError) throw updateError;

      const { error: dbError } = await adminClient.from("profiles").update({ name, email, role }).eq("id", id);
      if (dbError) throw dbError;
      return json({ user: { id, name, email: updated.user.email || email, role } });
    }

    if (action === "disable" || action === "enable") {
      const enabled = action === "enable";
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, {
        ban_duration: enabled ? "none" : "876000h",
      });
      if (authUpdateError) throw authUpdateError;
      const { data: profile, error: dbError } = await adminClient.from("profiles").update({ enabled }).eq("id", id).select("id,name,email,role,enabled").single();
      if (dbError) throw dbError;
      return json({ user: profile });
    }

    if (action === "delete") {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);
      if (deleteError) throw deleteError;
      return json({ success: true });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    return json({ error: error.message || "Erro interno." }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
