const { getStorage } = require('./storage');
const { TAX_FIELDS } = require('./fiscalSheetSchemaService');

function buildFiscalDiffSummary(previousRecord, nextRecord) {
  if (!previousRecord) {
    return 'Registro fiscal criado';
  }

  const changes = [];
  const prevRows = previousRecord.rows || [];
  const nextRows = nextRecord.rows || [];

  nextRows.forEach((row, index) => {
    const prevRow = prevRows[index];
    if (!prevRow) {
      changes.push(`${row.empresa || row.id}: linha nova`);
      return;
    }

    ['dominio', 'sistemaDauto', 'local', 'empresa', ...TAX_FIELDS].forEach((field) => {
      if (String(prevRow[field] ?? '') !== String(row[field] ?? '')) {
        changes.push(`${row.empresa || row.id}.${field}`);
      }
    });
  });

  if (changes.length === 0) {
    return 'Sem alteracoes de valores';
  }

  return changes.slice(0, 8).join(', ');
}

async function listFiscalRevisions(competencia) {
  const storage = getStorage();
  const history = await storage.readFiscalHistory(competencia);
  return history.revisions || [];
}

module.exports = {
  buildFiscalDiffSummary,
  listFiscalRevisions,
};
