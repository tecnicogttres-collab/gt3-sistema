# GT3 Sistema — Guia de Primeiros Passos (v3)

---

## Módulos existentes (10 no total)

| Módulo | Status | Arquivo HTML de referência |
|---|---|---|
| Dashboard | A construir | — |
| Observações | ✅ HTML pronto | GT3_Modulo_Observacoes.html |
| Cadastro Contratantes | ✅ HTML pronto | Modulo_cadastro_contratantes.html |
| E-mails Padrão | ✅ HTML pronto | email_templates_manager.html |
| Manuais | ✅ HTML pronto | gt3_manuais.html |
| Home Office | ✅ HTML pronto | controle-home-office-gt3.html |
| Controle de Revisão | ✅ HTML pronto | controle-revisao-gt3.html |
| PDI — Natália | ✅ HTML pronto | (desta conversa) |
| Atas Terça-feira | A construir | — |

---

## Estrutura de pastas

```
gt3-sistema/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       ← Dashboard
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
│   ├── ui/ (Badge, Toast, Modal, SearchInput)
│   └── modules/
│       ├── observacoes/
│       ├── cadastro/
│       ├── emails/
│       ├── manuais/
│       ├── home-office/
│       ├── revisao/
│       └── pdi/
├── lib/ (supabase.ts, tipos.ts, utils.ts)
├── data/
│   ├── observacoes.ts
│   ├── contratantes.ts
│   ├── emails.ts
│   └── manuais.ts
├── htmls-referencia/          ← cole os 7 HTMLs aqui como referência
│   ├── GT3_Modulo_Observacoes.html
│   ├── Modulo_cadastro_contratantes.html
│   ├── email_templates_manager.html
│   ├── gt3_manuais.html
│   ├── controle-home-office-gt3.html
│   └── controle-revisao-gt3.html
├── PROMPT_INICIAL.md
├── DADOS_MODULOS.md
└── README.md
```

---

## Primeiro uso

```bash
cd Desktop/gt3-sistema

# Copiar os arquivos do kit para a raiz do projeto:
# PROMPT_INICIAL.md, DADOS_MODULOS.md, README.md
# + criar pasta htmls-referencia/ e colar os 7 HTMLs lá

claude
```

Quando o Claude Code abrir, cole:

```
Leia os arquivos PROMPT_INICIAL.md e DADOS_MODULOS.md.
Também leia os HTMLs em htmls-referencia/ — eles são protótipos
funcionais de cada módulo que devem ser convertidos para Next.js.
Confirme que entendeu tudo e aguarde minha instrução.
```

---

## Fluxo de trabalho diário

```bash
# Terminal 1
npm run dev        # http://localhost:3000

# Terminal 2
claude

# Ao terminar
git add . && git commit -m "descrição do que foi feito"
```

---

## Prompts prontos por módulo

### Estrutura base
```
Crie a estrutura base do GT3 Sistema conforme PROMPT_INICIAL.md:
sidebar recolhível, tabbar estilo Chrome, topbar, tema de cores
no tailwind.config.ts. Dashboard com cards dos módulos.
```

### Observações (tem HTML de referência)
```
Converta htmls-referencia/GT3_Modulo_Observacoes.html para
Next.js em app/observacoes/page.tsx. Mantenha todos os
comportamentos: categorias editáveis na sidebar, sub-tabs,
cards clicáveis para copiar, busca, feedback visual.
Use o tema de cores do PROMPT_INICIAL.md.
```

### Cadastro Contratantes (tem HTML de referência)
```
Converta htmls-referencia/Modulo_cadastro_contratantes.html
para Next.js em app/cadastro-contratantes/page.tsx.
Dados iniciais em DADOS_MODULOS.md. Use Supabase para persistir.
```

### E-mails Padrão (tem HTML de referência)
```
Converta htmls-referencia/email_templates_manager.html para
Next.js em app/emails-padrao/page.tsx. Dados em DADOS_MODULOS.md.
Manter lógica de .eml com X-Unsent: 1.
```

### Manuais (tem HTML de referência)
```
Converta htmls-referencia/gt3_manuais.html para Next.js em
app/manuais/page.tsx. Manter: sidebar interna com categorias,
documentos com seções e itens editáveis, pills de periodicidade,
persistência (Supabase ou localStorage inicialmente).
```

### Home Office (tem HTML de referência)
```
Converta htmls-referencia/controle-home-office-gt3.html para
Next.js em app/home-office/page.tsx. Manter: tabela mensal
gerada automaticamente, dropdown por célula, views mês vigente
e histórico, arquivamento automático. Use Supabase para persistir.
```

### Controle de Revisão (tem HTML de referência)
```
Converta htmls-referencia/controle-revisao-gt3.html para Next.js
em app/controle-revisao/page.tsx. Manter: tabela de revisões,
escala diária, views mês vigente e histórico. Use Supabase.
```

### PDI (dois colaboradores)
```
Crie o módulo PDI em app/pdi/. A página principal lista os PDIs
disponíveis para o papel do usuário. app/pdi/[id]/page.tsx abre
o PDI individual. Dados de Natália e Marina em DADOS_MODULOS.md.
Use Supabase com RLS para separar por colaborador.
```

---

## Dica importante sobre os HTMLs de referência

Ao pedir ao Claude Code para converter um HTML, diga também:

```
Ao converter, mantenha todos os comportamentos interativos do HTML.
Adapte para o tema de cores do GT3 (dark #1E253D, primary #2A4F96,
accent #D1AE6E) conforme PROMPT_INICIAL.md. Integre ao layout
global (sidebar + tabbar + topbar) já existente no projeto.
```

---

## Se algo quebrar

```bash
git diff                          # ver o que mudou
git revert HEAD                   # desfazer último commit
git log --oneline                 # ver histórico
```

---

## Checklist por módulo

- [ ] Aparece na sidebar com dot colorido correto
- [ ] Abre em nova aba (cor correta, sem duplicar)
- [ ] Breadcrumb atualiza
- [ ] Funcionalidades do HTML original preservadas
- [ ] Tema de cores GT3 aplicado
- [ ] Não quebra outros módulos
- [ ] Commit feito
