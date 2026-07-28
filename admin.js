let props = [];
let uploads = [];
let editing = null;
let currentUser = null;
let profiles = [];

const demos = {
  "admin@demo.com": { password: "admin123", role: "admin", name: "Administrador Demo" },
  "corretor@demo.com": { password: "corretor123", role: "corretor", name: "Corretor Demo" }
};

async function start() {
  bindAdmin();
  if (db) {
    const { data } = await db.auth.getSession();
    if (data.session?.user) {
      currentUser = await buildRemoteUser(data.session.user);
      await enter();
      return;
    }
  }
  const session = localGet(K.session, null);
  if (session) {
    currentUser = session;
    await enter();
  }
}

function bindAdmin() {
  document.getElementById("loginForm").onsubmit = login;
  document.getElementById("logout").onclick = logout;
  document.getElementById("adminTheme").onclick = toggleTheme;
  document.getElementById("sideBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");
  document.querySelectorAll("[data-view]").forEach(button => button.onclick = () => show(button.dataset.view));
  document.querySelectorAll("[data-new]").forEach(button => button.onclick = () => { resetForm(); show("form"); });
  document.getElementById("propertyForm").onsubmit = saveForm;
  document.getElementById("cancelEdit").onclick = () => { resetForm(); show("properties"); };
  document.getElementById("adminSearch").oninput = renderList;
  document.getElementById("statusFilter").onchange = renderList;
  document.getElementById("userForm").onsubmit = addUser;
  document.getElementById("settingsForm").onsubmit = saveConfig;

  const dropZone = document.getElementById("dropZone");
  const input = document.getElementById("pImages");
  dropZone.onclick = () => input.click();
  input.onchange = () => addFiles([...input.files]);
  dropZone.ondragover = event => { event.preventDefault(); dropZone.classList.add("drag"); };
  dropZone.ondragleave = () => dropZone.classList.remove("drag");
  dropZone.ondrop = event => { event.preventDefault(); dropZone.classList.remove("drag"); addFiles([...event.dataTransfer.files]); };
}

async function buildRemoteUser(authUser) {
  const { data: profile, error } = await db.from("profiles").select("id,name,email,role").eq("id", authUser.id).single();
  if (error) throw new Error("O usuário existe, mas não possui perfil no banco.");
  return { id: profile.id, email: profile.email || authUser.email, name: profile.name, role: profile.role };
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

    const demo = demos[email];
    const localUser = localGet(K.users, DEF_USERS).find(item => item.email.toLowerCase() === email);
    const account = demo || localUser;
    if (!account || account.password !== password) throw new Error("Credenciais inválidas.");
    currentUser = { id: account.id || email, email, name: account.name, role: account.role };
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
  await fillConfig();
}

function show(view) {
  const titles = { dashboard: "Visão geral", properties: "Imóveis", form: editing ? "Editar imóvel" : "Novo imóvel", users: "Usuários", settings: "Configurações" };
  document.querySelectorAll(".admin-view").forEach(element => element.classList.add("hidden"));
  document.getElementById(`${view}View`).classList.remove("hidden");
  document.querySelectorAll("[data-view]").forEach(element => element.classList.toggle("active", element.dataset.view === view));
  document.getElementById("viewTitle").textContent = titles[view];
  document.getElementById("sidebar").classList.remove("open");
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

  const rank = props.map(property => ({ ...property, views: analytics[property.id]?.views || 0, clicks: analytics[property.id]?.clicks || 0 }))
    .sort((a, b) => b.views - a.views).slice(0, 5);
  document.getElementById("ranking").innerHTML = rank.map((property, index) => `<div class="rank-item"><b>${index + 1}</b><span><strong>${esc(property.title)}</strong><small>${property.views} visualizações · ${property.clicks} cliques</small></span></div>`).join("") || "<p>Sem dados ainda.</p>";

  const max = Math.max(available, unavailable, views, clicks, 1);
  const data = [["Disponíveis", available], ["Alugados/Vendidos", unavailable], ["Visualizações", views], ["Cliques", clicks]];
  document.getElementById("simpleChart").innerHTML = data.map(item => `<div><span>${item[0]} <b>${item[1]}</b></span><i><em style="width:${item[1] / max * 100}%"></em></i></div>`).join("");
}

function renderList() {
  const text = document.getElementById("adminSearch").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const list = props.filter(property => (!text || `${property.title} ${property.code} ${property.neighborhood}`.toLowerCase().includes(text)) && (!status || property.availabilityStatus === status));

  document.getElementById("adminList").innerHTML = list.map(property => `<article class="admin-item">
    <img src="${esc(property.images?.[0] || "")}" alt="${esc(property.title)}">
    <div>
      <h3>${esc(property.title)}</h3>
      <p>${esc(property.code)} · ${esc(property.purpose)} · ${esc(property.neighborhood)}</p>
      <strong>${money(property.price)}</strong>
      <label class="quick-status">Disponibilidade
        <select data-property-status="${property.id}">
          ${["Disponível", "Alugado", "Vendido", "Reservado"].map(option => `<option ${property.availabilityStatus === option ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
      <span class="pill ${property.active ? "on" : "off"}">${property.active ? "Visível" : "Oculto"}</span>
    </div>
    <div class="item-actions">
      <button data-act="toggle" data-id="${property.id}">${property.active ? "Ocultar" : "Exibir"}</button>
      <button data-act="featured" data-id="${property.id}">${property.featured ? "Remover destaque" : "Destacar"}</button>
      <button data-act="edit" data-id="${property.id}">Editar</button>
      <button data-act="delete" data-id="${property.id}" class="danger">Excluir</button>
    </div>
  </article>`).join("") || "<div class='empty'><h3>Nenhum imóvel cadastrado</h3></div>";

  document.getElementById("adminList").onclick = handlePropertyAction;
  document.getElementById("adminList").onchange = handleAvailabilityChange;
}

async function handleAvailabilityChange(event) {
  const select = event.target.closest("[data-property-status]");
  if (!select) return;
  const property = props.find(item => item.id === select.dataset.propertyStatus);
  if (!property) return;
  property.availabilityStatus = select.value;
  try {
    const saved = await saveProperty(property);
    Object.assign(property, saved);
    await renderAll();
    toast("Disponibilidade atualizada.");
  } catch (error) {
    console.error(error);
    toast(`Erro: ${error.message}`);
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
    if (button.dataset.act === "delete") {
      if (!confirm(`Excluir "${property.title}"?`)) return;
      await removeProperty(property.id);
    }
    props = await getProperties();
    await renderAll();
    toast("Alteração salva.");
  } catch (error) {
    console.error(error);
    toast(`Erro: ${error.message}`);
  }
}

async function addFiles(files) {
  const images = files.filter(file => file.type.startsWith("image/"));
  if (!images.length) return;
  try {
    document.getElementById("dropZone").classList.add("uploading");
    const urls = await uploadPropertyImages(images);
    uploads.push(...urls);
    previewImages();
    toast(`${urls.length} ${urls.length === 1 ? "imagem adicionada" : "imagens adicionadas"}.`);
  } catch (error) {
    console.error(error);
    toast(error.message);
  } finally {
    document.getElementById("dropZone").classList.remove("uploading");
    document.getElementById("pImages").value = "";
  }
}

function previewImages() {
  document.getElementById("preview").innerHTML = uploads.map((url, index) => `<div><img src="${esc(url)}" alt="Prévia da imagem"><button type="button" data-rm="${index}" aria-label="Remover imagem">×</button>${index === 0 ? "<span>Capa</span>" : ""}</div>`).join("");
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
  const property = {
    id,
    code: old?.code || "",
    title: document.getElementById("pTitle").value.trim(),
    purpose: document.getElementById("pPurpose").value,
    availabilityStatus: document.getElementById("pAvailability").value,
    type: document.getElementById("pType").value,
    price: Number(document.getElementById("pPrice").value),
    condoFee: Number(document.getElementById("pCondoFee").value || 0),
    city: document.getElementById("pCity").value.trim(),
    neighborhood: document.getElementById("pNeighborhood").value.trim(),
    address: document.getElementById("pAddress").value.trim(),
    description: document.getElementById("pDescription").value.trim(),
    area: Number(document.getElementById("pArea").value || 0),
    bedrooms: Number(document.getElementById("pBedrooms").value || 0),
    suites: Number(document.getElementById("pSuites").value || 0),
    bathrooms: Number(document.getElementById("pBathrooms").value || 0),
    parking: Number(document.getElementById("pParking").value || 0),
    floor: Number(document.getElementById("pFloor").value || 0),
    pool: document.getElementById("pPool").checked,
    financing: document.getElementById("pFinancing").checked,
    condominium: document.getElementById("pCondominium").checked,
    featured: document.getElementById("pFeatured").checked,
    active: document.getElementById("pActive").checked,
    images: uploads,
    video: document.getElementById("pVideo").value.trim(),
    tour: document.getElementById("pTour").value.trim(),
    map: document.getElementById("pMap").value.trim(),
    createdAt: old?.createdAt || new Date().toISOString()
  };

  if (!property.images.length) {
    toast("Adicione pelo menos uma imagem ao anúncio.");
    return;
  }

  try {
    const saved = await saveProperty(property);
    props = await getProperties();
    resetForm();
    await renderAll();
    show("properties");
    toast(`Imóvel salvo com o código ${saved.code}.`);
  } catch (error) {
    console.error(error);
    toast(`Erro ao salvar: ${error.message}`);
  }
}

function fillForm(property) {
  editing = property;
  uploads = [...(property.images || [])];
  document.getElementById("pId").value = property.id;
  document.getElementById("pCode").value = property.code;
  document.getElementById("pTitle").value = property.title;
  document.getElementById("pPurpose").value = property.purpose;
  document.getElementById("pAvailability").value = property.availabilityStatus;
  document.getElementById("pType").value = property.type;
  document.getElementById("pPrice").value = property.price;
  document.getElementById("pCondoFee").value = property.condoFee || "";
  document.getElementById("pCity").value = property.city;
  document.getElementById("pNeighborhood").value = property.neighborhood;
  document.getElementById("pAddress").value = property.address || "";
  document.getElementById("pDescription").value = property.description;
  document.getElementById("pArea").value = property.area || "";
  document.getElementById("pBedrooms").value = property.bedrooms || "";
  document.getElementById("pSuites").value = property.suites || "";
  document.getElementById("pBathrooms").value = property.bathrooms || "";
  document.getElementById("pParking").value = property.parking || "";
  document.getElementById("pFloor").value = property.floor || "";
  document.getElementById("pPool").checked = property.pool;
  document.getElementById("pFinancing").checked = property.financing;
  document.getElementById("pCondominium").checked = property.condominium;
  document.getElementById("pFeatured").checked = property.featured;
  document.getElementById("pActive").checked = property.active;
  document.getElementById("pVideo").value = property.video || "";
  document.getElementById("pTour").value = property.tour || "";
  document.getElementById("pMap").value = property.map || "";
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
  document.getElementById("pAvailability").value = "Disponível";
  document.getElementById("formTitle").textContent = "Cadastrar imóvel";
  previewImages();
}

function renderUsers() {
  document.getElementById("userList").innerHTML = profiles.map(profile => `<div class="user-row"><span><strong>${esc(profile.name)}</strong><small>${esc(profile.email)}</small></span><em>${profile.role === "admin" ? "Administrador" : "Corretor"}</em></div>`).join("") || "<p>Nenhum usuário encontrado.</p>";
}

async function addUser(event) {
  event.preventDefault();
  const message = document.getElementById("userFormMessage");
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Criando...";
  message.textContent = "";

  try {
    const user = await createUserAccount({
      name: document.getElementById("uName").value.trim(),
      email: document.getElementById("uEmail").value.trim().toLowerCase(),
      password: document.getElementById("uPassword").value,
      role: document.getElementById("uRole").value
    });
    profiles = await getProfiles();
    renderUsers();
    event.target.reset();
    message.textContent = `Usuário ${user.email} criado com sucesso.`;
    toast("Novo usuário criado.");
  } catch (error) {
    console.error(error);
    message.textContent = `Erro: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Criar usuário";
  }
}

async function fillConfig() {
  const settings = await getSettings();
  document.getElementById("cName").value = settings.name;
  document.getElementById("cInitials").value = settings.initials;
  document.getElementById("cWhatsapp").value = settings.whatsapp;
  document.getElementById("cPhone").value = settings.phone;
  document.getElementById("cInstagram").value = settings.instagram;
  document.getElementById("cAddress").value = settings.address;
  document.getElementById("cPrimary").value = settings.primary;
  document.getElementById("cAccent").value = settings.accent;
  document.getElementById("cDescription").value = settings.description;
  document.getElementById("cLogo").value = settings.logo;
  applyBrand(settings);
}

async function saveConfig(event) {
  event.preventDefault();
  const settings = {
    name: document.getElementById("cName").value,
    initials: document.getElementById("cInitials").value,
    whatsapp: document.getElementById("cWhatsapp").value,
    phone: document.getElementById("cPhone").value,
    instagram: document.getElementById("cInstagram").value,
    address: document.getElementById("cAddress").value,
    primary: document.getElementById("cPrimary").value,
    accent: document.getElementById("cAccent").value,
    description: document.getElementById("cDescription").value,
    logo: document.getElementById("cLogo").value
  };
  try {
    await saveSettings(settings);
    applyBrand(settings);
    toast("Configurações salvas.");
  } catch (error) {
    console.error(error);
    toast(`Erro: ${error.message}`);
  }
}

start().catch(error => {
  console.error(error);
  document.getElementById("loginError").textContent = error.message;
  document.getElementById("loginError").classList.remove("hidden");
});