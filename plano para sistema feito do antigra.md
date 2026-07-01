# Plano — Menu Hamburguer com Competências por Ano

## O que será feito

Adicionar um **sidebar deslizante** (drawer lateral) acionado por um botão **☰ hamburguer** no header. Dentro do sidebar, as competências ficam organizadas em **grupos por ano** (2026, 2027, 2028), cada um expansível em accordion, exibindo os 12 meses com badge de status — exatamente como no esboço da imagem.

---

## Estrutura visual do Sidebar

```
┌─────────────────────────────┐
│  ✕  Demonstrativo de        │
│     Impostos                │
│─────────────────────────────│
│  ▼ 2026  ← expandido        │
│    01/2026  ● Concluído     │
│    02/2026  ● Concluído     │
│    ...                      │
│    12/2026  ○ Rascunho      │
│─────────────────────────────│
│  ▶ 2027                     │
│  ▶ 2028                     │
└─────────────────────────────┘
```

---

## Análise do código atual

### Como competências são geradas hoje
- `competenciaSeedService.js` exporta `buildCompetenciaList(year)` → gera array `['01/2026', '02/2026', ...]` para 1 único ano
- `server.js` passa para a view: `competencias` (array de strings) e `competenciaStatusMap` (objeto `{MM/AAAA: {status, percent, statusLabel}}`)
- `DEFAULT_SEED_YEAR = 2026` — apenas 2026 está semeado no banco

### O que precisa mudar no servidor
Para mostrar 3 anos no sidebar, o servidor precisa passar:
- `sidebarYears`: array de anos `[2026, 2027, 2028]`
- `buildCompetenciaList` já existe e aceita qualquer ano — será chamada no template para cada ano do sidebar

---

## Decisões de Design

| Decisão | Justificativa |
|---|---|
| Sidebar desliza da esquerda (slide-in) | Padrão UX de navigation drawer (Material, Apple HIG) |
| Overlay escuro ao abrir | Foca o usuário no menu, indica contexto modal |
| Accordion por ano, auto-expande o ano ativo | Não esconde o contexto atual do usuário |
| Toolbar de pills atual **removida** | Redundante com o sidebar — libera espaço vertical |
| Botão hamburguer no header (canto esquerdo) | Posição padrão universalmente reconhecida |
| Anos 2027/2028 mostram "Em breve" ou meses clicáveis | Servidor já lida com anos futuros retornando o mais recente |
| Animação suave 250ms | Feedback visual de qualidade premium |

---

## Arquivos a alterar

> [!IMPORTANT]
> Nenhuma lógica de negócio será tocada. `dashboard.js`, serviços e rotas permanecem intactos.

---

### 1. `server.js`
#### [MODIFY] [server.js](file:///c:/Users/trind/Desktop/BEATRIZ/sistema%20-%20TRAE/server.js)

Adicionar `sidebarYears` na chamada `res.render('dashboard', {...})` dentro de `renderDashboard()`:

```js
// Apenas adicionar esta linha ao objeto passado para render:
sidebarYears: [DEFAULT_SEED_YEAR, DEFAULT_SEED_YEAR + 1, DEFAULT_SEED_YEAR + 2],
```

Isso não altera nenhuma lógica — apenas expõe os anos disponíveis para a view.

---

### 2. `app.css`
#### [MODIFY] [app.css](file:///c:/Users/trind/Desktop/BEATRIZ/sistema%20-%20TRAE/public/css/app.css)

Adicionar ao final do arquivo os estilos do sidebar:
- `.hamburger-btn` — botão no header
- `.sidebar-overlay` — fundo escuro clicável
- `.sidebar-drawer` — painel lateral deslizante
- `.sidebar-nav-year` — grupo de ano (accordion header)
- `.sidebar-nav-months` — lista de meses (accordion body)
- `.sidebar-nav-month` — item de mês individual
- Animações `slide-in` / `slide-out`

---

### 3. `header.ejs`
#### [MODIFY] [header.ejs](file:///c:/Users/trind/Desktop/BEATRIZ/sistema%20-%20TRAE/views/partials/header.ejs)

Adicionar o botão hamburguer **antes** do bloco `.header-brand`:

```html
<button id="hamburger-btn" class="hamburger-btn" aria-label="Abrir menu de navegação" aria-expanded="false" aria-controls="sidebar-drawer">
  <span></span><span></span><span></span>
</button>
```

---

### 4. `dashboard.ejs`
#### [MODIFY] [dashboard.ejs](file:///c:/Users/trind/Desktop/BEATRIZ/sistema%20-%20TRAE/views/dashboard.ejs)

- **Remover** o include da `competencias-toolbar` (substituída pelo sidebar)
- **Adicionar** antes do `<main>`:
  - Overlay: `<div id="sidebar-overlay" class="sidebar-overlay"></div>`
  - Sidebar drawer com estrutura de anos/meses usando EJS loop

```ejs
<!-- Para cada ano em sidebarYears -->
<% sidebarYears.forEach(year => { %>
  <% const meses = buildCompetenciaList(year); %> <!-- função já disponível em app.locals -->
  <!-- Accordion do ano -->
  <details class="sidebar-nav-year" <%= year === currentYear ? 'open' : '' %>>
    <summary><%= year %></summary>
    <% meses.forEach(mes => { %>
      <% const st = competenciaStatusMap[mes] || { status: 'rascunho', statusLabel: 'Rascunho' }; %>
      <a href="/dashboard/<%= helpers.toCompetenciaSlug(mes) %>"
         class="sidebar-nav-month <%= mes === record.competencia ? 'sidebar-nav-month--active' : '' %>">
        <span><%= mes %></span>
        <span class="status-badge status-badge--<%= st.status %>"><%= st.statusLabel %></span>
      </a>
    <% }) %>
  </details>
<% }) %>
```

---

### 5. `public/js/sidebar.js` *(novo arquivo)*
#### [NEW] [sidebar.js](file:///c:/Users/trind/Desktop/BEATRIZ/sistema%20-%20TRAE/public/js/sidebar.js)

JavaScript puro (sem dependências) para:
- Abrir/fechar sidebar ao clicar no hamburguer
- Fechar ao clicar no overlay
- Fechar com tecla `Escape`
- Gerenciar `aria-expanded` e `aria-hidden` para acessibilidade
- Animar hamburguer → ✕ quando aberto

---

### 6. `competencias-toolbar.ejs`
#### A toolbar de pills será **removida do dashboard** (include removido)

O arquivo em si não é deletado — fica preservado no diretório. Apenas o `include` no `dashboard.ejs` é removido.

---

## Fluxo de navegação

```
Usuário clica ☰  →  Sidebar abre (overlay escuro)
                 →  Ano ativo já expandido
                 →  Usuário clica num mês
                 →  Navega para /dashboard/MM-AAAA
                 →  Sidebar fecha automaticamente
```

---

## O que NÃO muda

- `dashboard.js` — zero alterações (lógica de cálculo, autosave, totais)
- `server.js` (routes, lógica) — apenas uma linha adicionada no render
- `services/` — zero alterações
- Todos os `id`, `name`, `data-*` nos inputs — intactos

---

## Verificação

- Abrir e fechar sidebar em desktop e mobile
- Verificar que o ano da competência ativa está expandido ao abrir
- Clicar em cada mês de 2026 e confirmar navegação correta
- Clicar em mês de 2027/2028 (retorna competência mais recente — comportamento esperado)
- Verificar acessibilidade: `Escape` fecha, `aria-expanded` correto
