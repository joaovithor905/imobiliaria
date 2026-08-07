"use strict";

const CONFIG = window.APP_CONFIG || {};
const APP = CONFIG.app || {};
const BRAND = CONFIG.brand || {};
const CONTACT = CONFIG.contact || {};
const SEO = CONFIG.seo || {};
const SB = CONFIG.supabase || {};
const PROPERTY_CONFIG = CONFIG.properties || {};
const MAP_CONFIG = CONFIG.map || {};
const DEMO = CONFIG.demo || {};

const WA_SVG = `<svg class="social-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.07 0C5.54 0 .23 5.31.23 11.84c0 2.09.55 4.13 1.6 5.92L.13 24l6.39-1.68a11.8 11.8 0 0 0 5.54 1.41h.01c6.52 0 11.83-5.31 11.83-11.84 0-3.16-1.2-6.14-3.38-8.41Zm-8.45 18.25h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.82 9.82 0 1 1 8.38 4.66Zm5.39-7.36c-.29-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-1.72-.86-2.85-1.54-4-3.5-.3-.52.3-.48.86-1.6.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.74-.71 1.99-1.4.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35Z"/></svg>`;
const IG_SVG = `<svg class="social-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.75 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`;

const NS = APP.storageNamespace || "primeLarPro";
const K = {
  properties: `${NS}:properties`,
  analytics: `${NS}:analytics`,
  users: `${NS}:users`,
  session: `${NS}:session`,
  theme: `${NS}:theme`
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85";
const DEF_PROPERTIES = [
  {
    id: crypto.randomUUID(), code: `${PROPERTY_CONFIG.codePrefix || "IMV"}-00001`, title: "Casa contemporânea com área gourmet",
    purpose: "Venda", availabilityStatus: "Disponível", type: "Casa", price: 780000, condoFee: 0,
    city: "Rio Verde", neighborhood: "Jardim América", address: "",
    description: "Casa moderna com ambientes integrados, suíte ampla, cozinha planejada e área gourmet completa.",
    area: 220, bedrooms: 3, suites: 1, bathrooms: 3, parking: 2, floor: 0,
    pool: true, financing: true, condominium: false, featured: true, active: true,
    images: ["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85"],
    video: "", tour: "", latitude: -17.7923, longitude: -50.9192, createdAt: new Date().toISOString()
  }
];

function isSupabaseConfigured() {
  const url = String(SB.url || "");
  const key = String(SB.publishableKey || "");
  return Boolean(url && key && !url.includes("COLE_AQUI") && !key.includes("COLE_AQUI"));
}

const db = isSupabaseConfigured() && window.supabase
  ? window.supabase.createClient(SB.url, SB.publishableKey)
  : null;

function localGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return JSON.parse(value);
    const clone = structuredClone(fallback);
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  } catch {
    return structuredClone(fallback);
  }
}

function localSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat(APP.locale || "pt-BR", {
    style: "currency",
    currency: APP.currency || "BRL"
  }).format(Number(value || 0));
}

function wa(number, message) {
  return `https://wa.me/${String(number || "").replace(/\D/g, "")}?text=${encodeURIComponent(message || "")}`;
}

function googleRoute(latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return "";
  return `${MAP_CONFIG.googleRouteBaseUrl || "https://www.google.com/maps/dir/?api=1&destination="}${Number(latitude)},${Number(longitude)}`;
}

function youtube(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    let id = "";
    if (parsed.hostname.includes("youtu.be")) id = parsed.pathname.replace(/^\//, "");
    if (parsed.hostname.includes("youtube.com")) id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
  } catch {
    return url;
  }
}

function toast(message, isError = false) {
  const element = document.getElementById("toast");
  if (!element) return;
  element.textContent = message;
  element.className = `toast${isError ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = "toast hidden"; }, 3300);
}

function initializeTheme() {
  const saved = localStorage.getItem(K.theme);
  const initial = saved || APP.defaultTheme || "light";
  applyTheme(initial);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  localStorage.setItem(K.theme, document.documentElement.dataset.theme);
}

function toggleTheme() {
  if (APP.allowThemeToggle === false) return;
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function applyConfigToPage() {
  const name = APP.name || "Imobiliária";
  const label = APP.businessLabel || "Imobiliária";
  document.documentElement.style.setProperty("--primary", BRAND.primary || "#0f3d32");
  document.documentElement.style.setProperty("--accent", BRAND.accent || "#c89b5b");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BRAND.themeColor || BRAND.primary || "#0f3d32");
  if (SEO.title) document.title = SEO.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", SEO.description || "");

  document.querySelectorAll("[data-brand-name]").forEach(el => { el.textContent = name; });
  document.querySelectorAll("[data-brand-logo]").forEach(el => {
    el.src = APP.logo || "assets/logo-prime-lar.png";
    el.alt = `Logotipo ${name}`;
  });
  document.querySelectorAll("[data-description]").forEach(el => { el.textContent = SEO.description || ""; });
  document.querySelectorAll("[data-phone]").forEach(el => { el.textContent = CONTACT.phone || ""; });
  document.querySelectorAll("[data-address]").forEach(el => { el.textContent = CONTACT.address || ""; });
  document.querySelectorAll("[data-instagram]").forEach(el => { el.href = CONTACT.instagram || "#"; });
  document.querySelectorAll("[data-instagram-label]").forEach(el => { el.textContent = CONTACT.instagramLabel || "Instagram"; });
  document.querySelectorAll("[data-whatsapp-icon]").forEach(el => { el.innerHTML = WA_SVG; });
  document.querySelectorAll("[data-instagram-icon]").forEach(el => { el.innerHTML = IG_SVG; });
  document.querySelectorAll(".js-whatsapp").forEach(el => {
    el.href = wa(CONTACT.whatsapp, CONTACT.whatsappMessage || "Olá, vim pelo site.");
  });

  document.querySelectorAll(".js-theme-toggle").forEach(el => {
    if (APP.allowThemeToggle === false) el.classList.add("hidden");
  });

  if (document.body.classList.contains("admin-body")) document.title = `Painel | ${name}`;
  document.querySelectorAll("[data-business-label]").forEach(el => { el.textContent = label; });
}

function fillConfiguredSelect(select, values, placeholder = null) {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = placeholder !== null ? `<option value="">${esc(placeholder)}</option>` : "";
  (values || []).forEach(value => select.insertAdjacentHTML("beforeend", `<option value="${esc(value)}">${esc(value)}</option>`));
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
}

async function getProperties() {
  if (db) {
    const { data, error } = await db.from("properties").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapPropertyFromDb);
  }
  return localGet(K.properties, DEF_PROPERTIES);
}

async function saveProperty(property) {
  if (db) {
    if (property.id) {
      const { data, error } = await db.from("properties").update(mapPropertyToDb(property, false)).eq("id", property.id).select().single();
      if (error) throw new Error(error.message);
      return mapPropertyFromDb(data);
    }
    const { data: generatedCode, error: codeError } = await db.rpc("next_property_code", { p_prefix: PROPERTY_CONFIG.codePrefix || "IMV" });
    if (codeError) throw new Error(codeError.message);
    const payload = mapPropertyToDb({ ...property, code: generatedCode }, true);
    payload.code = generatedCode;
    const { data, error } = await db.from("properties").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapPropertyFromDb(data);
  }

  const list = localGet(K.properties, DEF_PROPERTIES);
  const saved = { ...property };
  if (!saved.id) {
    saved.id = crypto.randomUUID();
    saved.code = nextLocalPropertyCode(list);
    saved.createdAt = saved.createdAt || new Date().toISOString();
  }
  const index = list.findIndex(item => item.id === saved.id);
  if (index >= 0) list[index] = saved; else list.unshift(saved);
  localSet(K.properties, list);
  return saved;
}

async function removeProperty(id) {
  if (db) {
    const { error } = await db.from("properties").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  localSet(K.properties, localGet(K.properties, DEF_PROPERTIES).filter(item => item.id !== id));
}

function nextLocalPropertyCode(list) {
  const highest = list.reduce((max, item) => Math.max(max, Number(String(item.code || "").match(/(\d+)$/)?.[1] || 0)), 0);
  return `${PROPERTY_CONFIG.codePrefix || "IMV"}-${String(highest + 1).padStart(5, "0")}`;
}

function mapPropertyFromDb(p) {
  return {
    id: p.id, code: p.code, title: p.title, purpose: p.purpose,
    availabilityStatus: p.availability_status || "Disponível", type: p.type, price: Number(p.price || 0),
    condoFee: Number(p.condo_fee || 0), city: p.city, neighborhood: p.neighborhood, address: p.address || "",
    description: p.description || "", area: Number(p.area || 0), bedrooms: Number(p.bedrooms || 0), suites: Number(p.suites || 0),
    bathrooms: Number(p.bathrooms || 0), parking: Number(p.parking || 0), floor: Number(p.floor || 0),
    pool: Boolean(p.pool), financing: Boolean(p.financing), condominium: Boolean(p.condominium), featured: Boolean(p.featured), active: Boolean(p.active),
    images: Array.isArray(p.images) ? p.images : [], video: p.video || "", tour: p.tour || "",
    latitude: p.latitude === null || p.latitude === undefined ? null : Number(p.latitude),
    longitude: p.longitude === null || p.longitude === undefined ? null : Number(p.longitude),
    createdAt: p.created_at, updatedAt: p.updated_at
  };
}

function mapPropertyToDb(p, isInsert) {
  const payload = {
    title: p.title, purpose: p.purpose, availability_status: p.availabilityStatus || "Disponível", type: p.type,
    price: Number(p.price || 0), condo_fee: Number(p.condoFee || 0), city: p.city, neighborhood: p.neighborhood,
    address: p.address || "", description: p.description || "", area: Number(p.area || 0), bedrooms: Number(p.bedrooms || 0),
    suites: Number(p.suites || 0), bathrooms: Number(p.bathrooms || 0), parking: Number(p.parking || 0), floor: Number(p.floor || 0),
    pool: Boolean(p.pool), financing: Boolean(p.financing), condominium: Boolean(p.condominium), featured: Boolean(p.featured), active: Boolean(p.active),
    images: p.images || [], video: p.video || "", tour: p.tour || "",
    latitude: Number.isFinite(Number(p.latitude)) ? Number(p.latitude) : null,
    longitude: Number.isFinite(Number(p.longitude)) ? Number(p.longitude) : null
  };
  if (!isInsert && p.code) payload.code = p.code;
  return payload;
}

async function uploadPropertyImages(files) {
  if (!files.length) return [];
  const maxCount = Number(APP.maxImagesPerProperty || 15);
  const maxMB = Number(APP.maxImageSizeMB || 8);
  if (files.length > maxCount) throw new Error(`Selecione no máximo ${maxCount} imagens por vez.`);
  for (const file of files) {
    if (!file.type.startsWith("image/")) throw new Error("Envie apenas arquivos de imagem.");
    if (file.size > maxMB * 1024 * 1024) throw new Error(`A imagem ${file.name} ultrapassa ${maxMB} MB.`);
  }

  if (!db) {
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
  }

  const urls = [];
  const bucket = SB.propertyImagesBucket || "property-images";
  for (const file of files) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await db.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(`Falha ao enviar ${file.name}: ${error.message}`);
    const { data } = db.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function getProfiles() {
  if (db) {
    const { data, error } = await db.from("profiles").select("id,name,email,role,enabled,created_at").order("name");
    if (error) throw new Error(error.message);
    return (data || []).map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, enabled: p.enabled !== false, createdAt: p.created_at }));
  }
  return localGet(K.users, DEMO.accounts || []).map(user => ({ ...user, enabled: user.enabled !== false }));
}

async function createUser(payload) {
  if (db) {
    try {
      const { data, error } = await db.functions.invoke(SB.createUserFunction || "create-user", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (error) {
      if (/Failed to send|404|not found/i.test(error?.message || "")) throw new Error(`A Edge Function "${SB.createUserFunction || "create-user"}" não está publicada no Supabase.`);
      throw error;
    }
  }
  const users = localGet(K.users, DEMO.accounts || []);
  if (users.some(u => u.email.toLowerCase() === payload.email.toLowerCase())) throw new Error("Já existe um usuário com este e-mail.");
  users.push({ id: crypto.randomUUID(), ...payload, enabled: true, createdAt: new Date().toISOString() });
  localSet(K.users, users);
  return { ok: true };
}

async function manageUser(body) {
  if (db) {
    try {
      const { data, error } = await db.functions.invoke(SB.manageUserFunction || "manage-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (error) {
      if (/Failed to send|404|not found/i.test(error?.message || "")) throw new Error(`A Edge Function "${SB.manageUserFunction || "manage-user"}" não está publicada no Supabase.`);
      throw error;
    }
  }

  const users = localGet(K.users, DEMO.accounts || []);
  const index = users.findIndex(u => u.id === body.userId);
  if (index < 0) throw new Error("Usuário não encontrado.");
  if (body.action === "delete") users.splice(index, 1);
  if (body.action === "toggle") users[index].enabled = Boolean(body.enabled);
  if (body.action === "update") {
    users[index] = { ...users[index], name: body.name, email: body.email, role: body.role, ...(body.password ? { password: body.password } : {}) };
  }
  localSet(K.users, users);
  return { ok: true };
}

async function getAnalytics() {
  if (db) {
    const { data, error } = await db.from("property_metrics").select("property_id,views,clicks");
    if (!error && data) return Object.fromEntries(data.map(item => [item.property_id, { views: Number(item.views || 0), clicks: Number(item.clicks || 0) }]));
  }
  return localGet(K.analytics, {});
}

async function metric(propertyId, type) {
  if (!propertyId || !["views", "clicks"].includes(type)) return;
  if (db) {
    const { error } = await db.rpc("increment_property_metric", { p_property_id: propertyId, p_metric: type });
    if (error) console.warn("Não foi possível registrar métrica:", error.message);
    return;
  }
  const analytics = localGet(K.analytics, {});
  analytics[propertyId] ||= { views: 0, clicks: 0 };
  analytics[propertyId][type] = Number(analytics[propertyId][type] || 0) + 1;
  localSet(K.analytics, analytics);
}

initializeTheme();
applyConfigToPage();
