(function bootstrapDashboard() {
  const state = window.__DASHBOARD_STATE__;
  if (!state) {
    return;
  }

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const form = document.getElementById('sheet-form');
  const payloadInput = document.getElementById('payload-input');
  const competenciaInput = document.getElementById('competencia-input');
  const saveStatus = document.getElementById('save-status');
  const numberFields = new Set(['inss', 'irrf', 'inssDecimoTerceiro', 'irrfDecimoTerceiro', 'emprestimoConsignado', 'fgtsMensal', 'fgtsDecimoTerceiro']);

  let isDirty = false;
  let autoSaveTimer = null;
  let isSaving = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseCurrency(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value || '')
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();

    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(parseCurrency(value));
  }

  function sanitizeCnpj(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCnpj(value) {
    const digits = sanitizeCnpj(value);

    if (digits.length === 14) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }

    return digits;
  }

  function isDecemberCompetencia(competencia) {
    return /^12\/\d{4}$/.test(String(competencia || '').trim());
  }

  function getCompetenciaSlug() {
    const competencia = competenciaInput ? competenciaInput.value.trim() : state.record.competencia;
    return competencia.replace('/', '-');
  }

  function setSaveStatus(message, type = 'info') {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
    saveStatus.dataset.status = type;
  }

  function normalizeGroupStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'concluido' || normalized === 'concluído') {
      return 'concluido';
    }
    return 'em_processo';
  }

  function syncStatusChecksUI(container, value) {
    const normalized = normalizeGroupStatus(value);
    container.dataset.currentValue = normalized;

    container.querySelectorAll('.status-check').forEach((label) => {
      const input = label.querySelector('input[type="radio"]');
      const isActive = input && input.value === normalized;
      label.classList.toggle('status-check--checked', isActive);
      if (input) {
        input.checked = isActive;
      }
    });
  }

  function readGroupStatusFromForm(record) {
    document.querySelectorAll('.js-status-checks').forEach((container) => {
      const groupIndex = Number(container.dataset.groupIndex);
      const field = container.dataset.field;
      const group = record.groups[groupIndex];
      const checked = container.querySelector('input[type="radio"]:checked');

      if (!group || !field) {
        return;
      }

      group[field] = normalizeGroupStatus(checked?.value || container.dataset.currentValue);
    });
  }

  function readRecordFromForm() {
    const nextRecord = clone(state.record);
    nextRecord.competencia = competenciaInput ? competenciaInput.value.trim() : state.record.competencia;

    document.querySelectorAll('[data-group-index][data-company-index][data-field]').forEach((element) => {
      const group = nextRecord.groups[Number(element.dataset.groupIndex)];
      const company = group?.companies?.[Number(element.dataset.companyIndex)];
      const field = element.dataset.field;

      if (!company || !field) {
        return;
      }

      if (field === 'cnpj') {
        company[field] = sanitizeCnpj(element.value);
        return;
      }

      company[field] = numberFields.has(field) ? parseCurrency(element.value) : element.value.trim();
    });

    readGroupStatusFromForm(nextRecord);

    return nextRecord;
  }

  function updateGroupSummaryField(groupIndex, field, value) {
    document.querySelectorAll(`[data-group-index="${groupIndex}"][data-summary-field="${field}"]`).forEach((element) => {
      element.textContent = formatCurrency(value);
    });
  }

  function updateTotals(record) {
    const includeDecimoLeft = isDecemberCompetencia(record.competencia);

    record.groups.forEach((group, groupIndex) => {
      let groupLeft = 0;
      let groupRight = 0;
      let groupInss = 0;
      let groupIrrf = 0;
      let groupInssDecimo = 0;
      let groupIrrfDecimo = 0;
      let groupFgtsMensal = 0;
      let groupFgtsDecimo = 0;

      group.statusLeft = normalizeGroupStatus(group.statusLeft);
      group.statusRight = normalizeGroupStatus(group.statusRight);

      group.companies.forEach((company, companyIndex) => {
        company.inss = parseCurrency(company.inss);
        company.irrf = parseCurrency(company.irrf);
        company.inssDecimoTerceiro = parseCurrency(company.inssDecimoTerceiro);
        company.irrfDecimoTerceiro = parseCurrency(company.irrfDecimoTerceiro);
        company.emprestimoConsignado = parseCurrency(company.emprestimoConsignado);
        company.fgtsMensal = parseCurrency(company.fgtsMensal);
        company.fgtsDecimoTerceiro = parseCurrency(company.fgtsDecimoTerceiro);

        const totalLeft = includeDecimoLeft
          ? Number((company.inss + company.irrf + company.inssDecimoTerceiro + company.irrfDecimoTerceiro).toFixed(2))
          : Number((company.inss + company.irrf).toFixed(2));
        const totalRight = Number((company.emprestimoConsignado + company.fgtsMensal + company.fgtsDecimoTerceiro).toFixed(2));

        groupLeft = Number((groupLeft + totalLeft).toFixed(2));
        groupRight = Number((groupRight + totalRight).toFixed(2));
        groupInss = Number((groupInss + company.inss).toFixed(2));
        groupIrrf = Number((groupIrrf + company.irrf).toFixed(2));
        groupInssDecimo = Number((groupInssDecimo + company.inssDecimoTerceiro).toFixed(2));
        groupIrrfDecimo = Number((groupIrrfDecimo + company.irrfDecimoTerceiro).toFixed(2));
        groupFgtsMensal = Number((groupFgtsMensal + company.fgtsMensal).toFixed(2));
        groupFgtsDecimo = Number((groupFgtsDecimo + company.fgtsDecimoTerceiro).toFixed(2));

        const leftCell = document.querySelector(`.js-left-line-total[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`);
        const rightCell = document.querySelector(`.js-right-line-total[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`);

        if (leftCell) leftCell.textContent = formatCurrency(totalLeft);
        if (rightCell) rightCell.textContent = formatCurrency(totalRight);
      });

      const leftGroupCell = document.querySelector(`.js-left-group-total[data-group-index="${groupIndex}"]`);
      const rightGroupCell = document.querySelector(`.js-right-group-total[data-group-index="${groupIndex}"]`);

      if (leftGroupCell) leftGroupCell.textContent = formatCurrency(groupLeft);
      if (rightGroupCell) rightGroupCell.textContent = formatCurrency(groupRight);

      updateGroupSummaryField(groupIndex, 'totalLeft', groupLeft);
      updateGroupSummaryField(groupIndex, 'totalRight', groupRight);
      updateGroupSummaryField(groupIndex, 'inss', groupInss);
      updateGroupSummaryField(groupIndex, 'fgtsDecimoTerceiro', groupFgtsDecimo);
      updateGroupSummaryField(groupIndex, 'fgtsMensal', groupFgtsMensal);
      updateGroupSummaryField(groupIndex, 'fgtsGeral', Number((groupFgtsMensal + groupFgtsDecimo).toFixed(2)));

      if (includeDecimoLeft) {
        updateGroupSummaryField(groupIndex, 'inssDecimoTerceiro', groupInssDecimo);
        updateGroupSummaryField(groupIndex, 'irrfDecimoTerceiro', groupIrrfDecimo);
      }
    });

    return record;
  }

  function refresh() {
    const nextRecord = readRecordFromForm();
    const calculatedRecord = updateTotals(nextRecord);
    if (payloadInput) {
      payloadInput.value = JSON.stringify(calculatedRecord);
    }
    return calculatedRecord;
  }

  function syncMirroredField(sourceInput) {
    const selector = `[data-group-index="${sourceInput.dataset.groupIndex}"][data-company-index="${sourceInput.dataset.companyIndex}"][data-field="${sourceInput.dataset.field}"]`;
    document.querySelectorAll(selector).forEach((input) => {
      if (input !== sourceInput) {
        input.value = sourceInput.value;
      }
    });
  }

  function markDirty() {
    if (state.isReadOnly) {
      return;
    }

    isDirty = true;
    setSaveStatus('Alteracoes nao salvas', 'warning');
    scheduleAutoSave();
  }

  async function autoSave() {
    if (state.isReadOnly || isSaving) {
      return;
    }

    const competencia = competenciaInput ? competenciaInput.value.trim() : '';
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(competencia)) {
      return;
    }

    const payload = refresh();
    isSaving = true;
    setSaveStatus('Salvando automaticamente...', 'info');

    try {
      const response = await fetch(`/api/competencias/${getCompetenciaSlug()}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao salvar');
      }

      isDirty = false;
      const savedAt = new Date(result.updatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSaveStatus(`Salvo automaticamente as ${savedAt}`, 'success');
    } catch (error) {
      setSaveStatus(error.message || 'Erro ao salvar automaticamente', 'error');
    } finally {
      isSaving = false;
    }
  }

  function scheduleAutoSave() {
    if (state.isReadOnly) {
      return;
    }

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(autoSave, 2000);
  }

  function showToast(message) {
    const toast = document.getElementById('app-toast');
    if (!toast) {
      window.alert(message);
      return;
    }

    toast.textContent = message;
    toast.hidden = false;
    setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  document.querySelectorAll('.js-currency-source').forEach((input) => {
    input.addEventListener('input', () => {
      refresh();
      markDirty();
    });
    input.addEventListener('blur', () => {
      input.value = formatCurrency(input.value);
      refresh();
      markDirty();
    });
    input.addEventListener('focus', () => {
      input.value = input.value.replace(/[R$\s]/g, '');
    });
  });

  document.querySelectorAll('.js-text-source').forEach((input) => {
    input.addEventListener('input', () => {
      syncMirroredField(input);
      refresh();
      markDirty();
    });
  });

  document.querySelectorAll('.js-cnpj-source').forEach((input) => {
    input.addEventListener('blur', () => {
      input.value = formatCnpj(input.value);
      syncMirroredField(input);
      refresh();
      markDirty();
    });
  });

  if (competenciaInput) {
    competenciaInput.addEventListener('input', () => {
      refresh();
      markDirty();
    });
  }

  document.querySelectorAll('.js-status-checks').forEach((container) => {
    syncStatusChecksUI(container, container.dataset.currentValue);

    container.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (state.isReadOnly) {
          return;
        }

        syncStatusChecksUI(container, input.value);
        refresh();
        markDirty();
      });
    });
  });

  if (form) {
    form.addEventListener('submit', (event) => {
      const competencia = competenciaInput ? competenciaInput.value.trim() : '';
      if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(competencia)) {
        event.preventDefault();
        showToast('A competencia deve estar no formato MM/AAAA.');
        return;
      }

      refresh();
      isDirty = false;
    });
  }

  window.addEventListener('beforeunload', (event) => {
    if (isDirty && !state.isReadOnly) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  document.querySelectorAll('.js-currency-source').forEach((input) => {
    input.value = formatCurrency(input.value);
  });

  document.querySelectorAll('.js-cnpj-source').forEach((input) => {
    input.value = formatCnpj(input.value);
  });

  refresh();
}());
