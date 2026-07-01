const fs = require('node:fs/promises');
const path = require('node:path');
const { toCompetenciaSlug } = require('./calculationService');

function getHistoryDir() {
  return process.env.HISTORY_DIR || path.join(process.cwd(), 'data', 'history');
}

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
  const historyPath = path.join(getHistoryDir(), `${toCompetenciaSlug(competencia)}.json`);

  try {
    const raw = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return { competencia, revisions: [] };
  }
}

async function appendRevision(nextRecord, previousRecord, updatedBy) {
  const historyDir = getHistoryDir();
  await fs.mkdir(historyDir, { recursive: true });

  const history = await readHistory(nextRecord.competencia);
  const revision = {
    revision: history.revisions.length + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
    competencia: nextRecord.competencia,
    summary: buildDiffSummary(previousRecord, nextRecord),
  };

  history.competencia = nextRecord.competencia;
  history.revisions.push(revision);

  const historyPath = path.join(historyDir, `${toCompetenciaSlug(nextRecord.competencia)}.json`);
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

  return revision;
}

async function listRevisions(competencia) {
  const history = await readHistory(competencia);
  return history.revisions || [];
}

module.exports = {
  appendRevision,
  buildDiffSummary,
  listRevisions,
  readHistory,
};
