# Prime Lar Pro V2

Versão atualizada mantendo o mesmo layout e acrescentando:

- ícone oficial do WhatsApp em SVG;
- acesso administrativo discreto no rodapé;
- banco de dados Supabase para imóveis, configurações e perfis de usuários;
- criação real de administradores e corretores por função segura;
- código automático no formato `IMV-00001`;
- upload de várias imagens por anúncio;
- seleção de disponibilidade: Disponível, Alugado, Vendido ou Reservado;
- alteração rápida da disponibilidade na tela **Imóveis**;
- modo local para demonstração quando o Supabase ainda não estiver configurado.

## Testar sem Supabase

Abra `index.html` para o site e `admin.html` para o painel.

Acessos locais:

- Administrador: `admin@demo.com` / `admin123`
- Corretor: `corretor@demo.com` / `corretor123`

No modo local, os dados continuam presos ao navegador. Para aparecerem em todos os aparelhos, configure o Supabase.

## Configurar o banco de dados

1. Crie um projeto em Supabase.
2. No menu **SQL Editor**, execute todo o arquivo `schema.sql`.
3. Vá a **Authentication > Users** e crie seu primeiro usuário.
4. O gatilho do banco criará o perfil automaticamente como corretor.
5. No SQL Editor, transforme esse primeiro usuário em administrador:

```sql
update public.profiles
set role = 'admin'
where email = 'seu-email@exemplo.com';
```

6. Abra **Project Settings > API** e copie:
   - Project URL;
   - chave pública `anon`.
7. Edite `supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_CHAVE_ANON",
  storageBucket: "property-images",
  createUserFunction: "create-user"
};
```

## Publicar a função de criação de usuários

A criação de usuários precisa da chave administrativa, portanto é executada em uma Supabase Edge Function, nunca no navegador.

Instale a CLI do Supabase e faça login:

```bash
npm install -g supabase
supabase login
```

Dentro da pasta do projeto:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy create-user
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizadas automaticamente no ambiente das funções hospedadas pelo Supabase.

Depois disso, o administrador poderá criar corretores e outros administradores diretamente pela aba **Usuários**.

## Como funcionam os códigos

O código não é digitado manualmente. O banco usa uma sequência e cria automaticamente:

- `IMV-00001`
- `IMV-00002`
- `IMV-00003`

Assim não existem códigos repetidos, mesmo que dois corretores cadastrem imóveis quase ao mesmo tempo.

## Imagens

O campo de imagens aceita múltiplos arquivos. A primeira foto será a capa. No modo Supabase, as imagens são enviadas ao bucket público `property-images`.

## Disponibilidade

- **Disponível:** botão de contato liberado;
- **Reservado:** anúncio permanece visível, mas sinalizado;
- **Alugado:** anúncio permanece visível com a identificação de alugado;
- **Vendido:** anúncio permanece visível com a identificação de vendido;
- **Exibir no site:** controla se o anúncio aparece ou fica completamente oculto.

Na aba **Imóveis**, a disponibilidade pode ser alterada diretamente no seletor de cada anúncio.

## Publicação do site

Você pode publicar a pasta no Netlify. Depois de configurar o Supabase, todos os aparelhos consultarão o mesmo banco de dados.

Não publique a chave `service_role` no Netlify, no GitHub ou em qualquer JavaScript do site. Ela deve existir somente no ambiente seguro da Edge Function.