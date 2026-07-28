const K = {
  properties: "primeLarV2Properties",
  settings: "primeLarV2Settings",
  analytics: "primeLarV2Analytics",
  users: "primeLarV2Users",
  session: "primeLarV2Session"
};

const DEF_SETTINGS = {
  name: "Prime Lar",
  initials: "PL",
  whatsapp: "5564999999999",
  phone: "(64) 99999-9999",
  instagram: "https://instagram.com/",
  address: "Rio Verde - GO",
  description: "Imóveis para venda e aluguel com atendimento simples e próximo.",
  primary: "#0f3d32",
  accent: "#c89b5b",
  logo: ""
};

const DEF_PROPERTIES = [
  {
    id: crypto.randomUUID(), code: "IMV-00001", title: "Casa contemporânea com área gourmet",
    purpose: "Venda", availabilityStatus: "Disponível", type: "Casa", price: 780000, condoFee: 0,
    city: "Rio Verde", neighborhood: "Jardim América", address: "Rua das Palmeiras",
    description: "Casa moderna com ambientes integrados, suíte ampla, cozinha planejada e área gourmet completa.",
    area: 220, bedrooms: 3, suites: 1, bathrooms: 3, parking: 2, floor: 0,
    pool: true, financing: true, condominium: false, featured: true, active: true,
    images: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1400&q=85"
    ],
    video: "", tour: "", map: "https://www.google.com/maps?q=Rio+Verde+GO&output=embed",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: crypto.randomUUID(), code: "IMV-00002", title: "Apartamento completo próximo ao centro",
    purpose: "Aluguel", availabilityStatus: "Disponível", type: "Apartamento", price: 2350, condoFee: 420,
    city: "Rio Verde", neighborhood: "Setor Central", address: "Avenida Presidente Vargas",
    description: "Apartamento bem localizado, com varanda, armários planejados e condomínio com área de lazer.",
    area: 95, bedrooms: 2, suites: 1, bathrooms: 2, parking: 1, floor: 6,
    pool: true, financing: false, condominium: true, featured: true, active: true,
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=85"
    ],
    video: "", tour: "", map: "https://www.google.com/maps?q=Centro+Rio+Verde+GO&output=embed",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

const DEF_USERS = [
  { id: "demo-admin", name: "Administrador Demo", email: "admin@demo.com", password: "admin123", role: "admin", createdAt: new Date().toISOString() },
  { id: "demo-corretor", name: "Corretor Demo", email: "corretor@demo.com", password: "corretor123", role: "corretor", createdAt: new Date().toISOString() }
];

function hasSupabaseConfig() {
  const c = window.SUPABASE_CONFIG || {};
  return Boolean(c.url && c.anonKey && !c.url.includes("COLE_AQUI") && !c.anonKey.includes("COLE_AQUI"));
}

const db = hasSupabaseConfig() && window.supabase
  ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
  : null;

function localGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(key, JSON.stringify(fallback));
    return structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function localSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function wa(number, message) {
  return `https://wa.me/${String(number || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function toast(message) {
  const element = document.getElementById("toast");
  if (!element) return;
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 3200);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("primeLarTheme", theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function applyBrand(settings) {
  document.documentElement.style.setProperty("--primary", settings.primary || DEF_SETTINGS.primary);
  document.documentElement.style.setProperty("--accent", settings.accent || DEF_SETTINGS.accent);
  document.querySelectorAll("[data-brand-name]").forEach(el => el.textContent = settings.name);
  document.querySelectorAll("[data-brand-initials]").forEach(el => el.textContent = settings.initials);
  document.querySelectorAll("[data-description]").forEach(el => el.textContent = settings.description);
  document.querySelectorAll("[data-phone]").forEach(el => el.textContent = settings.phone);
  document.querySelectorAll("[data-address]").forEach(el => el.textContent = settings.address);
  document.querySelectorAll("[data-instagram]").forEach(el => el.href = settings.instagram || "#");
}

async function getSettings() {
  if (db) {
    const { data, error } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (!error && data) return mapSettingsFromDb(data);
  }
  return localGet(K.settings, DEF_SETTINGS);
}

async function saveSettings(settings) {
  if (db) {
    const { error } = await db.from("site_settings").upsert(mapSettingsToDb(settings));
    if (!error) return settings;
    throw new Error(error.message);
  }
  localSet(K.settings, settings);
  return settings;
}

function mapSettingsFromDb(s) {
  return { name: s.name, initials: s.initials, whatsapp: s.whatsapp, phone: s.phone, instagram: s.instagram,
    address: s.address, description: s.description, primary: s.primary_color, accent: s.accent_color, logo: s.logo_url || "" };
}

function mapSettingsToDb(s) {
  return { id: 1, name: s.name, initials: s.initials, whatsapp: s.whatsapp, phone: s.phone,
    instagram: s.instagram, address: s.address, description: s.description, primary_color: s.primary,
    accent_color: s.accent, logo_url: s.logo || "", updated_at: new Date().toISOString() };
}

async function getProperties() {
  if (db) {
    const { data, error } = await db.from("properties").select("*").order("created_at", { ascending: false });
    if (!error && data) return data.map(mapPropertyFromDb);
    console.error("Erro ao carregar imóveis:", error);
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
    const { data, error } = await db.from("properties").insert(mapPropertyToDb(property, true)).select().single();
    if (error) throw new Error(error.message);
    return mapPropertyFromDb(data);
  }

  const list = localGet(K.properties, DEF_PROPERTIES);
  const saved = { ...property };
  if (!saved.id) {
    saved.id = crypto.randomUUID();
    saved.code = nextLocalPropertyCode(list);
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
  const highest = list.reduce((max, item) => {
    const number = Number(String(item.code || "").match(/(\d+)$/)?.[1] || 0);
    return Math.max(max, number);
  }, 0);
  return `IMV-${String(highest + 1).padStart(5, "0")}`;
}

function mapPropertyFromDb(p) {
  return {
    id: p.id, code: p.code, title: p.title, purpose: p.purpose,
    availabilityStatus: p.availability_status || "Disponível", type: p.type, price: Number(p.price),
    condoFee: Number(p.condo_fee || 0), city: p.city, neighborhood: p.neighborhood, address: p.address || "",
    description: p.description, area: Number(p.area || 0), bedrooms: Number(p.bedrooms || 0),
    suites: Number(p.suites || 0), bathrooms: Number(p.bathrooms || 0), parking: Number(p.parking || 0),
    floor: Number(p.floor || 0), pool: Boolean(p.pool), financing: Boolean(p.financing),
    condominium: Boolean(p.condominium), featured: Boolean(p.featured), active: Boolean(p.active),
    images: Array.isArray(p.images) ? p.images : [], video: p.video || "", tour: p.tour || "", map: p.map || "",
    createdAt: p.created_at
  };
}

function mapPropertyToDb(p, isInsert) {
  const payload = {
    title: p.title, purpose: p.purpose, availability_status: p.availabilityStatus || "Disponível",
    type: p.type, price: p.price, condo_fee: p.condoFee || 0, city: p.city,
    neighborhood: p.neighborhood, address: p.address || "", description: p.description,
    area: p.area || 0, bedrooms: p.bedrooms || 0, suites: p.suites || 0,
    bathrooms: p.bathrooms || 0, parking: p.parking || 0, floor: p.floor || 0,
    pool: Boolean(p.pool), financing: Boolean(p.financing), condominium: Boolean(p.condominium),
    featured: Boolean(p.featured), active: Boolean(p.active), images: p.images || [],
    video: p.video || "", tour: p.tour || "", map: p.map || ""
  };
  if (!isInsert && p.code) payload.code = p.code;
  return payload;
}

async function uploadPropertyImages(files) {
  if (!files.length) return [];
  if (!db) {
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
  }

  const urls = [];
  for (const file of files) {
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await db.storage.from(window.SUPABASE_CONFIG.storageBucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(`Falha ao enviar ${file.name}: ${error.message}`);
    const { data } = db.storage.from(window.SUPABASE_CONFIG.storageBucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function getProfiles() {
  if (db) {
    const { data, error } = await db.from("profiles").select("id,name,email,role,created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, createdAt: p.created_at }));
  }
  return localGet(K.users, DEF_USERS);
}

async function createUserAccount({ name, email, password, role }) {
  if (db) {
    const { data, error } = await db.functions.invoke(window.SUPABASE_CONFIG.createUserFunction || "create-user", {
      body: { name, email, password, role }
    });
    if (error) throw new Error(error.message || "Não foi possível criar o usuário.");
    if (data?.error) throw new Error(data.error);
    return data.user;
  }

  const users = localGet(K.users, DEF_USERS);
  if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) throw new Error("Já existe um usuário com este e-mail.");
  const user = { id: crypto.randomUUID(), name, email, password, role, createdAt: new Date().toISOString() };
  users.unshift(user);
  localSet(K.users, users);
  return user;
}

async function getAnalytics() {
  if (db) {
    const { data, error } = await db.from("property_metrics").select("property_id,views,clicks");
    if (!error && data) return Object.fromEntries(data.map(item => [item.property_id, { views: Number(item.views || 0), clicks: Number(item.clicks || 0) }]));
  }
  return localGet(K.analytics, {});
}

async function metric(propertyId, type) {
  if (db) {
    await db.rpc("increment_property_metric", { p_property_id: propertyId, p_metric: type });
    return;
  }
  const analytics = localGet(K.analytics, {});
  analytics[propertyId] ||= { views: 0, clicks: 0 };
  analytics[propertyId][type] = Number(analytics[propertyId][type] || 0) + 1;
  localSet(K.analytics, analytics);
}

function youtube(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const id = parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}

applyTheme(localStorage.getItem("primeLarTheme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));