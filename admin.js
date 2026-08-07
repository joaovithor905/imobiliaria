"use strict";

let props = [];
let uploads = [];
let editing = null;
let currentUser = null;
let profiles = [];

async function startAdmin() {
  bindAdmin();
  setupAdminConfig();
  showDemoHint();

  try {
    if (db) {
      const { data } = await db.auth.getSession();
      if (data.session?.user) {
        currentUser = await buildRemoteUser(data.session.user);
        await enter();
        return;
      }
    } else {
      const session = localGet(K.session, null);
      if (session) {
        const account = localGet(K.users, DEMO.accounts || []).find(item => item.id === session.id);
        if (account?.enabled !== false) {
          currentUser = session;
          await enter();
        } else {
          localStorage.removeItem(K.session);
        }
      }
    }
  } catch (error) {
    console.error(error);
    localStorage.removeItem(K.session);
    document.getElementById("loginError").textContent = error.message;
    document.getElementById("loginError").classList.remove("hidden");
  }
}

function setupAdminConfig() {
  fillConfiguredSelect(document.getElementById("pType"), PROPERTY_CONFIG.types || []);
  fillConfiguredSelect(document.getElementById("pAvailability"), PROPERTY_CONFIG.availabilityOptions || []);
  fillConfiguredSelect(document.getElementById("statusFilter"), PROPERTY_CONFIG.availabilityOptions || [], "Todas as disponibilidades");
}

function showDemoHint() {
  if (db || DEMO.enabledWhenSupabaseIsNotConfigured === false) return;
  const hint = document.getElementById("demoHint");
  const accounts = DEMO.accounts || [];
  if (!accounts.length) return;
  hint.innerHTML = `<b>Modo demonstração local</b>${accounts.map(a => `<span>${esc(a.role === "admin" ? "Administrador" : "Corretor")}: ${esc(a.email)} / ${esc(a.password)}</span>`).join("")}`;
  hint.classList.remove("hidden");
}

function bindAdmin() {
  document.getElementById("loginForm").onsubmit = login;
  document.getElementById("logout").onclick = logout;
  document.getElementById("adminTheme").onclick = toggleTheme;
  document.getElementById("sideBtn").onclick = toggleSidebar;
  document.getElementById("sidebarBackdrop").onclick = closeSidebar;
  document.querySelectorAll("[data-view]").forEach(button => button.onclick = () => show(button.dataset.view));
  document.querySelectorAll("[data-new]").forEach(button => button.onclick = () => { resetForm(); show("form"); });
  document.getElementById("propertyForm").onsubmit = saveForm;
  document.getElementById("cancelEdit").onclick = () => { resetForm(); show("properties"); };
  document.getElementById("adminSearch").oninput = renderList;
  document.getElementById("statusFilter").onchange = renderList;
  document.getElementById("userForm").onsubmit = addUser;
  document.getElementById("userList").onclick = handleUserAction;
  document.getElementById("editUserForm").onsubmit = saveUserEdit;
  document.getElementById("closeUserDialog").onclick = closeUserDialog;
  document.getElementById("cancelUserEdit").onclick = closeUserDialog;

  const dropZone = document.getElementById("dropZone");
  const input = document.getElementById("pImages");
  dropZone.onclick = () => input.click();
  input.onchange = () => addFiles([...input.files]);
  dropZone.ondragover = event => { event.preventDefault(); dropZone.classList.add("drag"); };
  dropZone.ondragleave = () => dropZone.classList.remove("drag");
  dropZone.ondrop = event => { event.preventDefault(); dropZone.classList.remove("drag"); addFiles([...event.dataTransfer.files]); };

  window.addEventListener("resize", () => { if (window.innerWidth > 720) closeSidebar(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeSidebar(); });
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const open = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  document.getElementById("sidebarBackdrop").classList.toggle("show", open);
  document.getElementById("sideBtn").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("admin-menu-open", open);
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("show");
  document.getElementById("sideBtn").setAttribute("aria-expanded", "false");
  document.body.classList.remove("admin-menu-open");
}

async function buildRemoteUser(authUser) {
  const { data: profile, error } = await db.from("profiles").select("id,name,email,role,enabled").eq("id", authUser.id).single();
  if (error) throw new Error("O usuário existe no Auth, mas o perfil não foi encontrado no banco.");
  if (profile.enabled === false) {
    await db.auth.signOut();
    throw new Error("Este usuário está temporariamente desabilitado.");
  }
  return { id: profile.id, email: profile.email || authUser.email, name: profile.name, role: profile.role, enabled: true };
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const errorElement = document.getElementById("loginError");
  errorElement.classList.add("hidden");

  try {
    if (db) {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = await buildRemoteUser(data.user);
      await enter();
      return;
    }
    if (DEMO.enabledWhenSupabaseIsNotConfigured === false) throw new Error("Supabase não configurado.");
    const account = localGet(K.users, DEMO.accounts || []).find(item => item.email.toLowerCase() === email);
    if (!account || account.password !== password) throw new Error("E-mail ou senha inválidos.");
    if (account.enabled === false) throw new Error("Este usuário está temporariamente desabilitado.");
    currentUser = { id: account.id, email: account.email, name: account.name, role: account.role, enabled: true };
    localSet(K.session, currentUser);
    await enter();
  } catch (error) {
    console.error(error);
    errorElement.textContent = error.message || "E-mail ou senha inválidos.";
    errorElement.classList.remove("hidden");
  }
}

async function logout() {
  localStorage.removeItem(K.session);
  if (db) await db.auth.signOut();
  location.reload();
}

async function enter() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminApp").classList.remove("hidden");
  document.getElementById("roleLabel").textContent = currentUser.role === "admin" ? `Administrador · ${currentUser.name}` : `Corretor · ${currentUser.name}`;
  if (currentUser.role !== "admin") document.querySelectorAll(".admin-only").forEach(element => element.classList.add("hidden"));
  props = await getProperties();
  if (currentUser.role === "admin") profiles = await getProfiles();
  await renderAll();
}

function show(view) {
  if (view === "users" && currentUser?.role !== "admin") return;
  const titles = { dashboard: "Visão geral", properties: "Imóveis", form: editing ? "Editar imóvel" : "Novo imóvel", users: "Usuários" };
  document.querySelectorAll(".admin-view").forEach(element => element.classList.add("hidden"));
  document.getElementById(`${view}View`)?.classList.remove("hidden");
  document.querySelectorAll("[data-view]").forEach(element => element.classList.toggle("active", element.dataset.view === view));
  document.getElementById("viewTitle").textContent = titles[view] || "Painel";
  closeSidebar();
}

async function renderAll() {
  await dashboard();
  renderList();
  if (currentUser.role === "admin") renderUsers();
}

async function dashboard() {
  const analytics = await getAnalytics();
  const available = props.filter(property => property.active && property.availabilityStatus === "Disponível").length;
  const unavailable = props.filter(property => ["Alugado", "Vendido"].includes(property.availabilityStatus)).length;
  const views = Object.values(analytics).reduce((sum, item) => sum + Number(item.views || 0), 0);
  const clicks = Object.values(analytics).reduce((sum, item) => sum + Number(item.clicks || 0), 0);
  document.getElementById("sActive").textContent = available;
  document.getElementById("sUnavailable").textContent = unavailable;
  document.getElementById("sViews").textContent = views;
  document.getElementById("sClicks").textContent = clicks;

  const rank = props.map(property => ({ ...property, views: analytics[property.id]?.views || 0, clicks: analytics[property.id]?.clicks || 0 })).sort((a, b) => b.views - a.views).slice(0, 5);
  document.getElementById("ranking").innerHTML = rank.map((property, index) => `<div class="rank-item"><b>${index + 1}</b><span><strong>${esc(property.title)}</strong><small>${property.views} visualizações · ${property.clicks} cliques</small></span></div>`).join("") || "<p>Sem dados ainda.</p>";
  const max = Math.max(available, unavailable, views, clicks, 1);
  document.getElementById("simpleChart").innerHTML = [["Disponíveis", available], ["Alugados/Vendidos", unavailable], ["Visualizações", views], ["Cliques", clicks]].map(item => `<div><span>${item[0]} <b>${item[1]}</b></span><i><em style="width:${item[1] / max * 100}%"></em></i></div>`).join("");
}

function renderList() {
  const text = document.getElementById("adminSearch").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const list = props.filter(property => (!text || `${property.title} ${property.code} ${property.neighborhood}`.toLowerCase().includes(text)) && (!status || property.availabilityStatus === status));
  const options = PROPERTY_CONFIG.availabilityOptions || ["Disponível", "Alugado", "Vendido", "Reservado"];

  document.getElementById("adminList").innerHTML = list.map(property => `<article class="admin-item">
    <img src="${esc(property.images?.[0] || FALLBACK_IMAGE)}" alt="${esc(property.title)}">
    <div><h3>${esc(property.title)}</h3><p>${esc(property.code)} · ${esc(property.purpose)} · ${esc(property.neighborhood)}</p><strong>${money(property.price)}</strong>
    <label class="quick-status">Disponibilidade<select data-property-status="${property.id}">${options.map(option => `<option ${property.availabilityStatus === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>
    <span class="pill ${property.active ? "on" : "off"}">${property.active ? "Visível" : "Oculto"}</span></div>
    <div class="item-actions"><button data-act="toggle" data-id="${property.id}" type="button">${property.active ? "Ocultar" : "Exibir"}</button><button data-act="featured" data-id="${property.id}" type="button">${property.featured ? "Remover destaque" : "Destacar"}</button><button data-act="edit" data-id="${property.id}" type="button">Editar</button><button data-act="delete" data-id="${property.id}" class="danger" type="button">Excluir</button></div>
  </article>`).join("") || "<div class='empty'><h3>Nenhum imóvel cadastrado</h3></div>";

  document.getElementById("adminList").onclick = handlePropertyAction;
  document.getElementById("adminList").onchange = handleAvailabilityChange;
}

async function handleAvailabilityChange(event) {
  const select = event.target.closest("[data-property-status]");
  if (!select) return;
  const property = props.find(item => item.id === select.dataset.propertyStatus);
  if (!property) return;
  const previous = property.availabilityStatus;
  property.availabilityStatus = select.value;
  try {
    Object.assign(property, await saveProperty(property));
    await renderAll();
    toast("Disponibilidade atualizada.");
  } catch (error) {
    property.availabilityStatus = previous;
    renderList();
    toast(`Erro: ${error.message}`, true);
  }
}

async function handlePropertyAction(event) {
  const button = event.target.closest("[data-act]");
  if (!button) return;
  const property = props.find(item => item.id === button.dataset.id);
  if (!property) return;
  try {
    if (button.dataset.act === "toggle") { property.active = !property.active; await saveProperty(property); }
    if (button.dataset.act === "featured") { property.featured = !property.featured; await saveProperty(property); }
    if (button.dataset.act === "edit") { fillForm(property); return; }
    if (button.dataset.act === "delete") { if (!confirm(`Excluir "${property.title}"?`)) return; await removeProperty(property.id); }
    props = await getProperties();
    await renderAll();
    toast("Alteração salva.");
  } catch (error) {
    console.error(error);
    toast(`Erro: ${error.message}`, true);
  }
}

async function addFiles(files) {
  const images = files.filter(file => file.type.startsWith("image/"));
  if (!images.length) return;
  if (uploads.length + images.length > Number(APP.maxImagesPerProperty || 15)) {
    toast(`O anúncio aceita até ${APP.maxImagesPerProperty || 15} imagens.`, true);
    return;
  }
  const dropZone = document.getElementById("dropZone");
  try {
    dropZone.classList.add("uploading");
    const urls = await uploadPropertyImages(images);
    uploads.push(...urls);
    previewImages();
    toast(`${urls.length} ${urls.length === 1 ? "imagem adicionada" : "imagens adicionadas"}.`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    dropZone.classList.remove("uploading");
    document.getElementById("pImages").value = "";
  }
}

function previewImages() {
  document.getElementById("preview").innerHTML = uploads.map((url, index) => `<div><img src="${esc(url)}" alt="Prévia"><button type="button" data-rm="${index}" aria-label="Remover imagem">×</button>${index === 0 ? "<span>Capa</span>" : ""}</div>`).join("");
  document.getElementById("preview").onclick = event => {
    const button = event.target.closest("[data-rm]");
    if (!button) return;
    uploads.splice(Number(button.dataset.rm), 1);
    previewImages();
  };
}

async function saveForm(event) {
  event.preventDefault();
  const id = document.getElementById("pId").value || null;
  const old = props.find(item => item.id === id);
  const latitudeRaw = document.getElementById("pLatitude").value.trim();
  const longitudeRaw = document.getElementById("pLongitude").value.trim();
  const property = {
    id, code: old?.code || "", title: document.getElementById("pTitle").value.trim(), purpose: document.getElementById("pPurpose").value,
    availabilityStatus: document.getElementById("pAvailability").value, type: document.getElementById("pType").value, price: Number(document.getElementById("pPrice").value),
    condoFee: Number(document.getElementById("pCondoFee").value || 0), city: document.getElementById("pCity").value.trim(), neighborhood: document.getElementById("pNeighborhood").value.trim(),
    address: document.getElementById("pAddress").value.trim(), description: document.getElementById("pDescription").value.trim(), area: Number(document.getElementById("pArea").value || 0),
    bedrooms: Number(document.getElementById("pBedrooms").value || 0), suites: Number(document.getElementById("pSuites").value || 0), bathrooms: Number(document.getElementById("pBathrooms").value || 0),
    parking: Number(document.getElementById("pParking").value || 0), floor: Number(document.getElementById("pFloor").value || 0), pool: document.getElementById("pPool").checked,
    financing: document.getElementById("pFinancing").checked, condominium: document.getElementById("pCondominium").checked, featured: document.getElementById("pFeatured").checked,
    active: document.getElementById("pActive").checked, images: uploads, video: document.getElementById("pVideo").value.trim(), tour: document.getElementById("pTour").value.trim(),
    latitude: latitudeRaw === "" ? null : Number(latitudeRaw), longitude: longitudeRaw === "" ? null : Number(longitudeRaw), createdAt: old?.createdAt || new Date().toISOString()
  };

  if (!property.images.length) return toast("Adicione pelo menos uma imagem ao anúncio.", true);
  if ((property.latitude === null) !== (property.longitude === null)) return toast("Preencha latitude e longitude juntas.", true);
  if (property.latitude !== null && (!Number.isFinite(property.latitude) || !Number.isFinite(property.longitude))) return toast("Latitude ou longitude inválida.", true);

  try {
    const saved = await saveProperty(property);
    props = await getProperties();
    resetForm();
    await renderAll();
    show("properties");
    toast(`Imóvel salvo com o código ${saved.code}.`);
  } catch (error) {
    console.error(error);
    toast(`Erro ao salvar: ${error.message}`, true);
  }
}

function fillForm(property) {
  editing = property;
  uploads = [...(property.images || [])];
  const values = { pId: property.id, pCode: property.code, pTitle: property.title, pPurpose: property.purpose, pAvailability: property.availabilityStatus, pType: property.type,
    pPrice: property.price, pCondoFee: property.condoFee || "", pCity: property.city, pNeighborhood: property.neighborhood, pAddress: property.address || "", pDescription: property.description,
    pArea: property.area || "", pBedrooms: property.bedrooms || "", pSuites: property.suites || "", pBathrooms: property.bathrooms || "", pParking: property.parking || "", pFloor: property.floor || "",
    pLatitude: property.latitude ?? "", pLongitude: property.longitude ?? "", pVideo: property.video || "", pTour: property.tour || "" };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
  document.getElementById("pPool").checked = property.pool;
  document.getElementById("pFinancing").checked = property.financing;
  document.getElementById("pCondominium").checked = property.condominium;
  document.getElementById("pFeatured").checked = property.featured;
  document.getElementById("pActive").checked = property.active;
  document.getElementById("formTitle").textContent = "Editar imóvel";
  previewImages();
  show("form");
}

function resetForm() {
  editing = null;
  uploads = [];
  document.getElementById("propertyForm").reset();
  document.getElementById("pId").value = "";
  document.getElementById("pCode").value = "";
  document.getElementById("pActive").checked = true;
  document.getElementById("pAvailability").value = (PROPERTY_CONFIG.availabilityOptions || ["Disponível"])[0];
  document.getElementById("formTitle").textContent = "Cadastrar imóvel";
  previewImages();
}

function renderUsers() {
  document.getElementById("userList").innerHTML = profiles.map(profile => {
    const self = profile.id === currentUser.id;
    return `<div class="user-row ${profile.enabled ? "" : "user-disabled"}"><div class="user-info"><strong>${esc(profile.name)}</strong><small>${esc(profile.email)}</small></div><div class="user-meta"><em>${profile.role === "admin" ? "Administrador" : "Corretor"}</em><span class="user-status ${profile.enabled ? "enabled" : "disabled"}">${profile.enabled ? "Ativo" : "Desabilitado"}</span></div><div class="user-actions"><button data-user-act="edit" data-id="${profile.id}" type="button">Editar</button><button data-user-act="toggle" data-id="${profile.id}" type="button" ${self ? "disabled" : ""}>${profile.enabled ? "Desabilitar" : "Reativar"}</button><button data-user-act="delete" data-id="${profile.id}" class="danger" type="button" ${self ? "disabled" : ""}>Excluir</button></div></div>`;
  }).join("") || "<p>Nenhum usuário encontrado.</p>";
}

async function addUser(event) {
  event.preventDefault();
  const button = event.submitter;
  const message = document.getElementById("userFormMessage");
  button.disabled = true;
  message.textContent = "Criando usuário...";
  try {
    await createUser({ name: document.getElementById("uName").value.trim(), email: document.getElementById("uEmail").value.trim(), password: document.getElementById("uPassword").value, role: document.getElementById("uRole").value });
    document.getElementById("userForm").reset();
    profiles = await getProfiles();
    renderUsers();
    message.textContent = "Usuário criado com sucesso.";
  } catch (error) {
    message.textContent = `Erro: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function handleUserAction(event) {
  const button = event.target.closest("[data-user-act]");
  if (!button) return;
  const profile = profiles.find(item => item.id === button.dataset.id);
  if (!profile) return;
  if (button.dataset.userAct === "edit") return openUserDialog(profile);
  if (button.dataset.userAct === "toggle") {
    if (profile.id === currentUser.id) return toast("Você não pode desabilitar a própria conta.", true);
    const newEnabled = !profile.enabled;
    try { await manageUser({ action: "toggle", userId: profile.id, enabled: newEnabled }); profiles = await getProfiles(); renderUsers(); toast(newEnabled ? "Usuário reativado." : "Usuário desabilitado."); } catch (error) { toast(`Erro: ${error.message}`, true); }
  }
  if (button.dataset.userAct === "delete") {
    if (profile.id === currentUser.id) return toast("Você não pode excluir a própria conta.", true);
    if (!confirm(`Excluir definitivamente o usuário ${profile.name}?`)) return;
    try { await manageUser({ action: "delete", userId: profile.id }); profiles = await getProfiles(); renderUsers(); toast("Usuário excluído."); } catch (error) { toast(`Erro: ${error.message}`, true); }
  }
}

function openUserDialog(profile) {
  document.getElementById("editUserId").value = profile.id;
  document.getElementById("editUserName").value = profile.name;
  document.getElementById("editUserEmail").value = profile.email;
  document.getElementById("editUserRole").value = profile.role;
  document.getElementById("editUserPassword").value = "";
  document.getElementById("userDialog").showModal();
}

function closeUserDialog() {
  const dialog = document.getElementById("userDialog");
  if (dialog.open) dialog.close();
}

async function saveUserEdit(event) {
  event.preventDefault();
  const payload = { action: "update", userId: document.getElementById("editUserId").value, name: document.getElementById("editUserName").value.trim(), email: document.getElementById("editUserEmail").value.trim(), role: document.getElementById("editUserRole").value, password: document.getElementById("editUserPassword").value };
  try { await manageUser(payload); profiles = await getProfiles(); renderUsers(); closeUserDialog(); toast("Usuário atualizado."); } catch (error) { toast(`Erro: ${error.message}`, true); }
}

startAdmin();
