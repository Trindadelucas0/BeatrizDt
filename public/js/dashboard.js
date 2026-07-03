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

  function isMobileLayout() {
    const mobile = document.querySelector('.sheet-table-mobile');
    if (!mobile) {
      return false;
    }

    return window.getComputedStyle(mobile).display !== 'none';
  }

  function isInActiveLayout(element) {
    const inDesktop = element.closest('.sheet-table-desktop');
    const inMobile = element.closest('.sheet-table-mobile');

    if (!inDesktop && !inMobile) {
      return true;
    }

    return isMobileLayout() ? Boolean(inMobile) : Boolean(inDesktop);
  }

  function syncMirroredField(source) {
    const groupIndex = source.dataset.groupIndex;
    const companyIndex = source.dataset.companyIndex;
    const field = source.dataset.field;

    if (!field || groupIndex === undefined || companyIndex === undefined) {
      return;
    }

    document.querySelectorAll(`[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"][data-field="${field}"]`).forEach((element) => {
      if (element !== source) {
        element.value = source.value;
      }
    });
  }

  function setSaveStatus(message, type = 'info') {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
    saveStatus.dataset.status = type;
  }

  function readMetadataFromForm(record) {
    document.querySelectorAll('.js-metadata-source').forEach((element) => {
      const field = element.dataset.field;
      if (!field) {
        return;
      }

      record[field] = element.value;
    });
  }

  function readRecordFromForm() {
    const nextRecord = clone(state.record);
    nextRecord.competencia = competenciaInput ? competenciaInput.value.trim() : state.record.competencia;

    document.querySelectorAll('[data-group-index][data-company-index][data-field]').forEach((element) => {
      if (!isInActiveLayout(element)) {
        return;
      }

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

    readMetadataFromForm(nextRecord);

    return nextRecord;
  }

  function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = formatCurrency(value);
    }
  }

  function updateTotals(record) {
    const includeDecimoLeft = isDecemberCompetencia(record.competencia);
    let grandDarf = 0;
    let grandFgts = 0;

    record.groups.forEach((group, groupIndex) => {
      let groupDarf = 0;
      let groupFgts = 0;

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
        const totalGeral = Number((totalLeft + totalRight).toFixed(2));

        company.totalLeft = totalLeft;
        company.totalRight = totalRight;

        groupDarf = Number((groupDarf + totalLeft).toFixed(2));
        groupFgts = Number((groupFgts + totalRight).toFixed(2));

        const darfCell = document.querySelector(`.js-line-darf[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`);
        const fgtsCell = document.querySelector(`.js-line-fgts[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`);
        const geralCell = document.querySelector(`.js-line-geral[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`);

        if (darfCell) darfCell.textContent = formatCurrency(totalLeft);
        if (fgtsCell) fgtsCell.textContent = formatCurrency(totalRight);
        if (geralCell) geralCell.textContent = formatCurrency(totalGeral);
      });

      grandDarf = Number((grandDarf + groupDarf).toFixed(2));
      grandFgts = Number((grandFgts + groupFgts).toFixed(2));

      const guiaDarf = document.querySelector(`.js-guia-darf[data-group-index="${groupIndex}"]`);
      const guiaFgts = document.querySelector(`.js-guia-fgts[data-group-index="${groupIndex}"]`);
      if (guiaDarf) guiaDarf.textContent = formatCurrency(groupDarf);
      if (guiaFgts) guiaFgts.textContent = formatCurrency(groupFgts);

      if (!group.summary) {
        group.summary = {};
      }
      group.summary.totalLeft = groupDarf;
      group.summary.totalRight = groupFgts;
    });

    setTextContent('sumDarf', grandDarf);
    setTextContent('sumFgts', grandFgts);
    setTextContent('sumGeral', Number((grandDarf + grandFgts).toFixed(2)));
    setTextContent('total-guia-darf', grandDarf);
    setTextContent('total-guia-fgts', grandFgts);

    record.grandTotals = {
      totalLeft: grandDarf,
      totalRight: grandFgts,
    };

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
      syncMirroredField(input);
      refresh();
      markDirty();
    });
    input.addEventListener('blur', () => {
      input.value = formatCurrency(input.value);
      syncMirroredField(input);
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

  document.querySelectorAll('.js-metadata-source').forEach((input) => {
    input.addEventListener('input', () => {
      refresh();
      markDirty();
    });
    input.addEventListener('change', () => {
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
