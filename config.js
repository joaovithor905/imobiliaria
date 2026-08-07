/*
  PRIME LAR PRO — CONFIGURAÇÃO CENTRAL
  ------------------------------------------------------------
  Personalize o sistema SOMENTE neste arquivo.
  Nunca coloque sb_secret_... ou service_role aqui.
*/
window.APP_CONFIG = {
  app: {
    name: "Prime Lar",
    businessLabel: "Imobiliária",
    adminLabel: "Gestão imobiliária",
    logo: "assets/logo-prime-lar.png",
    locale: "pt-BR",
    currency: "BRL",
    storageNamespace: "primeLarProV4",
    defaultTheme: "light",
    allowThemeToggle: true,
    maxImagesPerProperty: 15,
    maxImageSizeMB: 8
  },

  brand: {
    primary: "#0f3d32",
    accent: "#c89b5b",
    themeColor: "#0f3d32"
  },

  contact: {
    whatsapp: "5564999999999",
    phone: "(64) 99999-9999",
    instagram: "https://instagram.com/",
    instagramLabel: "@suaimobiliaria",
    address: "Rio Verde - GO",
    whatsappMessage: "Olá, vim pelo site e quero informações sobre os imóveis."
  },

  seo: {
    title: "Prime Lar Imobiliária",
    description: "Imóveis para comprar e alugar com atendimento rápido pelo WhatsApp."
  },

  supabase: {
    url: "COLE_AQUI_A_URL_DO_SUPABASE",
    publishableKey: "COLE_AQUI_A_CHAVE_PUBLICAVEL",
    propertyImagesBucket: "property-images",
    createUserFunction: "create-user",
    manageUserFunction: "manage-user"
  },

  properties: {
    codePrefix: "IMV",
    availabilityOptions: ["Disponível", "Alugado", "Vendido", "Reservado"],
    types: ["Casa", "Apartamento", "Terreno", "Comercial", "Rural"]
  },

  map: {
    enabled: true,
    defaultZoom: 17,
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    googleRouteBaseUrl: "https://www.google.com/maps/dir/?api=1&destination="
  },

  demo: {
    enabledWhenSupabaseIsNotConfigured: true,
    accounts: [
      { id: "demo-admin", name: "Administrador Demo", email: "admin@demo.com", password: "admin123", role: "admin", enabled: true },
      { id: "demo-corretor", name: "Corretor Demo", email: "corretor@demo.com", password: "corretor123", role: "corretor", enabled: true }
    ]
  }
};
