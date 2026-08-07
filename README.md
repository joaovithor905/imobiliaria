# Prime Lar Pro V4

Site imobiliário responsivo com painel administrativo, Supabase, múltiplas imagens, usuários, disponibilidade dos imóveis, métricas, mapa com pino e rota pelo Google Maps.

## Principal mudança da V4

Toda a personalização do front-end foi centralizada em **`config.js`**. Não existe mais uma tela de Configurações dentro do painel administrativo.

Para trocar imobiliária, logo, cores, telefone, WhatsApp, Instagram, dados do Supabase, limites de imagens, tipos de imóveis ou parâmetros do mapa, edite somente:

```text
config.js
```

## Estrutura para GitHub / Netlify

```text
prime-lar-pro-v4/
├── index.html
├── admin.html
├── config.js
├── shared.js
├── app.js
├── admin.js
├── styles.css
├── schema.sql
├── netlify.toml
├── README.md
├── .gitignore
├── assets/
│   └── logo-prime-lar.png
└── supabase/
    ├── config.toml
    └── functions/
        ├── create-user/
        │   └── index.ts
        └── manage-user/
            └── index.ts
```

## 1. Configure o `config.js`

Preencha principalmente:

```js
supabase: {
  url: "https://SEU-PROJETO.supabase.co",
  publishableKey: "sb_publishable_SUA_CHAVE_PUBLICA",
  propertyImagesBucket: "property-images",
  createUserFunction: "create-user",
  manageUserFunction: "manage-user"
}
```

A chave `sb_publishable_...` pode estar no navegador e em um repositório público. **Nunca** coloque `sb_secret_...` nem `service_role` no `config.js`.

Também configure nome, logo, cores, WhatsApp e Instagram no mesmo arquivo.

## 2. Banco de dados

No Supabase, abra **SQL Editor** e execute todo o arquivo:

```text
schema.sql
```

O script pode ser executado sobre a versão anterior e adiciona, entre outras coisas:

- `latitude` e `longitude` nos imóveis;
- status do usuário (`enabled`);
- geração segura do código automático;
- RLS para imóveis e usuários;
- bucket `property-images` e políticas de upload;
- função de métricas.

A tabela antiga `site_settings`, caso exista, pode permanecer no banco, mas a V4 não a utiliza mais. A configuração agora vem exclusivamente do `config.js`.

## 3. Primeiro administrador

Se ainda não houver um administrador:

1. Supabase → **Authentication → Users** → crie o primeiro usuário.
2. O trigger cria o perfil em `public.profiles`.
3. No SQL Editor, execute:

```sql
update public.profiles
set role = 'admin', enabled = true
where email = 'SEU_EMAIL@EXEMPLO.COM';
```

## 4. Edge Functions de usuários

O Netlify publica o site, mas **não publica as Edge Functions do Supabase**.

As duas funções já estão no repositório:

```text
supabase/functions/create-user/index.ts
supabase/functions/manage-user/index.ts
```

### Opção A — Supabase CLI

Na raiz do projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy create-user
npx supabase functions deploy manage-user
```

Depois confirme em **Supabase → Edge Functions** que aparecem:

```text
create-user
manage-user
```

### Opção B — painel do Supabase

Crie cada função em **Edge Functions → Deploy a new function → Via Editor** e cole o conteúdo do respectivo `index.ts`.

As operações administrativas (`createUser`, `updateUserById` e `deleteUser`) ficam na Edge Function. A chave administrativa nunca é enviada ao navegador.

## 5. Localização do imóvel

A V4 não usa mais um iframe comum do Google Maps.

No cadastro do imóvel existem os campos:

```text
Latitude
Longitude
```

Para obter:

1. Abra o endereço no Google Maps.
2. Clique com o botão direito exatamente no ponto do imóvel.
3. Clique nas coordenadas para copiá-las.
4. Cole latitude e longitude no painel.

O site exibe o ponto com **OpenStreetMap + Leaflet** e oferece **Traçar rota no Google Maps**.

## 6. Correções incluídas

- menu lateral do admin refeito no mobile;
- removido conflito entre `nav` do site público e menu administrativo;
- backdrop para fechar o menu mobile;
- layout do painel adaptado para telas pequenas;
- configurações duplicadas removidas do painel;
- tratamento mais claro quando uma Edge Function não foi publicada;
- usuários locais criados no modo demo agora também podem fazer login;
- correção da mensagem de reativação/desativação de usuários;
- validação de quantidade e tamanho das imagens;
- localização sem erro `www.google.com recusou a conexão`;
- pino no mapa e rota externa;
- status do imóvel continua independente de “Exibir no site”;
- proteção contra excluir/desabilitar a própria conta;
- ícones SVG do WhatsApp e Instagram;
- `config.js` sem cache no Netlify para facilitar alterações.

## 7. Publicar no GitHub

Na pasta do projeto:

```bash
git init
git add .
git commit -m "Prime Lar Pro V4"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Se o repositório já existir, não repita `git init`/`remote add`; apenas substitua os arquivos, faça commit e push.

## 8. Publicar no Netlify pelo GitHub

1. Netlify → **Add new project**.
2. Escolha **Import an existing project**.
3. Selecione GitHub e o repositório.
4. Build command: deixe vazio.
5. Publish directory: `.`
6. Clique em **Deploy**.

O arquivo `netlify.toml` já define o diretório de publicação e alguns headers de segurança.

## 9. Testar localmente

Evite abrir `index.html` apenas com duplo clique. Rode um servidor local:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
http://localhost:8000/admin.html
```

## Modo demonstração

Se o Supabase ainda não estiver configurado, o sistema pode funcionar localmente com os usuários definidos em `config.js`.

O modo demo nunca é usado como fallback quando o Supabase está configurado; isso evita que uma falha do banco abra um acesso de demonstração em produção.
