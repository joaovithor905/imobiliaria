# Prime Lar Pro V3

Esta versão mantém o layout anterior e acrescenta:

- logotipo real no cabeçalho, rodapé, login e painel;
- upload do logotipo diretamente do computador;
- criação, edição, desativação, reativação e exclusão de usuários;
- alteração de nome, e-mail, perfil e senha dos usuários;
- proteção para o administrador não excluir ou desabilitar a própria conta;
- banco de dados para imóveis e corretores;
- múltiplas imagens por anúncio;
- código automático do imóvel;
- disponibilidade: Disponível, Alugado, Vendido ou Reservado.

## Testar sem Supabase

Abra `index.html` e `admin.html` por um servidor local.

Administrador:

```text
admin@demo.com
admin123
```

Corretor:

```text
corretor@demo.com
corretor123
```

No modo demonstração, os dados continuam armazenados apenas no navegador.

## Atualizar um projeto Supabase já existente

Abra o **SQL Editor** do Supabase e execute novamente o arquivo:

```text
schema.sql
```

Ele foi preparado para adicionar os campos novos sem apagar os imóveis existentes. O script cria:

- o campo `enabled` na tabela `profiles`;
- o bucket público `site-assets` para o logotipo;
- as políticas de acesso necessárias;
- as tabelas e políticas dos imóveis, usuários e configurações.

## Configurar o site

Edite apenas o arquivo `supabase-config.js`:

```javascript
window.SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "sb_publishable_SUA_CHAVE_PUBLICAVEL",
  storageBucket: "property-images",
  logoBucket: "site-assets",
  createUserFunction: "create-user",
  manageUserFunction: "manage-user"
};
```

Use somente a chave pública `sb_publishable_...`. Nunca coloque uma chave `sb_secret_...` ou `service_role` no navegador.

## Publicar as Edge Functions

Na pasta do projeto, faça login na CLI do Supabase e vincule o projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Publique as duas funções:

```bash
supabase functions deploy create-user
supabase functions deploy manage-user
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizadas pelo ambiente das Edge Functions. A chave administrativa permanece no servidor e não é colocada nos arquivos do site.

## Primeiro administrador

Crie o primeiro usuário em **Authentication → Users** no painel do Supabase. Depois, execute no SQL Editor:

```sql
update public.profiles
set role = 'admin', enabled = true
where email = 'SEU_EMAIL@EXEMPLO.COM';
```

Depois disso, esse administrador poderá criar e gerenciar os demais usuários pelo próprio site.

## Logotipo

O projeto já inclui o arquivo:

```text
assets/logo-prime-lar.png
```

No painel, entre em **Configurações → Logotipo da empresa** para escolher outro arquivo do computador. O arquivo será enviado ao bucket `site-assets` e aparecerá automaticamente no site.

Formatos recomendados:

- PNG com fundo transparente;
- SVG;
- WebP;
- JPEG.

Tamanho máximo configurado no site: 5 MB.

## Usuários

Na aba **Usuários**, o administrador pode:

- criar um usuário;
- editar nome, e-mail e perfil;
- definir uma nova senha;
- desabilitar o acesso durante férias ou afastamentos;
- reativar o acesso;
- excluir definitivamente o usuário.

Ao desabilitar um usuário no Supabase, a conta é bloqueada no sistema de autenticação e marcada como desabilitada na tabela `profiles`.

## Publicação no Netlify

Depois de configurar o Supabase e publicar as funções, envie todos os arquivos da pasta para o Netlify. Faça uma atualização forçada no navegador após o deploy:

```text
Ctrl + F5
```
