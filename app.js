let all = [];
let shown = [];
let S = DEF_SETTINGS;

const grid = document.getElementById("propertyGrid");
const dialog = document.getElementById("detailDialog");
const WA_SVG = `<svg class="wa-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.07 0C5.54 0 .23 5.31.23 11.84c0 2.09.55 4.13 1.6 5.92L.13 24l6.39-1.68a11.8 11.8 0 0 0 5.54 1.41h.01c6.52 0 11.83-5.31 11.83-11.84 0-3.16-1.2-6.14-3.38-8.41Zm-8.45 18.25h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.82 9.82 0 1 1 8.38 4.66Zm5.39-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47a8.93 8.93 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.49.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z"/></svg>`;

async function init() {
  S = await getSettings();
  applyBrand(S);
  all = (await getProperties()).filter(property => property.active);
  shown = [...all];
  document.querySelectorAll(".js-whatsapp").forEach(link => {
    link.href = wa(S.whatsapp, "Olá, vim pelo site e quero informações sobre os imóveis.");
  });
  document.getElementById("year").textContent = new Date().getFullYear();
  bind();
  render();
}

function availabilityClass(status) {
  return status === "Disponível" ? "available" : status === "Reservado" ? "reserved" : "unavailable";
}

function render() {
  const list = [...shown];
  const order = document.getElementById("sort").value;
  if (order === "featured") list.sort((a, b) => Number(b.featured) - Number(a.featured) || new Date(b.createdAt) - new Date(a.createdAt));
  if (order === "newest") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (order === "priceAsc") list.sort((a, b) => a.price - b.price);
  if (order === "priceDesc") list.sort((a, b) => b.price - a.price);

  document.getElementById("activeCount").textContent = all.filter(property => property.availabilityStatus === "Disponível").length;
  document.getElementById("resultCount").textContent = `${list.length} ${list.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}`;
  document.getElementById("empty").classList.toggle("hidden", list.length > 0);

  grid.innerHTML = list.map(property => {
    const available = property.availabilityStatus === "Disponível";
    return `<article class="property-card">
      <div class="property-image">
        <img src="${esc(property.images?.[0] || DEF_PROPERTIES[0].images[0])}" alt="${esc(property.title)}" loading="lazy">
        <div class="badges"><span>${esc(property.purpose)}</span>${property.featured ? "<span class='featured'>Destaque</span>" : ""}</div>
        <span class="availability-badge ${availabilityClass(property.availabilityStatus)}">${esc(property.availabilityStatus)}</span>
      </div>
      <div class="property-body">
        <small>${esc(property.code)} · ${esc(property.neighborhood)} · ${esc(property.city)}</small>
        <h3>${esc(property.title)}</h3>
        <b class="price">${money(property.price)}${property.purpose === "Aluguel" ? "<i>/mês</i>" : ""}</b>
        <div class="facts">${property.area ? `<span>${property.area} m²</span>` : ""}${property.bedrooms ? `<span>${property.bedrooms} quartos</span>` : ""}${property.suites ? `<span>${property.suites} suítes</span>` : ""}${property.parking ? `<span>${property.parking} vagas</span>` : ""}</div>
        <p>${esc(property.description)}</p>
        <button class="btn ${available ? "primary" : "outline"} full" data-open="${property.id}">${available ? "Ver detalhes" : `Imóvel ${esc(property.availabilityStatus.toLowerCase())}`}</button>
      </div>
    </article>`;
  }).join("");
}

function applyFilters() {
  const text = document.getElementById("fText").value.toLowerCase();
  const min = Number(document.getElementById("fMin").value || 0);
  const max = Number(document.getElementById("fMax").value || Infinity);
  shown = all.filter(property => {
    const search = `${property.title} ${property.code} ${property.city} ${property.neighborhood}`.toLowerCase();
    return (!text || search.includes(text))
      && (!document.getElementById("fPurpose").value || property.purpose === document.getElementById("fPurpose").value)
      && (!document.getElementById("fType").value || property.type === document.getElementById("fType").value)
      && (!document.getElementById("fAvailability").value || property.availabilityStatus === document.getElementById("fAvailability").value)
      && property.price >= min && property.price <= max
      && Number(property.bedrooms || 0) >= Number(document.getElementById("fBeds").value || 0)
      && Number(property.suites || 0) >= Number(document.getElementById("fSuites").value || 0)
      && Number(property.parking || 0) >= Number(document.getElementById("fParking").value || 0)
      && Number(property.area || 0) >= Number(document.getElementById("fArea").value || 0)
      && (!document.getElementById("fPool").checked || property.pool)
      && (!document.getElementById("fFinance").checked || property.financing)
      && (!document.getElementById("fCondo").checked || property.condominium);
  });
  render();
}

function bind() {
  document.getElementById("menuBtn").onclick = () => document.getElementById("nav").classList.toggle("open");
  document.getElementById("themeBtn").onclick = toggleTheme;
  document.getElementById("filterToggle").onclick = () => document.getElementById("filters").classList.toggle("hidden");
  document.getElementById("sort").onchange = render;
  document.getElementById("filters").onsubmit = event => { event.preventDefault(); applyFilters(); };
  document.getElementById("clearFilters").onclick = () => { document.getElementById("filters").reset(); shown = [...all]; render(); };
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
  document.getElementById("closeDialog").onclick = () => dialog.close();
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
}

function openDetail(id) {
  const property = all.find(item => item.id === id);
  if (!property) return;
  metric(id, "views");
  const images = property.images?.length ? property.images : [DEF_PROPERTIES[0].images[0]];
  const similar = all.filter(item => item.id !== id && (item.type === property.type || item.neighborhood === property.neighborhood)).slice(0, 3);
  const isAvailable = property.availabilityStatus === "Disponível";
  const interestLink = wa(S.whatsapp, `Olá, quero informações sobre o imóvel ${property.code}: ${property.title}.`);

  document.getElementById("detailContent").innerHTML = `
  <div class="detail-gallery">
    <img 
      id="mainImg" 
      src="${esc(images[0])}" 
      alt="${esc(property.title)}">

    <div>
      ${images.map(image => `
        <button data-img="${esc(image)}">
          <img 
            src="${esc(image)}" 
            alt="Foto do imóvel">
        </button>
      `).join("")}
    </div>
  </div>

  <div class="detail-grid">
    <div>

      <div class="detail-title-row">
        <span class="eyebrow">
          ${esc(property.code)} · ${esc(property.purpose)}
        </span>

        <span class="availability-badge static ${availabilityClass(property.availabilityStatus)}">
          ${esc(property.availabilityStatus)}
        </span>
      </div>

      <h2>${esc(property.title)}</h2>

      <p>
        ${esc(property.address || "")}
        ${esc(property.neighborhood)} ·
        ${esc(property.city)}
      </p>

      <b class="detail-price">
        ${money(property.price)}
        ${property.purpose === "Aluguel" ? "<small>/mês</small>" : ""}
      </b>

      ${property.condoFee ? `
        <p>Condomínio: ${money(property.condoFee)}</p>
      ` : ""}

      <div class="detail-facts">
        ${property.area ? `<span>${property.area} m²</span>` : ""}
        ${property.bedrooms ? `<span>${property.bedrooms} quartos</span>` : ""}
        ${property.suites ? `<span>${property.suites} suítes</span>` : ""}
        ${property.bathrooms ? `<span>${property.bathrooms} banheiros</span>` : ""}
        ${property.parking ? `<span>${property.parking} vagas</span>` : ""}
      </div>

      <p class="long">
        ${esc(property.description)}
      </p>

      <div class="checks">
        ${property.pool ? "<span>✓ Piscina</span>" : ""}
        ${property.financing ? "<span>✓ Aceita financiamento</span>" : ""}
        ${property.condominium ? "<span>✓ Condomínio</span>" : ""}
      </div>

      <div class="actions">

        ${isAvailable ? `
          <a 
            id="interest" 
            class="btn primary" 
            href="${interestLink}" 
            target="_blank" 
            rel="noopener">

            ${WA_SVG} Tenho interesse
          </a>
        ` : `
          <span class="unavailable-message">
            Este imóvel está ${esc(property.availabilityStatus.toLowerCase())}.
          </span>
        `}

        <button 
          id="share" 
          class="btn outline">
          Compartilhar
        </button>

        <a 
          class="btn outline" 
          href="${esc(S.instagram)}" 
          target="_blank" 
          rel="noopener">
          Instagram
        </a>

      </div>
    </div>

    <aside>

      ${property.video ? `
        <div class="media">
          <h3>Vídeo</h3>

          <iframe 
            src="${youtube(property.video)}" 
            allowfullscreen>
          </iframe>
        </div>
      ` : ""}

      ${property.tour ? `
        <a 
          class="media link" 
          href="${esc(property.tour)}" 
          target="_blank" 
          rel="noopener">
          Abrir tour 360°
        </a>
      ` : ""}

      ${normalizeGoogleMapsEmbed(property.map) ? `
        <div class="media">
          <h3>Localização</h3>

          <iframe
            src="${esc(normalizeGoogleMapsEmbed(property.map))}"
            loading="lazy"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin">
          </iframe>

        </div>
      ` : ""}

    </aside>

  </div>

  ${similar.length ? `
    <div class="similar">

      <h3>Imóveis semelhantes</h3>

      <div>
        ${similar.map(item => `
          <button data-similar="${item.id}">

            <img 
              src="${esc(item.images?.[0] || "")}" 
              alt="">

            <span>
              ${esc(item.title)}
            </span>

            <b>
              ${money(item.price)}
            </b>

          </button>
        `).join("")}
      </div>

    </div>
  ` : ""}
`;

  document.querySelector(".detail-gallery div").onclick = event => {
    const button = event.target.closest("[data-img]");
    if (button) document.getElementById("mainImg").src = button.dataset.img;
  };
  const interest = document.getElementById("interest");
  if (interest) interest.onclick = () => metric(id, "clicks");
  document.getElementById("share").onclick = async () => {
    const data = { title: property.title, text: `Confira este imóvel: ${property.title}`, url: location.href };
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(location.href); toast("Link copiado."); }
  };
  document.querySelectorAll("[data-similar]").forEach(button => button.onclick = () => openDetail(button.dataset.similar));
  dialog.showModal();
}

init().catch(error => {
  console.error(error);
  toast("Não foi possível carregar os imóveis.");
});
