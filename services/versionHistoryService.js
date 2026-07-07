const { getStorage } = require('./storage');

function buildDiffSummary(previousRecord, nextRecord) {
  if (!previousRecord) {
    return 'Registro criado';
  }

  const changes = [];

  if (previousRecord.competencia !== nextRecord.competencia) {
    changes.push(`competencia: ${previousRecord.competencia} -> ${nextRecord.competencia}`);
  }

  const prevGroups = previousRecord.groups || [];
  const nextGroups = nextRecord.groups || [];

  nextGroups.forEach((group, groupIndex) => {
    const prevGroup = prevGroups[groupIndex];
    if (!prevGroup) {
      return;
    }

    group.companies.forEach((company, companyIndex) => {
      const prevCompany = prevGroup.companies?.[companyIndex];
      if (!prevCompany) {
        return;
      }

      ['inss', 'irrf', 'emprestimoConsignado', 'fgtsMensal', 'fgtsDecimoTerceiro'].forEach((field) => {
        if (Number(prevCompany[field] ?? 0) !== Number(company[field] ?? 0)) {
          changes.push(`${company.name || company.code}.${field}`);
        }
      });
    });
  });

  if (changes.length === 0) {
    return 'Sem alteracoes de valores';
  }

  return changes.slice(0, 8).join(', ');
}

async function readHistory(competencia) {
  return getStorage().readHistory(competencia);
}

async function listRevisions(competencia) {
  const history = await readHistory(competencia);
  return history.revisions || [];
}

module.exports = {
  buildDiffSummary,
  listRevisions,
  readHistory,
};
