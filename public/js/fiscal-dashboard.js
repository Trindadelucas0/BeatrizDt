(function bootstrapFiscalDashboard() {
  const state = window.__FISCAL_DASHBOARD_STATE__;
  if (!state) {
    return;
  }

  const TAX_FIELDS = state.taxFields || [];
  const form = document.getElementById('fiscal-sheet-form');
  const payloadInput = document.getElementById('payload-input');
  const competenciaInput = document.getElementById('competencia-input');
  const saveStatus = document.getElementById('save-status');
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  let workingRecord = clone(state.record);
  let isDirty = false;
  let autoSaveTimer = null;
  let isSaving = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseCellValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }

    const text = String(value).trim();
    if (!text || text === '-' || text.toUpperCase() === 'R$ -') {
      return null;
    }

    const upper = text.toUpperCase();
    if (upper === 'SALDO CREDOR') {
      return upper;
    }

    if (/[a-zA-Z]/.test(text) && !/^R\$/i.test(text)) {
      return upper;
    }

    const normalized = text
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  }

  function formatCell(value) {
    if (value === null || value === undefined || value === '') {
      return 'R$ -';
    }

    if (typeof value === 'string') {
      return value;
    }

    return currencyFormatter.format(value);
  }

  function calculateTotals(rows) {
    const totals = {};
    TAX_FIELDS.forEach((field) => {
      totals[field] = 0;
    });

    (rows || []).forEach((row) => {
      TAX_FIELDS.forEach((field) => {
        const value = row[field];
        if (typeof value === 'number' && Number.isFinite(value)) {
          totals[field] = Number((totals[field] + value).toFixed(2));
        }
      });
    });

    return totals;
  }

  function setSaveStatus(message, type) {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
    saveStatus.dataset.status = type;
  }

  function getCompetenciaSlug() {
    const competencia = competenciaInput ? competenciaInput.value.trim() : workingRecord.competencia;
    return competencia.replace('/', '-');
  }

  function collectRecord() {
    const next = clone(workingRecord);
    next.competencia = competenciaInput ? competenciaInput.value.trim() : next.competencia;

    document.querySelectorAll('.js-fiscal-meta').forEach((input) => {
      const field = input.dataset.field;
      next[field] = input.value;
    });

    const desktopRows = Array.from(document.querySelectorAll('.fiscal-desktop tbody tr[data-row-id]'));
    const rows = desktopRows.map((node) => {
      const row = {
        id: node.dataset.rowId,
        dominio: '',
        sistemaDauto: '',
        local: '',
        empresa: '',
      };

      TAX_FIELDS.forEach((field) => {
        row[field] = null;
      });

      node.querySelectorAll('.js-fiscal-field').forEach((input) => {
        const field = input.dataset.field;
        if (TAX_FIELDS.includes(field)) {
          row[field] = parseCellValue(input.value);
        } else {
          row[field] = String(input.value || '').trim();
        }
      });

      return row;
    });

    next.rows = rows;
    next.totals = calculateTotals(rows);
    workingRecord = next;
    return next;
  }

  function refreshTotals() {
    const record = collectRecord();
    document.querySelectorAll('.js-fiscal-total').forEach((cell) => {
      const field = cell.dataset.field;
      cell.textContent = formatCell(record.totals?.[field] ?? 0);
    });

    if (payloadInput) {
      payloadInput.value = JSON.stringify(record);
    }

    return record;
  }

  function markDirty() {
    isDirty = true;
    setSaveStatus('Alterações não salvas', 'warn');
    scheduleAutosave();
  }

  function scheduleAutosave() {
    if (state.isReadOnly) {
      return;
    }

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autosave();
    }, 1200);
  }

  async function autosave() {
    if (state.isReadOnly || isSaving || !isDirty) {
      return;
    }

    isSaving = true;
    setSaveStatus('Salvando…', 'info');

    try {
      const payload = refreshTotals();
      const response = await fetch(`/api/fiscal/competencias/${getCompetenciaSlug()}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha no autosave');
      }

      isDirty = false;
      const savedAt = new Date(result.updatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSaveStatus(`Salvo automaticamente às ${savedAt}`, 'success');
    } catch (error) {
      setSaveStatus(error.message || 'Erro ao salvar automaticamente', 'error');
    } finally {
      isSaving = false;
    }
  }

  function createEmptyRow() {
    const row = {
      id: `row-custom-${Date.now()}`,
      dominio: '',
      sistemaDauto: '',
      local: '',
      empresa: '',
    };

    TAX_FIELDS.forEach((field) => {
      row[field] = null;
    });

    return row;
  }

  function buildTaxCellHtml(field) {
    return `<div class="fiscal-tax-cell">
      <input type="text" class="fiscal-input fiscal-input--tax js-fiscal-field" data-field="${field}" value="" placeholder="R$ -" />
      <button type="button" class="fiscal-saldo-btn js-fiscal-saldo-credor" title="Alternar SALDO CREDOR" aria-label="Alternar SALDO CREDOR">SC</button>
    </div>`;
  }

  function buildDesktopRowHtml(row) {
    const taxCells = TAX_FIELDS.map((field) => (
      `<td class="fiscal-table__tax">${buildTaxCellHtml(field)}</td>`
    )).join('');

    return `<tr data-row-index="0" data-row-id="${row.id}">
      <td><input type="text" class="fiscal-input js-fiscal-field" data-field="dominio" value="" /></td>
      <td><input type="text" class="fiscal-input js-fiscal-field" data-field="sistemaDauto" value="" /></td>
      <td><input type="text" class="fiscal-input js-fiscal-field" data-field="local" value="" /></td>
      <td><input type="text" class="fiscal-input js-fiscal-field" data-field="empresa" value="" required /></td>
      ${taxCells}
      <td class="fiscal-table__actions">
        <button type="button" class="sheet-row-btn sheet-row-btn--remove js-fiscal-remove-row" aria-label="Remover linha">Remover</button>
      </td>
    </tr>`;
  }

  function buildMobileCardHtml(row) {
    const taxFields = TAX_FIELDS.map((field) => (
      `<label>
        <span>${field}</span>
        ${buildTaxCellHtml(field)}
      </label>`
    )).join('');

    return `<article class="fiscal-mobile-card" data-row-index="0" data-row-id="${row.id}">
      <header class="fiscal-mobile-card__header">
        <strong>Nova empresa</strong>
        <button type="button" class="sheet-row-btn sheet-row-btn--remove js-fiscal-remove-row">Remover</button>
      </header>
      <div class="fiscal-mobile-card__grid">
        <label><span>Nº Domínio</span><input type="text" class="fiscal-input js-fiscal-field" data-field="dominio" value="" /></label>
        <label><span>Sistema Dauto</span><input type="text" class="fiscal-input js-fiscal-field" data-field="sistemaDauto" value="" /></label>
        <label><span>Local</span><input type="text" class="fiscal-input js-fiscal-field" data-field="local" value="" /></label>
        <label><span>Empresa</span><input type="text" class="fiscal-input js-fiscal-field" data-field="empresa" value="" /></label>
        ${taxFields}
      </div>
    </article>`;
  }

  form?.addEventListener('submit', () => {
    refreshTotals();
  });

  document.addEventListener('input', (event) => {
    if (!event.target.closest('.js-fiscal-field') && !event.target.closest('.js-fiscal-meta') && event.target !== competenciaInput) {
      return;
    }

    refreshTotals();
    markDirty();
  });

  document.addEventListener('click', (event) => {
    const saldoBtn = event.target.closest('.js-fiscal-saldo-credor');
    if (saldoBtn) {
      const cell = saldoBtn.closest('.fiscal-tax-cell');
      const input = cell && cell.querySelector('.js-fiscal-field');
      if (!input) {
        return;
      }

      const current = String(input.value || '').trim().toUpperCase();
      input.value = current === 'SALDO CREDOR' ? '' : 'SALDO CREDOR';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const addBtn = event.target.closest('.js-fiscal-add-row');
    if (addBtn) {
      const row = createEmptyRow();
      const tbody = document.querySelector('.fiscal-desktop tbody');
      const mobile = document.querySelector('.fiscal-mobile');

      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', buildDesktopRowHtml(row));
      }

      if (mobile) {
        mobile.insertAdjacentHTML('beforeend', buildMobileCardHtml(row));
      }

      refreshTotals();
      markDirty();
      return;
    }

    const removeBtn = event.target.closest('.js-fiscal-remove-row');
    if (!removeBtn) {
      return;
    }

    const rowNode = removeBtn.closest('[data-row-id]');
    if (!rowNode) {
      return;
    }

    const rowId = rowNode.dataset.rowId;
    document.querySelectorAll(`[data-row-id="${rowId}"]`).forEach((node) => node.remove());
    refreshTotals();
    markDirty();
  });

  refreshTotals();
})();
