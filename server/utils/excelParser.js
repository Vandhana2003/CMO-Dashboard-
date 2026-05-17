const XLSX = require('xlsx');
const { normalizeKey, SYSTEM_PARAMETERS } = require('./formulas');

/**
 * Parse an Excel file buffer into an array of row objects
 */
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return { rows, sheetNames: workbook.SheetNames, headers: rows.length > 0 ? Object.keys(rows[0]) : [] };
}

/**
 * Merge headers from multiple files into one unique list
 */
function mergeHeaders(existingHeaders, newHeaders) {
  const set = new Set(existingHeaders);
  for (const h of newHeaders) {
    set.add(h);
  }
  return [...set];
}

/**
 * System-first auto-mapping:
 * For each SYSTEM_PARAMETER, find the best matching Excel column from the given headers.
 * Returns one mapping entry per system parameter.
 */
function autoMapColumns(excelHeaders) {
  const normalizedHeaders = excelHeaders.map(h => ({ original: h, normalized: normalizeKey(h) }));
  const usedHeaders = new Set();
  const mappings = [];

  for (const sysParam of SYSTEM_PARAMETERS) {
    const nsp = normalizeKey(sysParam);
    let bestMatch = null;
    let matchStatus = 'missing';

    // Pass 1: exact normalized match
    const exact = normalizedHeaders.find(h => h.normalized === nsp && !usedHeaders.has(h.original));
    if (exact) {
      bestMatch = exact.original;
      matchStatus = 'auto';
      usedHeaders.add(exact.original);
    } else {
      // Pass 2: fuzzy — header contains param or param contains header
      const partial = normalizedHeaders.find(h =>
        !usedHeaders.has(h.original) &&
        (h.normalized.includes(nsp) || nsp.includes(h.normalized)) &&
        h.normalized.length > 2 // avoid matching tiny substrings
      );
      if (partial) {
        bestMatch = partial.original;
        matchStatus = 'auto';
        usedHeaders.add(partial.original);
      }
    }

    mappings.push({
      system_parameter: sysParam,
      excel_column: bestMatch,
      match_status: matchStatus
    });
  }

  return mappings;
}

/**
 * Apply column mappings to raw rows → produce mapped rows with system parameter keys
 */
function applyMappings(rows, mappings) {
  // Build reverse lookup: excel_column → system_parameter
  const colMap = {};
  for (const m of mappings) {
    const excelCol = m.excel_column || m.source_column; // support legacy format
    const sysParam = m.system_parameter;
    if (excelCol && sysParam && m.match_status !== 'unmapped' && m.match_status !== 'missing') {
      colMap[excelCol] = sysParam;
    }
  }

  return rows.map(row => {
    const mapped = {};
    for (const [key, val] of Object.entries(row)) {
      const sysParam = colMap[key] || key;
      mapped[sysParam] = val;
    }
    return mapped;
  });
}

/**
 * Validate that all required parameters are mapped
 */
function validateMappings(mappings) {
  const issues = [];
  const mapped = mappings.filter(m => m.match_status !== 'unmapped' && m.match_status !== 'missing');
  const unmapped = mappings.filter(m => m.match_status === 'unmapped' || m.match_status === 'missing');

  if (unmapped.length > 0) {
    issues.push({ level: 'warning', message: `${unmapped.length} system parameter(s) not mapped: ${unmapped.map(m => m.system_parameter).join(', ')}` });
  }

  const requiredParams = ['Revenue', 'Leads', 'Total Marketing Cost', 'Channel revenue'];
  for (const rp of requiredParams) {
    const found = mapped.some(m => normalizeKey(m.system_parameter) === normalizeKey(rp));
    if (!found) {
      issues.push({ level: 'error', message: `Required parameter "${rp}" is not mapped.` });
    }
  }

  return {
    valid: issues.filter(i => i.level === 'error').length === 0,
    mapped_count: mapped.length,
    missing_count: unmapped.length,
    total_count: mappings.length,
    issues
  };
}

/**
 * Generate a mapped Excel file buffer for download
 */
function generateMappedExcel(rows, mappings) {
  const mappedRows = applyMappings(rows, mappings);
  const ws = XLSX.utils.json_to_sheet(mappedRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mapped Data');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { parseExcel, mergeHeaders, autoMapColumns, applyMappings, validateMappings, generateMappedExcel };
