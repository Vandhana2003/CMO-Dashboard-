const XLSX = require('xlsx')  
const { normalizeKey, SYSTEM_PARAMETERS, getParametersForType } = require('./formulas');   

const SYSTEM_PARAM_SYNONYMS = {
  'revenue': ['sales revenue', 'total revenue', 'revenue total', 'revenue amount', 'net revenue', 'channel revenue'],
  'marketing cost': ['marketing spend', 'total marketing cost', 'marketing expense', 'ad spend', 'ads cost'], 
  'channel revenue': ['channel sales', 'channel income'],
  'channel cost': ['channel spend', 'channel expense'],
  'sales cost': ['cost of sales', 'sales expense', 'selling cost'],
  'number of new customers': ['new customers', 'new customer count', 'customers acquired'],
  'leads': ['lead count', 'total leads'],
  'cogs': ['cost of goods sold', 'cost of goods', 'cogs cost'],
  'total customers': ['customers total', 'customer count'],
  'total orders': ['orders total', 'order count'],
}; 

function words(str) {
  return normalizeKey(str).split(' ').filter(Boolean);
}

function hasStrongWordMatch(header, param) {
  const headerWords = words(header);
  const paramWords = words(param);
  if (paramWords.length === 0 || headerWords.length === 0) return false;
  return paramWords.every(word => headerWords.includes(word)) || headerWords.every(word => paramWords.includes(word));
}

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
 * For each system parameter (filtered by dataType), find the best matching Excel column.
 * Returns one mapping entry per system parameter.
 * @param {string[]} excelHeaders - column names from the Excel file
 * @param {string} [dataType] - 'b2b' or 'b2c' (if omitted, maps all params)
 */
function autoMapColumns(excelHeaders, dataType) {
  const params = dataType ? getParametersForType(dataType) : SYSTEM_PARAMETERS;
  const normalizedHeaders = excelHeaders.map(h => ({ original: h, normalized: normalizeKey(h) }));
  const usedHeaders = new Set();
  const mappings = [];

  for (const sysParam of params) {
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
        h.normalized.length > 2
      );
      if (partial) {
        bestMatch = partial.original;
        matchStatus = 'auto';
        usedHeaders.add(partial.original);
      } else {
        // Pass 3: synonym match
        const synonyms = SYSTEM_PARAM_SYNONYMS[nsp] || [];
        const synonymMatch = normalizedHeaders.find(h =>
          !usedHeaders.has(h.original) &&
          synonyms.some(syn => h.normalized.includes(syn) || syn.includes(h.normalized))
        );
        if (synonymMatch) {
          bestMatch = synonymMatch.original;
          matchStatus = 'auto';
          usedHeaders.add(synonymMatch.original);
        } else {
          // Pass 4: strong word overlap
          const wordMatch = normalizedHeaders.find(h =>
            !usedHeaders.has(h.original) &&
            hasStrongWordMatch(h.normalized, nsp) &&
            h.normalized.length > 2
          );
          if (wordMatch) {
            bestMatch = wordMatch.original;
            matchStatus = 'auto';
            usedHeaders.add(wordMatch.original);
          }
        }
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
 * Apply column mappings to raw rows → produce mapped rows with system parameter keys.
 * Supports extra_columns: additional Excel columns whose values are summed into the
 * same system parameter.
 */
function applyMappings(rows, mappings) {
  // Build reverse lookup: excel_column → system_parameter
  const colMap = {};
  // Build extra columns lookup: system_parameter → [extra excel cols]
  const extraMap = {};

  for (const m of mappings) {
    const excelCol = m.excel_column || m.source_column; // support legacy format
    const sysParam = m.system_parameter;
    if (excelCol && sysParam && m.match_status !== 'unmapped' && m.match_status !== 'missing') {
      colMap[excelCol] = sysParam;
    }
    // Handle extra columns
    if (sysParam && m.extra_columns && Array.isArray(m.extra_columns) && m.extra_columns.length > 0) {
      extraMap[sysParam] = m.extra_columns;
    }
  }

  return rows.map(row => {
    const mapped = {};
    for (const [key, val] of Object.entries(row)) {
      const sysParam = colMap[key] || key;
      mapped[sysParam] = val;
    }
    // Sum extra columns into their system parameter
    for (const [sysParam, extraCols] of Object.entries(extraMap)) {
      let base = parseFloat(mapped[sysParam] || 0);
      if (isNaN(base)) base = 0;
      for (const ec of extraCols) {
        const extraVal = parseFloat(row[ec] || 0);
        if (!isNaN(extraVal)) {
          base += extraVal;
        }
      }
      mapped[sysParam] = base;
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
  const autoMapped = mappings.filter(m => m.match_status === 'auto' && m.match_status !== 'missing');
  const manualMapped = mappings.filter(m => m.match_status === 'manual' && m.match_status !== 'missing');

  if (unmapped.length > 0) {
    issues.push({ level: 'warning', message: `${unmapped.length} system parameter(s) not mapped: ${unmapped.map(m => m.system_parameter).join(', ')}` });
  }

  const requiredParams = ['Revenue', 'Leads', 'Marketing cost', 'Channel Revenue'];
  for (const rp of requiredParams) {
    const found = mapped.some(m => normalizeKey(m.system_parameter) === normalizeKey(rp));
    if (!found) {
      issues.push({ level: 'error', message: `Required parameter "${rp}" is not mapped.` });
    }
  }

  return {
    valid: issues.filter(i => i.level === 'error').length === 0,
    mapped_count: mapped.length,
    auto_count: autoMapped.length,
    manual_count: manualMapped.length,
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
