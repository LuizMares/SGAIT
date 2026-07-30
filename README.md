# SGAIT - Sistema de Gestão de Autos de Infração de Trânsito

Aplicação web completa desenvolvida com React, TypeScript, Express e Supabase.

---

## 🔒 Solução para Problemas de Git Push (Google Auth & Segredos)

Se o GitHub recusar o `git push` devido a **"Secret Scanning"** ou chaves expostas:

1. **Nunca envie arquivos `.env` reais ao GitHub**:
   - O arquivo `.gitignore` já está configurado para ignorar arquivos `.env`, `.env.local` e o banco local `sgait_server_data.json`.
   - Se por acaso você criou um arquivo `.env` e ele foi adicionado no staging, remova-o com:
     ```bash
     git rm --cached .env .env.local sgait_server_data.json 2>/dev/null || true
     ```

2. **Chaves do Google Auth / Supabase**:
   - As chaves reais do Google OAuth (Client ID e Client Secret) **devem ser cadastradas diretamente no Dashboard do Supabase** em **Auth → Providers → Google**, e **nunca colocadas hardcoded no código ou no Git**.
   - No arquivo `.env.example`, mantemos apenas placeholders genéricos (ex: `your-google-client-secret`).

3. **Como Resolver se o Git Bloquear o Push**:
   ```bash
   # Resetar arquivos sensíveis e aplicar o .gitignore atualizado
   git rm -r --cached .
   git add .
   git commit -m "fix: sanitizar segredos e preparar para push"
   git push -u origin main
   ```

---

## 🚀 Como Fazer Push para o GitHub (Manual)

Se você já possui um repositório no GitHub ou vai criar um novo, execute os seguintes comandos no terminal do seu computador (na pasta do projeto):

```bash
# 1. Inicializar o Git (se ainda não iniciado)
git init

# 2. Adicionar os arquivos ao staging
git add .

# 3. Criar o commit inicial
git commit -m "feat: versão inicial SGAIT com sincronização automática Supabase"

# 4. Conectar ao repositório remoto do GitHub
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# 5. Definir a branch principal e enviar os arquivos
git branch -M main
git push -u origin main
```

---

## 🚂 Implantação 100% no Railway

O SGAIT está completamente otimizado para o **Railway** com o arquivo `railway.json`, detecção automática de Node.js via Nixpacks, suporte à porta dinâmica (`$PORT`) e build integrado Express + React (Vite).

### Passos de Implantação no Railway:
1. Faça o `git push` do projeto para o seu repositório no GitHub.
2. Acesse [railway.app](https://railway.app) e clique em **New Project** → **Deploy from GitHub repo**.
3. Selecione o repositório do **SGAIT**.
4. Em **Variables** (Variáveis de Ambiente), adicione:
   - `VITE_SUPABASE_URL` = `https://seu-projeto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sua-chave-anon-do-supabase`
   - `GEMINI_API_KEY` = `sua-chave-gemini` *(opcional)*
5. O Railway lerá o `railway.json`, executará `npm run build` e subirá a aplicação em segundos com `npm start`.

---

## 🗄️ Banco de Dados (Supabase SQL)

Antes do primeiro uso, execute o script `setup.sql` no **SQL Editor** do Supabase para criar as 4 tabelas (`sgait_autos`, `sgait_infractions_table` com as 411 infrações do CTB, `sgait_authorized_emails` e `sgait_profiles`).

---

## 🛠️ Comandos Locais

- **Desenvolvimento local:** `npm run dev`
- **Build de produção:** `npm run build`
- **Executar versão final:** `npm start`
- **Verificar erros de código:** `npm run lint`
