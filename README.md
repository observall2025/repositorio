# Repositorio de documentos

Aplicacao simples para subir documentos no Supabase Storage e gerar links publicos para usar em outra plataforma.

## Funcionalidades

- Login unico pelo Supabase Auth, restrito ao email admin configurado.
- Upload direto para Supabase Storage com URL assinada.
- Reducao de tamanho antes do upload para PDFs, documentos Office modernos e imagens, quando houver ganho seguro.
- Criacao automatica do bucket publico configurado.
- Listagem dos documentos enviados.
- Link curto de visualizacao pelo app e link publico direto do Supabase.
- Exclusao de arquivos para controlar o uso da cota.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no desenvolvimento e configure as mesmas variaveis no Vercel:

```bash
SUPABASE_URL=https://bizutoarmeazkwuqzzap.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=documents

ADMIN_EMAIL=admin@repo.com
SESSION_SECRET=um-segredo-grande-e-aleatorio

NEXT_PUBLIC_APP_URL=https://repositorioent.vercel.app
MAX_UPLOAD_MB=50
STORAGE_CAPACITY_MB=1024
```

Para gerar `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Configure as variaveis de ambiente acima.
3. Publique o projeto.

O bucket definido em `SUPABASE_BUCKET` sera criado automaticamente como publico no primeiro upload/listagem.

O arquivo nao passa pela Function da Vercel: o navegador tenta reduzir o tamanho localmente, o servidor gera uma URL assinada para o arquivo final e o navegador envia direto para o Supabase Storage.

Em PDFs, o app primeiro tenta uma compactacao estrutural sem perda. Se isso nao reduzir, ele tenta remontar as paginas como imagens JPEG em qualidade controlada e so usa esse resultado quando o arquivo final fica menor. Arquivos ja enviados nao sao alterados automaticamente: remova e envie novamente para aplicar a reducao.

Para o dominio de producao, mantenha `NEXT_PUBLIC_APP_URL=https://repositorioent.vercel.app` tambem nas variaveis de ambiente da Vercel e faca um novo deploy depois da troca.

Defina `STORAGE_CAPACITY_MB` com a capacidade total do armazenamento que deseja acompanhar no dashboard. O valor padrao e `1024`, equivalente a 1 GB.

Crie o usuario admin em Supabase > Authentication > Users e deixe `ADMIN_EMAIL` com o mesmo email.
