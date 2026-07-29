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

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Sessão inválida.");

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profileError || callerProfile?.role !== "admin") throw new Error("Apenas administradores podem criar usuários.");

    const { name, email, password, role } = await request.json();
    if (!name || !email || !password) throw new Error("Nome, e-mail e senha são obrigatórios.");
    if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
    if (!["admin", "corretor"].includes(role)) throw new Error("Perfil inválido.");

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name: String(name).trim(), role },
    });
    if (createError) throw createError;

    await adminClient.from("profiles").upsert({
      id: created.user.id,
      name: String(name).trim(),
      email: created.user.email,
      role,
      enabled: true,
    });

    return new Response(JSON.stringify({
      user: { id: created.user.id, name, email: created.user.email, role, enabled: true },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Erro interno." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});