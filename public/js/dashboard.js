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

  function countCompanies(record) {
    return record.groups.reduce((total, group) => total + group.companies.length, 0);
  }

  function createEmptyCompany(groupId) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      id: `${groupId}-custom-${suffix}`,
      code: `N${String(Date.now()).slice(-4)}`,
      name: 'Nova empresa',
      cnpj: '',
      inss: 0,
      irrf: 0,
      inssDecimoTerceiro: 0,
      irrfDecimoTerceiro: 0,
      emprestimoConsignado: 0,
      fgtsMensal: 0,
      fgtsDecimoTerceiro: 0,
      totalLeft: 0,
      totalRight: 0,
    };
  }

  function setIndexedAttributes(element, groupIndex, companyIndex) {
    element.dataset.groupIndex = String(groupIndex);
    element.dataset.companyIndex = String(companyIndex);

    element.querySelectorAll('[data-group-index][data-company-index]').forEach((child) => {
      child.dataset.groupIndex = String(groupIndex);
      child.dataset.companyIndex = String(companyIndex);
    });
  }

  function clearRowValues(row) {
    row.querySelectorAll('input').forEach((input) => {
      if (input.classList.contains('js-currency-source')) {
        input.value = formatCurrency(0);
        return;
      }

      if (input.dataset.field === 'name') {
        input.value = 'Nova empresa';
        return;
      }

      input.value = '';
    });

    row.querySelectorAll('.js-line-darf, .js-line-fgts, .js-line-geral').forEach((cell) => {
      cell.textContent = formatCurrency(0);
    });
  }

  function bindCurrencyInput(input) {
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
  }

  function bindTextInput(input) {
    input.addEventListener('input', () => {
      syncMirroredField(input);
      refresh();
      markDirty();
    });
  }

  function bindCnpjInput(input) {
    input.addEventListener('blur', () => {
      input.value = formatCnpj(input.value);
      syncMirroredField(input);
      refresh();
      markDirty();
    });
  }

  function bindSheetInput(input) {
    if (input.dataset.sheetBound === 'true') {
      return;
    }

    input.dataset.sheetBound = 'true';

    if (input.classList.contains('js-currency-source')) {
      bindCurrencyInput(input);
      return;
    }

    if (input.classList.contains('js-cnpj-source')) {
      bindCnpjInput(input);
    }

    if (input.classList.contains('js-text-source')) {
      bindTextInput(input);
    }
  }

  function bindSheetRow(row) {
    row.querySelectorAll('input').forEach(bindSheetInput);
  }

  function syncStateRecord(record) {
    state.record = clone(record);
  }

  function reindexAllSheetDom(record) {
    const rows = [...document.querySelectorAll('.sheet-table-desktop .js-sheet-row')];
    const cards = [...document.querySelectorAll('.mobile-company-card')];
    let pointer = 0;

    record.groups.forEach((group, groupIndex) => {
      group.companies.forEach((company, companyIndex) => {
        if (rows[pointer]) {
          setIndexedAttributes(rows[pointer], groupIndex, companyIndex);
        }
        if (cards[pointer]) {
          setIndexedAttributes(cards[pointer], groupIndex, companyIndex);
        }
        pointer += 1;
      });
    });
  }

  function addSheetRow() {
    const record = updateTotals(readRecordFromForm());
    const lastGroupIndex = record.groups.length - 1;
    const lastGroup = record.groups[lastGroupIndex];
    const companyIndex = lastGroup.companies.length;
    lastGroup.companies.push(createEmptyCompany(lastGroup.id));

    const desktopBody = document.querySelector('.sheet-table-desktop tbody');
    const templateRow = desktopBody?.querySelector('.js-sheet-row');
    const mobileList = document.querySelector('.mobile-company-list');
    const templateCard = mobileList?.querySelector('.mobile-company-card');

    if (templateRow) {
      const newRow = templateRow.cloneNode(true);
      clearRowValues(newRow);
      setIndexedAttributes(newRow, lastGroupIndex, companyIndex);
      desktopBody.appendChild(newRow);
      bindSheetRow(newRow);
    }

    if (templateCard) {
      const newCard = templateCard.cloneNode(true);
      clearRowValues(newCard);
      setIndexedAttributes(newCard, lastGroupIndex, companyIndex);
      const headerStrong = newCard.querySelector('.mobile-company-card__header strong');
      const headerSpan = newCard.querySelector('.mobile-company-card__header span');
      if (headerStrong) headerStrong.textContent = 'Nova empresa';
      if (headerSpan) headerSpan.textContent = `${lastGroup.label} ·`;
      mobileList.appendChild(newCard);
      bindSheetRow(newCard);
    }

    syncStateRecord(record);
    refresh();
    markDirty();
  }

  function removeSheetRow(groupIndex, companyIndex) {
    const record = updateTotals(readRecordFromForm());

    if (countCompanies(record) <= 1) {
      showToast('É necessário manter pelo menos uma linha no lançamento.');
      return;
    }

    const group = record.groups[groupIndex];
    if (!group || !group.companies[companyIndex]) {
      return;
    }

    group.companies.splice(companyIndex, 1);

    document.querySelectorAll(`.js-sheet-row[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`).forEach((row) => {
      row.remove();
    });

    document.querySelectorAll(`.mobile-company-card[data-group-index="${groupIndex}"][data-company-index="${companyIndex}"]`).forEach((card) => {
      card.remove();
    });

    reindexAllSheetDom(record);
    syncStateRecord(record);
    refresh();
    markDirty();
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

  const addRowButton = document.querySelector('.js-sheet-add-row');
  if (addRowButton && !state.isReadOnly) {
    addRowButton.addEventListener('click', addSheetRow);
  }

  document.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.js-sheet-remove-row');
    if (!removeButton || state.isReadOnly) {
      return;
    }

    const groupIndex = Number(removeButton.dataset.groupIndex);
    const companyIndex = Number(removeButton.dataset.companyIndex);
    removeSheetRow(groupIndex, companyIndex);
  });

  document.querySelectorAll('.js-currency-source').forEach((input) => {
    input.value = formatCurrency(input.value);
  });

  document.querySelectorAll('.js-cnpj-source').forEach((input) => {
    input.value = formatCnpj(input.value);
  });

  refresh();
}());
