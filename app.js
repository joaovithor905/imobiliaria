"use strict";

let all = [];
let shown = [];
let activeLeafletMap = null;

const grid = document.getElementById("propertyGrid");
const dialog = document.getElementById("detailDialog");

async function initPublic() {
  fillConfiguredSelect(document.getElementById("qType"), PROPERTY_CONFIG.types || [], "Todos");
  fillConfiguredSelect(document.getElementById("fType"), PROPERTY_CONFIG.types || [], "Todos");
  document.getElementById("year").textContent = new Date().getFullYear();
  bindPublic();
  try {
    all = (await getProperties()).filter(property => property.active);
  } catch (error) {
    console.error(error);
    toast(`Erro ao carregar imóveis: ${error.message}`, true);
    all = [];
  }
  shown = [...all];
  renderProperties();
}

function availabilityClass(status) {
  if (status === "Disponível") return "available";
  if (status === "Reservado") return "reserved";
  return "unavailable";
}

function renderProperties() {
  const sortMode = document.getElementById("sort").value;
  const list = [...shown];
  if (sortMode === "featured") list.sort((a, b) => Number(b.featured) - Number(a.featured) || new Date(b.createdAt) - new Date(a.createdAt));
  if (sortMode === "newest") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sortMode === "priceAsc") list.sort((a, b) => a.price - b.price);
  if (sortMode === "priceDesc") list.sort((a, b) => b.price - a.price);

  document.getElementById("activeCount").textContent = all.filter(p => p.availabilityStatus === "Disponível").length;
  document.getElementById("resultCount").textContent = `${list.length} ${list.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}`;
  document.getElementById("empty").classList.toggle("hidden", list.length > 0);

  grid.innerHTML = list.map(property => `
    <article class="property-card">
      <div class="property-image">
        <img src="${esc(property.images?.[0] || FALLBACK_IMAGE)}" alt="${esc(property.title)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        <div class="badges">
          <span>${esc(property.purpose)}</span>
          ${property.featured ? "<span class='featured'>Destaque</span>" : ""}
        </div>
        <span class="availability-badge ${availabilityClass(property.availabilityStatus)}">${esc(property.availabilityStatus)}</span>
      </div>
      <div class="property-body">
        <small>${esc(property.code)} · ${esc(property.neighborhood)} · ${esc(property.city)}</small>
        <h3>${esc(property.title)}</h3>
        <b class="price">${money(property.price)}${property.purpose === "Aluguel" ? "<i>/mês</i>" : ""}</b>
        <div class="facts">${property.area ? `<span>${property.area} m²</span>` : ""}${property.bedrooms ? `<span>${property.bedrooms} quartos</span>` : ""}${property.suites ? `<span>${property.suites} suítes</span>` : ""}${property.parking ? `<span>${property.parking} vagas</span>` : ""}</div>
        <p>${esc(property.description)}</p>
        <button class="btn primary full" type="button" data-open="${property.id}">Ver detalhes</button>
      </div>
    </article>`).join("");
}

function applyFilters() {
  const text = document.getElementById("fText").value.trim().toLowerCase();
  const min = Number(document.getElementById("fMin").value || 0);
  const max = Number(document.getElementById("fMax").value || Infinity);
  shown = all.filter(property => {
    const haystack = `${property.title} ${property.code} ${property.city} ${property.neighborhood} ${property.address}`.toLowerCase();
    return (!text || haystack.includes(text))
      && (!document.getElementById("fPurpose").value || property.purpose === document.getElementById("fPurpose").value)
      && (!document.getElementById("fType").value || property.type === document.getElementById("fType").value)
      && property.price >= min && property.price <= max
      && Number(property.bedrooms || 0) >= Number(document.getElementById("fBeds").value || 0)
      && Number(property.suites || 0) >= Number(document.getElementById("fSuites").value || 0)
      && Number(property.parking || 0) >= Number(document.getElementById("fParking").value || 0)
      && Number(property.area || 0) >= Number(document.getElementById("fArea").value || 0)
      && (!document.getElementById("fPool").checked || property.pool)
      && (!document.getElementById("fFinance").checked || property.financing)
      && (!document.getElementById("fCondo").checked || property.condominium);
  });
  renderProperties();
}

function bindPublic() {
  const nav = document.getElementById("siteNav");
  const menuBtn = document.getElementById("menuBtn");
  menuBtn.onclick = () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }));
  document.getElementById("themeBtn").onclick = toggleTheme;
  document.getElementById("filterToggle").onclick = () => document.getElementById("filters").classList.toggle("hidden");
  document.getElementById("sort").onchange = renderProperties;
  document.getElementById("filters").onsubmit = event => { event.preventDefault(); applyFilters(); };
  document.getElementById("clearFilters").onclick = () => { document.getElementById("filters").reset(); shown = [...all]; renderProperties(); };
  document.getElementById("quickSearch").onsubmit = event => {
    event.preventDefault();
    document.getElementById("fText").value = document.getElementById("qText").value;
    document.getElementById("fPurpose").value = document.getElementById("qPurpose").value;
    document.getElementById("fType").value = document.getElementById("qType").value;
    applyFilters();
    document.getElementById("imoveis").scrollIntoView({ behavior: "smooth" });
  };
  grid.onclick = event => {
    const button = event.target.closest("[data-open]");
    if (button) openDetail(button.dataset.open);
  };
  document.getElementById("closeDialog").onclick = closePropertyDialog;
  dialog.onclick = event => { if (event.target === dialog) closePropertyDialog(); };
  dialog.addEventListener("close", destroyLeafletMap);
}

function destroyLeafletMap() {
  if (activeLeafletMap) {
    activeLeafletMap.remove();
    activeLeafletMap = null;
  }
}

function createPropertyMap(property) {
  if (!MAP_CONFIG.enabled || !window.L || !Number.isFinite(Number(property.latitude)) || !Number.isFinite(Number(property.longitude))) return;
  destroyLeafletMap();
  const element = document.getElementById("propertyMap");
  if (!element) return;
  const point = [Number(property.latitude), Number(property.longitude)];
  activeLeafletMap = L.map(element, { scrollWheelZoom: false }).setView(point, Number(MAP_CONFIG.defaultZoom || 17));
  L.tileLayer(MAP_CONFIG.tileUrl, { attribution: MAP_CONFIG.attribution || "" }).addTo(activeLeafletMap);
  L.marker(point).addTo(activeLeafletMap).bindPopup(esc(property.title)).openPopup();
  setTimeout(() => activeLeafletMap?.invalidateSize(), 80);
}

function closePropertyDialog() {
  destroyLeafletMap();
  if (dialog.open) dialog.close();
}

function openDetail(id) {
  const property = all.find(item => item.id === id);
  if (!property) return;
  metric(id, "views");
  const images = property.images?.length ? property.images : [FALLBACK_IMAGE];
  const similar = all.filter(item => item.id !== id && (item.type === property.type || item.neighborhood === property.neighborhood)).slice(0, 3);
  const available = property.availabilityStatus === "Disponível";
  const interestLink = wa(CONTACT.whatsapp, `Olá, quero informações sobre o imóvel ${property.code}: ${property.title}.`);
  const routeLink = googleRoute(property.latitude, property.longitude);
  const hasMap = MAP_CONFIG.enabled && routeLink;

  document.getElementById("detailContent").innerHTML = `
    <div class="detail-gallery"><img id="mainImg" src="${esc(images[0])}" alt="${esc(property.title)}"><div>${images.map(image => `<button type="button" data-img="${esc(image)}"><img src="${esc(image)}" alt="Foto do imóvel"></button>`).join("")}</div></div>
    <div class="detail-grid">
      <div>
        <div class="detail-title-row"><span class="eyebrow">${esc(property.code)} · ${esc(property.purpose)}</span><span class="availability-badge static ${availabilityClass(property.availabilityStatus)}">${esc(property.availabilityStatus)}</span></div>
        <h2>${esc(property.title)}</h2>
        <p class="detail-location">${esc(property.address || "")} ${esc(property.neighborhood)} · ${esc(property.city)}</p>
        <b class="detail-price">${money(property.price)}${property.purpose === "Aluguel" ? "<small>/mês</small>" : ""}</b>
        ${property.condoFee ? `<p>Condomínio: ${money(property.condoFee)}</p>` : ""}
        <div class="detail-facts">${property.area ? `<span>${property.area} m²</span>` : ""}${property.bedrooms ? `<span>${property.bedrooms} quartos</span>` : ""}${property.suites ? `<span>${property.suites} suítes</span>` : ""}${property.bathrooms ? `<span>${property.bathrooms} banheiros</span>` : ""}${property.parking ? `<span>${property.parking} vagas</span>` : ""}</div>
        <p class="long">${esc(property.description)}</p>
        <div class="checks">${property.pool ? "<span>✓ Piscina</span>" : ""}${property.financing ? "<span>✓ Aceita financiamento</span>" : ""}${property.condominium ? "<span>✓ Condomínio</span>" : ""}</div>
        <div class="actions">
          ${available ? `<a id="interest" class="btn primary" href="${interestLink}" target="_blank" rel="noopener">${WA_SVG} Tenho interesse</a>` : `<span class="unavailable-message">Este imóvel está ${esc(property.availabilityStatus.toLowerCase())}.</span>`}
          <button id="share" class="btn outline" type="button">Compartilhar</button>
          <a class="btn outline social-action" href="${esc(CONTACT.instagram)}" target="_blank" rel="noopener">${IG_SVG} Instagram</a>
        </div>
      </div>
      <aside>
        ${property.video ? `<div class="media"><h3>Vídeo</h3><iframe src="${esc(youtube(property.video))}" allowfullscreen loading="lazy"></iframe></div>` : ""}
        ${property.tour ? `<a class="media link" href="${esc(property.tour)}" target="_blank" rel="noopener">Abrir tour 360°</a>` : ""}
        ${hasMap ? `<div class="media"><h3>Localização</h3><div id="propertyMap" class="property-map" aria-label="Mapa do imóvel"></div><a class="btn primary full route-btn" href="${esc(routeLink)}" target="_blank" rel="noopener">Traçar rota no Google Maps</a></div>` : `<div class="media location-empty"><h3>Localização</h3><p>Localização exata não informada para este imóvel.</p></div>`}
      </aside>
    </div>
    ${similar.length ? `<div class="similar"><h3>Imóveis semelhantes</h3><div>${similar.map(item => `<button type="button" data-similar="${item.id}"><img src="${esc(item.images?.[0] || FALLBACK_IMAGE)}" alt=""><span>${esc(item.title)}</span><b>${money(item.price)}</b></button>`).join("")}</div></div>` : ""}`;

  document.querySelector(".detail-gallery > div").onclick = event => {
    const button = event.target.closest("[data-img]");
    if (button) document.getElementById("mainImg").src = button.dataset.img;
  };
  const interest = document.getElementById("interest");
  if (interest) interest.onclick = () => metric(id, "clicks");
  document.getElementById("share").onclick = async () => {
    const shareData = { title: property.title, text: `${property.code} — ${property.title}`, url: `${location.origin}${location.pathname}#${property.code}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast("Link copiado."); }
    } catch (error) {
      if (error.name !== "AbortError") toast("Não foi possível compartilhar.", true);
    }
  };
  document.querySelectorAll("[data-similar]").forEach(button => button.onclick = () => openDetail(button.dataset.similar));

  dialog.showModal();
  if (hasMap) createPropertyMap(property);
}

initPublic();
