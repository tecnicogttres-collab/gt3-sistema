# GT3 Sistema — Prompt Inicial para Claude Code (v3 — completo)

Cole este arquivo inteiro no Claude Code no primeiro dia.
Ele descreve todos os módulos já construídos e os que ainda virão.

---

## 1. Sobre a empresa

**GT3 Consultoria** — empresa especializada em gestão de documentação,
compliance e SST para empresas terceirizadas (eSocial, PGR, PCMSO, ASO, EPI,
FGTS, etc.). A equipe usa o sistema diariamente para consultar informações,
enviar comunicações e acompanhar o desenvolvimento dos colaboradores.

---

## 2. Stack tecnológica

- **Framework:** Next.js 14+ com App Router
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Banco de dados:** Supabase (PostgreSQL + autenticação)
- **Deploy:** Vercel

---

## 3. Identidade visual

### Paleta de cores
```
primary:  #2A4F96  → botões principais, headers, links
accent:   #D1AE6E  → destaques, números, calls-to-action
dark:     #1E253D  → fundo principal
sidebar:  #1A2036  → sidebar
cards:    #2A3552  → painéis e cards
```

### Cores dos módulos (dots na sidebar e abas)
```
Dashboard:          #D1AE6E  (accent)
Observações:        #D4AF37  (amarelo)
Cadastro contrat.:  #8C6EDC  (roxo)
E-mails padrão:     #40C8B4  (turquesa)
Manuais:            #5DA8FF  (azul claro)
Home Office:        #F97B6B  (salmão)
Controle Revisão:   #96D25A  (verde)
Atas terça:         #C8A0E6  (lilás)
PDI:                #2A4F96  com borda #D1AE6E
```

### Regras
- `primary` → botões, links, bordas ativas
- `accent` → badges, destaques, ícone da logo
- `dark/sidebar` → fundos
- Sempre `accent` sobre `dark` para máximo contraste

---

## 4. Layout base (todas as páginas)

### Sidebar
- 220px recolhível para 60px via botão `‹` / `›`
- Fundo `#1A2036`, logo "G3" dourada + "GT3 Sistema"
- Item ativo: `rgba(42,79,150,0.35)` + borda esquerda `#D1AE6E`
- Rodapé: avatar iniciais + nome + papel do usuário

### Tab Bar (estilo Chrome/Edge)
- Abas com dot colorido + label + `×` para fechar
- Aba Dashboard fixa (sem `×`)
- Clicar em módulo abre nova aba ou ativa existente — nunca duplica

### Top Bar
- Breadcrumb: "Visão: **Papel** · **Módulo**"
- Pill: dot accent + papel ("Colaborador", "Gestor", "RH", "Admin")

---

## 5. Papéis de usuário

### Colaborador
- Observações (leitura + copiar)
- E-mails Padrão (baixar .eml)
- Manuais (leitura)
- PDI próprio (leitura + autoavaliação + comentários)
- Cadastro Contratantes (somente leitura)

### Gestor
- Tudo do Colaborador +
- Home Office (gerenciar equipe)
- Controle de Revisão (gerenciar escala)
- PDI de todos da equipe (leitura + comentários "Gestor")
- Cadastro Contratantes (edição)

### RH / DHO
- Tudo do Gestor +
- Criar/editar PDIs
- Avaliação diretiva editável

### Admin
- Acesso total + configurações + usuários

---

## 6. Módulos do sistema (10 no total)

---

### 6.1 Dashboard
Cards de todos os módulos disponíveis para o papel do usuário.
PDI aparece em card maior (largura total) na parte inferior.

---

### 6.2 Observações
**Categorias (tabs laterais na sidebar interna):**
- Funcionários ✅
- Empresas ✅
- PGR & PCMSO & LTCAT ✅
- Contratantes ✅
- BSA ✅

**Comportamentos:**
- Sidebar interna com categorias editáveis (rename + reorder com ▲▼)
- Cada categoria tem sub-tabs (ex: "Ficha Registro + ASO", "EPI")
- Observações em cards: tag + texto
- Clique no card = copia só o texto
- Feedback: verde 1.4s + toast "Copiado"
- Busca no topo filtra por tag ou texto
- Observações editáveis e reordenáveis por quem tem permissão

---

### 6.3 Cadastro de Contratantes
- Tabela com busca: Empresa | Autorização | Contato | Atualização
- Clique na linha abre a ficha
- Fichas com campos livres: texto simples ou tabela aninhada
- Clique no valor = copiar | duplo clique = editar inline
- Rótulo sempre editável
- Setas ▲▼ reordenam campos, ✕ exclui
- Botões: "+ Campo simples", "+ Tabela", "Renomear", "Excluir"
- Modal "Nova contratante" com nome → cria com 4 campos padrão

---

### 6.4 E-mails Padrão
- Lista vertical de cards
- Botão "📧 Abrir no Outlook" → baixa `.eml` multipart (`X-Unsent: 1`)
- Botão "▾ Pré-visualizar" expande card com HTML renderizado
- Botão secundário "⧉ Copiar texto"
- Busca por cliente, assunto, categoria ou corpo
- Banner explicando o fluxo do .eml no topo

---

### 6.5 Manuais
**Categorias de documentos:**
- Funcionários (Foto 3x4, Ficha Registro, ASO, EPI, etc.)
- NRs (tabela com normas regulamentadoras, periodicidade, origem)
- Empresas
- Veículos
- Alimentar
- BSA

**Comportamentos:**
- Sidebar interna com as categorias
- Cada documento tem seções (ex: "Verificação", "Observações")
- Cada seção tem itens (lista de critérios de análise)
- Tudo editável inline (contenteditable)
- Periodicidade como pill colorida (Anual, Única, Bienal, Condicional)
- Persiste em localStorage (ou Supabase na versão definitiva)
- Botões: "+ Seção", "+ Item", reordenar, excluir

---

### 6.6 Controle de Home Office
**Funcionalidades:**
- Tabela mensal com linha por dia útil (ignora fins de semana e feriados)
- Colunas: Data | Dia | [uma coluna por colaborador]
- Cada célula: dropdown com opções (Presencial / Home Office / Férias / Licença / etc.)
- Colaboradores padrão: Marcio Z, Luciane, Rodrigo Balem
- Adicionar/remover colaboradores
- Duas views: "Mês vigente" (editável) e "Histórico" (read-only)
- Arquivamento automático: ao virar o mês, o atual vai para o histórico
- Persiste em localStorage (ou Supabase na versão definitiva)
- Navegação no histórico por ano/mês

---

### 6.7 Controle de Revisão
**Funcionalidades:**
- Registro de inconsistências em documentos por mês
- Tabela de revisões: Data | Documento | Empresa | Responsável | Inconsistência | Resolvido
- Escala diária de revisores: tabela com os dias do mês × revisores
- Busca nas revisões registradas
- Duas views: "Mês vigente" (editável) e "Histórico" (read-only)
- Arquivamento automático mensal
- Colaboradores padrão: Marcio Z, Luciane, Rodrigo Balem, Camila
- Persiste em localStorage (ou Supabase)

---

### 6.8 Atas Terça-feira
*(a desenvolver)*
- Hierarquia: Ano > Mês > Data
- Status: Rascunho → Aguardando Validação → Validada
- Permissões: Gestor+ valida/edita; todos visualizam; não-gestores comentam

---

### 6.9 Caixinha de Sugestões
*(a desenvolver)*
- Envio anônimo de sugestões
- Gestores visualizam e gerenciam

---

### 6.10 PDI (Plano de Desenvolvimento Individual)
**Colaboradores com PDI existente:**
- Natália Fumagali Chaxim (Auxiliar Administrativo)
- Marina Magnaguagno Zanella (Analista de Serviços)

**Abas por PDI:**
1. Plano de Ações
2. Avaliações PDI (matriz + radar)
3. Eneagrama (perfil comportamental)
4. MBTI (análise de perfil)
5. Conclusões

**Comportamentos na visão Colaborador:**
- Leitura de tudo
- Autoavaliação: campo "Resultados Alcançados" editável por ação
- Status de cada ação editável: Não iniciado / Em andamento / Em evolução / Concluído
- % de progresso calculado automaticamente
- Comentários por seção: thread com badge de papel (Colaborador/Gestor/RH)

**Permissões:**
- Colaborador: lê + autoavalia + comenta
- Gestor/RH: edita avaliação diretiva e ambição realista + comenta

---

## 7. Estrutura de pastas

```
gt3-sistema/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     ← Dashboard
│   ├── observacoes/page.tsx
│   ├── cadastro-contratantes/page.tsx
│   ├── emails-padrao/page.tsx
│   ├── manuais/page.tsx
│   ├── home-office/page.tsx
│   ├── controle-revisao/page.tsx
│   ├── atas/page.tsx
│   └── pdi/
│       ├── page.tsx
│       └── [id]/page.tsx
├── components/
│   ├── layout/ (Sidebar, TabBar, TopBar)
│   ├── ui/ (Badge, Toast, Modal, SearchInput, EmptyState)
│   └── modules/
│       ├── observacoes/
│       ├── cadastro/
│       ├── emails/
│       ├── manuais/
│       ├── home-office/
│       ├── revisao/
│       └── pdi/
├── lib/ (supabase.ts, tipos.ts, utils.ts)
├── data/ (dados hardcoded iniciais)
├── PROMPT_INICIAL.md
├── DADOS_MODULOS.md
└── README.md
```

---

## 8. Banco de dados Supabase

```sql
create table profiles (
  id uuid references auth.users primary key,
  nome text, papel text, gestor_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table observacoes (
  id uuid primary key default gen_random_uuid(),
  categoria text, sub_categoria text, tag text, texto text, ordem int
);

create table contratantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, updated_at timestamptz default now()
);
create table contratante_campos (
  id uuid primary key default gen_random_uuid(),
  contratante_id uuid references contratantes(id) on delete cascade,
  tipo text, rotulo text, valor text, tabela_dados jsonb, ordem int
);

create table emails_padrao (
  id uuid primary key default gen_random_uuid(),
  cliente text, categoria text, assunto text, body_html text,
  ativo boolean default true, ordem int
);

create table manuais_itens (
  id uuid primary key default gen_random_uuid(),
  categoria text, documento_id text, documento_nome text,
  periodicidade text, secao text, item text, ordem int
);

create table home_office (
  id uuid primary key default gen_random_uuid(),
  ano int, mes int, colaborador text, dia int, status text
);

create table controle_revisao (
  id uuid primary key default gen_random_uuid(),
  ano int, mes int, data date, documento text, empresa text,
  responsavel text, inconsistencia text, resolvido boolean default false
);
create table revisao_escala (
  id uuid primary key default gen_random_uuid(),
  ano int, mes int, dia int, revisor text
);

create table pdis (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references profiles(id),
  periodo_inicio date, periodo_fim date, ciclo text
);
create table pdi_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  pdi_id uuid references pdis(id) on delete cascade,
  tipo text, competencia text, nota int
);
create table pdi_acoes (
  id uuid primary key default gen_random_uuid(),
  pdi_id uuid references pdis(id) on delete cascade,
  competencia text, desenvolver text, acoes text,
  resultados_esperados text, resultados_alcancados text,
  status text default 'pending', data_inicio date, data_termino date, ordem int
);
create table pdi_comentarios (
  id uuid primary key default gen_random_uuid(),
  pdi_id uuid references pdis(id) on delete cascade,
  secao text, autor_id uuid references profiles(id),
  texto text, created_at timestamptz default now()
);
```

---

## 9. Ordem de implementação recomendada

1. Estrutura base (layout, sidebar, tabbar, topbar, tema)
2. Dashboard
3. Observações (dados hardcoded → depois Supabase)
4. Cadastro Contratantes (primeiro módulo com Supabase)
5. E-mails Padrão (lógica .eml)
6. Manuais
7. Home Office
8. Controle de Revisão
9. PDI (autenticação + permissões por papel)
10. Atas, Caixinha de Sugestões

---

## 10. Comandos úteis

```bash
npm run dev                           # servidor local
claude                                # Claude Code
git add . && git commit -m "msg"      # salvar
git revert HEAD                       # desfazer último commit
vercel --prod                         # deploy
```
