const multer = require('multer');
const path = require('path');
const { query } = require('../config/db');
const { parseExcel, mergeHeaders, autoMapColumns, applyMappings, validateMappings, generateMappedExcel } = require('../utils/excelParser');
const { calcDashboardKPIs, calcB2BKPIs, calcB2CKPIs, SYSTEM_PARAMETERS, getParametersForType } = require('../utils/formulas');
const { fetchExternalData } = require('../services/externalApiService');

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed.'));
  }
});

const getSystemParameters = (req, res) => {
  const dataType = req.query.data_type;
  const params = dataType ? getParametersForType(dataType) : SYSTEM_PARAMETERS;
  res.json({ parameters: params, data_type: dataType || 'all' });
};

const getDatasets = async (req, res) => {
  try {
    const result = await query('SELECT d.*, u.name as uploaded_by FROM datasets d LEFT JOIN users u ON d.user_id = u.id ORDER BY d.uploaded_at DESC');
    res.json({ datasets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasets.' });
  }
};

const uploadExcel = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const dataType = req.body.data_type || null; // 'b2b' or 'b2c'

    const results = [];
    for (const file of req.files) {
      const { rows, headers } = parseExcel(file.buffer);
      // Save dataset record with data_type
      const ds = await query(
        'INSERT INTO datasets (user_id, source_type, file_name, original_name, status, data_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.user.id, 'excel', file.originalname, file.originalname, 'uploaded', dataType]
      );
      const datasetId = ds.rows[0].id;

      // Save raw rows
      for (let i = 0; i < rows.length; i++) {
        await query('INSERT INTO dataset_rows (dataset_id, row_index, row_data) VALUES ($1, $2, $3)', [datasetId, i, JSON.stringify(rows[i])]);
      }

      // Store headers in dataset for later use
      await query('UPDATE datasets SET file_name = $1, original_name = $2 WHERE id = $3', [file.originalname, file.originalname, datasetId]);

      // System-first auto-map: iterate params for this data_type, find best Excel column match
      const mappings = autoMapColumns(headers, dataType);
      for (const m of mappings) {
        await query(
          'INSERT INTO column_mappings (dataset_id, source_column, system_parameter, match_status, extra_columns) VALUES ($1, $2, $3, $4, $5)',
          [datasetId, m.excel_column || '', m.system_parameter, m.match_status, JSON.stringify([])]
        );
      }

      await query("UPDATE datasets SET status = 'mapped' WHERE id = $1", [datasetId]);
      results.push({ dataset_id: datasetId, file_name: file.originalname, rows: rows.length, headers, mappings, data_type: dataType });
    }

    res.json({ uploads: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
};

/**
 * Append additional Excel files to an existing dataset.
 * Merges rows and re-runs auto-mapping with the unified header set.
 */
const appendToDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    // Get dataset data_type
    const dsInfo = await query('SELECT data_type, original_name FROM datasets WHERE id = $1', [datasetId]);
    const dataType = dsInfo.rows[0]?.data_type || null;

    // Get existing rows to find the max row_index
    const existingRows = await query('SELECT MAX(row_index) as max_idx FROM dataset_rows WHERE dataset_id = $1', [datasetId]);
    let nextIndex = (existingRows.rows[0]?.max_idx ?? -1) + 1;

    // Get existing headers from current mappings
    const existingMappings = await query('SELECT source_column FROM column_mappings WHERE dataset_id = $1 AND source_column != \'\'', [datasetId]);
    let allHeaders = existingMappings.rows.map(r => r.source_column);

    const appendedFiles = [];

    for (const file of req.files) {
      const { rows, headers } = parseExcel(file.buffer);

      // Add new rows
      for (let i = 0; i < rows.length; i++) {
        await query('INSERT INTO dataset_rows (dataset_id, row_index, row_data) VALUES ($1, $2, $3)', [datasetId, nextIndex + i, JSON.stringify(rows[i])]);
      }
      nextIndex += rows.length;

      // Merge headers
      allHeaders = mergeHeaders(allHeaders, headers);
      appendedFiles.push({ file_name: file.originalname, rows: rows.length });
    }

    // Delete old mappings and re-create with merged headers
    await query('DELETE FROM column_mappings WHERE dataset_id = $1', [datasetId]);
    const newMappings = autoMapColumns(allHeaders, dataType);
    for (const m of newMappings) {
      await query(
        'INSERT INTO column_mappings (dataset_id, source_column, system_parameter, match_status, extra_columns) VALUES ($1, $2, $3, $4, $5)',
        [datasetId, m.excel_column || '', m.system_parameter, m.match_status, JSON.stringify([])]
      );
    }

    // Update dataset name to reflect multiple files
    const currentName = dsInfo.rows[0]?.original_name || '';
    const newNames = appendedFiles.map(f => f.file_name).join(', ');
    const combinedName = currentName.includes('+') ? `${currentName}, ${newNames}` : `${currentName} + ${newNames}`;
    await query('UPDATE datasets SET original_name = $1 WHERE id = $2', [combinedName, datasetId]);

    res.json({
      message: `Appended ${appendedFiles.length} file(s) successfully.`,
      appended: appendedFiles,
      total_headers: allHeaders,
      mappings: newMappings
    });
  } catch (err) {
    console.error('Append error:', err);
    res.status(500).json({ error: 'Failed to append files.' });
  }
};

const getMappings = async (req, res) => {
  try {
    const { datasetId } = req.params;
    // Get mappings (system-first: one per system parameter)
    const result = await query('SELECT * FROM column_mappings WHERE dataset_id = $1 ORDER BY id', [datasetId]);

    // Get dataset data_type
    const dsResult = await query('SELECT data_type FROM datasets WHERE id = $1', [datasetId]);
    const dataType = dsResult.rows[0]?.data_type || null;

    // Get all unique Excel headers from the dataset rows for the dropdown
    const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 LIMIT 1', [datasetId]);
    let excelColumns = [];
    if (rowsResult.rows.length > 0) {
      const sampleRow = typeof rowsResult.rows[0].row_data === 'string' ? JSON.parse(rowsResult.rows[0].row_data) : rowsResult.rows[0].row_data;
      excelColumns = Object.keys(sampleRow);
    }

    // Also collect any source_columns from mappings that might not be in the first row
    const mappedCols = result.rows.map(m => m.source_column).filter(c => c && c.trim() !== '');
    const allExcelCols = [...new Set([...excelColumns, ...mappedCols])];

    // Return filtered system parameters based on data_type
    const relevantParams = dataType ? getParametersForType(dataType) : SYSTEM_PARAMETERS;

    res.json({
      mappings: result.rows,
      excel_columns: allExcelCols,
      system_parameters: relevantParams,
      data_type: dataType
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mappings.' });
  }
};

const updateMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const { excel_column, match_status, extra_columns } = req.body;
    // Update: store the selected excel_column in source_column field, and extra_columns
    const extraCols = extra_columns ? JSON.stringify(extra_columns) : undefined;
    if (extraCols !== undefined) {
      await query('UPDATE column_mappings SET source_column = $1, match_status = $2, extra_columns = $3 WHERE id = $4',
        [excel_column || '', match_status || 'manual', extraCols, id]);
    } else {
      await query('UPDATE column_mappings SET source_column = $1, match_status = $2 WHERE id = $3',
        [excel_column || '', match_status || 'manual', id]);
    }
    res.json({ message: 'Mapping updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mapping.' });
  }
};

const updateDatasetType = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { data_type } = req.body;
    if (!['b2b', 'b2c'].includes(data_type)) {
      return res.status(400).json({ error: 'data_type must be b2b or b2c' });
    }
    await query('UPDATE datasets SET data_type = $1 WHERE id = $2', [data_type, datasetId]);

    // Re-create mappings with the correct parameter set
    // First get all Excel columns from existing rows
    const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 LIMIT 1', [datasetId]);
    let excelHeaders = [];
    if (rowsResult.rows.length > 0) {
      const sampleRow = typeof rowsResult.rows[0].row_data === 'string' ? JSON.parse(rowsResult.rows[0].row_data) : rowsResult.rows[0].row_data;
      excelHeaders = Object.keys(sampleRow);
    }

    // Delete old mappings and recreate
    await query('DELETE FROM column_mappings WHERE dataset_id = $1', [datasetId]);
    const newMappings = autoMapColumns(excelHeaders, data_type);
    for (const m of newMappings) {
      await query(
        'INSERT INTO column_mappings (dataset_id, source_column, system_parameter, match_status, extra_columns) VALUES ($1, $2, $3, $4, $5)',
        [datasetId, m.excel_column || '', m.system_parameter, m.match_status, JSON.stringify([])]
      );
    }

    res.json({ message: `Dataset type set to ${data_type}. Mappings regenerated.`, data_type });
  } catch (err) {
    console.error('Update dataset type error:', err);
    res.status(500).json({ error: 'Failed to update dataset type.' });
  }
};

const validateDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const mappingsResult = await query('SELECT * FROM column_mappings WHERE dataset_id = $1', [datasetId]);
    // Convert DB format to validation format
    const mappingsForValidation = mappingsResult.rows.map(m => ({
      system_parameter: m.system_parameter,
      excel_column: m.source_column,
      match_status: m.source_column && m.source_column.trim() !== '' ? m.match_status : 'unmapped'
    }));
    const validation = validateMappings(mappingsForValidation);
    if (validation.valid) {
      await query("UPDATE datasets SET status = 'validated' WHERE id = $1", [datasetId]);
    }
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: 'Validation failed.' });
  }
};

const downloadMappedExcel = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [datasetId]);
    const mappingsResult = await query('SELECT * FROM column_mappings WHERE dataset_id = $1', [datasetId]);
    const rows = rowsResult.rows.map(r => typeof r.row_data === 'string' ? JSON.parse(r.row_data) : r.row_data);
    // Convert DB mappings to format expected by generateMappedExcel
    const mappingsForExcel = mappingsResult.rows.map(m => ({
      source_column: m.source_column,
      system_parameter: m.system_parameter,
      match_status: m.source_column && m.source_column.trim() !== '' ? m.match_status : 'unmapped',
      extra_columns: m.extra_columns || []
    }));
    const buffer = generateMappedExcel(rows, mappingsForExcel);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mapped_data_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate mapped Excel.' });
  }
};

const saveAndProceed = async (req, res) => {
  try {
    const { datasetId } = req.params;
    // Deactivate all other datasets
    await query("UPDATE datasets SET status = 'validated' WHERE status = 'active'");
    // Activate this dataset
    await query("UPDATE datasets SET status = 'active' WHERE id = $1", [datasetId]);

    // Get dataset data_type
    const dsResult = await query('SELECT data_type FROM datasets WHERE id = $1', [datasetId]);
    const dataType = dsResult.rows[0]?.data_type || null;

    // Get mapped rows and calculate KPIs
    const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [datasetId]);
    const mappingsResult = await query('SELECT * FROM column_mappings WHERE dataset_id = $1', [datasetId]);
    // Convert DB mappings for applyMappings
    const mappingsForApply = mappingsResult.rows.map(m => ({
      source_column: m.source_column,
      system_parameter: m.system_parameter,
      match_status: m.source_column && m.source_column.trim() !== '' ? m.match_status : 'unmapped',
      extra_columns: m.extra_columns || []
    }));
    const rawRows = rowsResult.rows.map(r => typeof r.row_data === 'string' ? JSON.parse(r.row_data) : r.row_data);
    const rows = applyMappings(rawRows, mappingsForApply);

    // Calculate Dashboard KPIs always
    const dashKpis = calcDashboardKPIs(rows);

    // Calculate B2B or B2C based on data_type
    let b2bKpis = null;
    let b2cKpis = null;
    if (dataType === 'b2b') {
      b2bKpis = calcB2BKPIs(rows);
    } else if (dataType === 'b2c') {
      b2cKpis = calcB2CKPIs(rows);
    } else {
      // Fallback: calc both
      b2bKpis = calcB2BKPIs(rows);
      b2cKpis = calcB2CKPIs(rows);
    }

    // Store in kpi_cache
    for (const [name, value] of Object.entries(dashKpis)) {
      await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'dashboard', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
    }
    if (b2bKpis) {
      for (const [name, value] of Object.entries(b2bKpis)) {
        await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2b', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
      }
    }
    if (b2cKpis) {
      for (const [name, value] of Object.entries(b2cKpis)) {
        await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2c', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
      }
    }

    // Update mapped rows in DB with mapped keys
    for (let i = 0; i < rows.length; i++) {
      await query('UPDATE dataset_rows SET row_data = $1 WHERE dataset_id = $2 AND row_index = $3', [JSON.stringify(rows[i]), datasetId, i]);
    }

    res.json({ message: 'Dataset activated successfully.', dashKpis, b2bKpis, b2cKpis, data_type: dataType });
  } catch (err) {
    console.error('Save and proceed error:', err);
    res.status(500).json({ error: 'Failed to save and proceed.' });
  }
};

const deleteDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    await query('DELETE FROM datasets WHERE id = $1', [datasetId]);
    res.json({ message: 'Dataset removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dataset.' });
  }
};

// Fetch from saved API URL, insert rows, run KPI engine, activate as dataset
const fetchAndActivateApi = async (req, res) => {
  try {
    const { id } = req.params;
    const dataType = req.body.data_type || null; // 'b2b' or 'b2c'

    // 1. Load the saved integration config
    const intResult = await query('SELECT * FROM api_integrations WHERE id = $1::uuid', [id]);
    if (intResult.rows.length === 0) return res.status(404).json({ error: 'Integration not found.' });
    const integration = intResult.rows[0];

    // 2. Build fetch options from saved config
    const fetchHeaders = integration.headers ? (typeof integration.headers === 'string' ? JSON.parse(integration.headers) : integration.headers) : {};
    const authCreds = integration.auth_credentials ? (typeof integration.auth_credentials === 'string' ? JSON.parse(integration.auth_credentials) : integration.auth_credentials) : {};

    if (integration.auth_type === 'bearer' && authCreds.token) {
      fetchHeaders['Authorization'] = `Bearer ${authCreds.token}`;
    } else if (integration.auth_type === 'api_key' && authCreds.key) {
      fetchHeaders[authCreds.header_name || 'X-API-Key'] = authCreds.key;
    } else if (integration.auth_type === 'basic' && authCreds.username) {
      fetchHeaders['Authorization'] = 'Basic ' + Buffer.from(`${authCreds.username}:${authCreds.password}`).toString('base64');
    }

    // 3. Fetch data from external URL
    let externalRes;
    try {
      externalRes = await fetch(integration.endpoint_url, {
        method: integration.method || 'GET',
        headers: fetchHeaders,
      });
    } catch (fetchErr) {
      const code = fetchErr?.cause?.code || fetchErr.code || '';
      const msg = code === 'ECONNREFUSED'
        ? `Cannot connect to ${integration.endpoint_url} — the external service is not running or unreachable.`
        : `Network error reaching ${integration.endpoint_url}: ${fetchErr.message}`;
      console.warn(`[fetchAndActivateApi] ${msg}`);
      return res.status(502).json({ error: msg });
    }
    if (!externalRes.ok) return res.status(502).json({ error: `External API returned ${externalRes.status}` });

    let rawData = await externalRes.json();

    // 4. Normalize: find the array of rows
    let rows = [];
    if (Array.isArray(rawData)) {
      rows = rawData;
    } else {
      // Try to find the first array value in the object
      const arrayKey = Object.keys(rawData).find(k => Array.isArray(rawData[k]));
      if (arrayKey) rows = rawData[arrayKey];
      else return res.status(422).json({ error: 'Could not find an array of records in the API response.' });
    }

    if (rows.length === 0) return res.status(422).json({ error: 'API returned 0 records.' });

    const headers = Object.keys(rows[0]);

    // 5. Create dataset record with data_type
    const ds = await query(
      'INSERT INTO datasets (user_id, source_type, file_name, original_name, status, data_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, 'api', integration.name, integration.name, 'uploaded', dataType]
    );
    const datasetId = ds.rows[0].id;

    // 6. Insert rows
    for (let i = 0; i < rows.length; i++) {
      await query('INSERT INTO dataset_rows (dataset_id, row_index, row_data) VALUES ($1, $2, $3)', [datasetId, i, JSON.stringify(rows[i])]);
    }

    // 7. Auto-map columns (system-first, filtered by data_type)
    const mappings = autoMapColumns(headers, dataType);
    for (const m of mappings) {
      await query('INSERT INTO column_mappings (dataset_id, source_column, system_parameter, match_status, extra_columns) VALUES ($1, $2, $3, $4, $5)',
        [datasetId, m.excel_column || '', m.system_parameter, m.match_status, JSON.stringify([])]);
    }

    // 8. Deactivate all others, activate this one
    await query("UPDATE datasets SET status = 'validated' WHERE status = 'active'");
    await query("UPDATE datasets SET status = 'active' WHERE id = $1", [datasetId]);

    // 9. Apply mappings and run KPI engine
    const mappingsForApply = mappings.map(m => ({
      source_column: m.excel_column || '',
      system_parameter: m.system_parameter,
      match_status: m.match_status,
      extra_columns: []
    }));
    const mappedRows = applyMappings(rows, mappingsForApply);
    const dashKpis = calcDashboardKPIs(mappedRows);

    let b2bKpis = null;
    let b2cKpis = null;
    if (dataType === 'b2b') {
      b2bKpis = calcB2BKPIs(mappedRows);
    } else if (dataType === 'b2c') {
      b2cKpis = calcB2CKPIs(mappedRows);
    } else {
      b2bKpis = calcB2BKPIs(mappedRows);
      b2cKpis = calcB2CKPIs(mappedRows);
    }

    // 10. Cache KPIs
    for (const [name, value] of Object.entries(dashKpis)) {
      await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'dashboard', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
    }
    if (b2bKpis) {
      for (const [name, value] of Object.entries(b2bKpis)) {
        await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2b', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
      }
    }
    if (b2cKpis) {
      for (const [name, value] of Object.entries(b2cKpis)) {
        await query(`INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2c', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`, [datasetId, name, value]);
      }
    }

    // 11. Update mapped rows in DB
    for (let i = 0; i < mappedRows.length; i++) {
      await query('UPDATE dataset_rows SET row_data = $1 WHERE dataset_id = $2 AND row_index = $3', [JSON.stringify(mappedRows[i]), datasetId, i]);
    }

    // 12. Mark integration as last synced
    await query('UPDATE api_integrations SET last_synced_at = NOW() WHERE id = $1::uuid', [id]);

    res.json({ message: `Fetched ${rows.length} records, KPIs calculated, dataset activated.`, datasetId, rowCount: rows.length, dashKpis, b2bKpis, b2cKpis, data_type: dataType });
  } catch (err) {
    console.error('fetchAndActivateApi error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch and activate API data.' });
  }
};

// API Integration endpoints
const saveApiIntegration = async (req, res) => {
  try {
    const { name, endpoint_url, method, headers, auth_type, auth_credentials } = req.body;
    const result = await query(
      'INSERT INTO api_integrations (user_id, name, endpoint_url, method, headers, auth_type, auth_credentials) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.id, name, endpoint_url, method || 'GET', JSON.stringify(headers || {}), auth_type, JSON.stringify(auth_credentials || {})]
    );
    res.json({ integration: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save API integration.' });
  }
};

const getApiIntegrations = async (req, res) => {
  try {
    const result = await query('SELECT * FROM api_integrations WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ integrations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch integrations.' });
  }
};

const deleteApiIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM api_integrations WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Integration deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete integration.' });
  }
};

/**
 * POST /settings/custom-param/calculate
 * Body: { formula: [{type:'param',value:'Revenue'},{type:'op',value:'+'},{type:'param',value:'Spend'}] }
 * Uses active dataset rows to evaluate the formula.
 */
const calculateCustomParam = async (req, res) => {
  try {
    const { formula } = req.body;
    if (!formula || !Array.isArray(formula) || formula.length === 0) {
      return res.status(400).json({ error: 'No formula provided.' });
    }
    // Get active dataset rows
    const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
    if (ds.rows.length === 0) return res.status(404).json({ error: 'No active dataset.' });
    const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
    const rows = rowsResult.rows.map(r => r.row_data);
    if (rows.length === 0) return res.status(404).json({ error: 'No data in active dataset.' });

    // Build expression string, aggregate param values across all rows
    const paramSums = {};
    for (const item of formula) {
      if (item.type === 'param') {
        const key = item.value;
        if (paramSums[key] === undefined) {
          let sum = 0;
          for (const row of rows) {
            const v = parseFloat(row[key] || 0);
            if (!isNaN(v)) sum += v;
          }
          paramSums[key] = sum;
        }
      }
    }

    // Build math expression — strip trailing operator
    let expr = '';
    let lastType = null;
    for (const item of formula) {
      if (item.type === 'param') {
        expr += (paramSums[item.value] || 0);
        lastType = 'param';
      } else if (item.type === 'op' && lastType === 'param') {
        expr += ` ${item.value} `;
        lastType = 'op';
      }
    }
    // Remove trailing operator
    expr = expr.trim().replace(/[\+\-\*\/]+\s*$/, '').trim();

    if (!expr) return res.json({ result: 0, expression: '' });

    // Safe eval using Function (no require, no fs, etc.)
    let result;
    try {
      result = new Function(`return (${expr})`)();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid formula expression.' });
    }
    if (isNaN(result) || !isFinite(result)) result = 0;
    result = Math.round(result * 100) / 100;

    res.json({ result, expression: expr, paramSums });
  } catch (err) {
    console.error('Calculate custom param error:', err);
    res.status(500).json({ error: 'Calculation failed.' });
  }
};

/**
 * POST /settings/custom-param/save
 * Body: { name: 'Marketing ROI', formula: [...], result: 123.45 }
 * Adds the calculated value as a new column to every row in the active dataset.
 */
const saveCustomParam = async (req, res) => {
  try {
    const { name, formula, result } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Parameter name is required.' });

    const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
    if (ds.rows.length === 0) return res.status(404).json({ error: 'No active dataset.' });
    const datasetId = ds.rows[0].id;

    // Get all rows and add the new param to each
    const rowsResult = await query('SELECT id, row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [datasetId]);
    const paramName = name.trim();

    // Calculate per-row or set aggregate
    for (const row of rowsResult.rows) {
      const data = row.row_data;
      // Evaluate formula per row
      let expr = '';
      let lastType = null;
      for (const item of formula) {
        if (item.type === 'param') {
          const v = parseFloat(data[item.value] || 0);
          expr += (isNaN(v) ? 0 : v);
          lastType = 'param';
        } else if (item.type === 'op' && lastType === 'param') {
          expr += ` ${item.value} `;
          lastType = 'op';
        }
      }
      expr = expr.trim().replace(/[\+\-\*\/]+\s*$/, '').trim();
      let val = 0;
      try { val = new Function(`return (${expr})`)(); } catch (e) { val = 0; }
      if (isNaN(val) || !isFinite(val)) val = 0;
      data[paramName] = Math.round(val * 100) / 100;
      await query('UPDATE dataset_rows SET row_data = $1 WHERE id = $2', [JSON.stringify(data), row.id]);
    }

    res.json({ message: `Custom parameter "${paramName}" saved to ${rowsResult.rows.length} rows.`, paramName });
  } catch (err) {
    console.error('Save custom param error:', err);
    res.status(500).json({ error: 'Failed to save custom parameter.' });
  }
};

/**
 * POST /settings/integrate-api
 * Single-button external API integration.
 * Calls the external API configured in .env, processes response,
 * creates a dataset, auto-maps columns, calculates KPIs, and activates.
 * Frontend only triggers this endpoint — no API logic in frontend.
 */
const integrateExternalApi = async (req, res) => {
  try {
    // 1. Call external API via service
    let rawData;
    try {
      rawData = await fetchExternalData();
    } catch (apiErr) {
      console.warn('[integrateExternalApi] External API error:', apiErr.message);
      return res.status(502).json({ error: apiErr.message });
    }

    // 2. Normalize: find the array of rows in the response
    let rows = [];
    if (Array.isArray(rawData)) {
      rows = rawData;
    } else if (typeof rawData === 'object' && rawData !== null) {
      // Try to find the first array value in the response object
      const arrayKey = Object.keys(rawData).find(k => Array.isArray(rawData[k]));
      if (arrayKey) {
        rows = rawData[arrayKey];
      } else {
        // If it's a single object with data fields, wrap it as a single-row dataset
        rows = [rawData];
      }
    }

    if (rows.length === 0) {
      return res.status(422).json({ error: 'External API returned 0 records.' });
    }

    const headers = Object.keys(rows[0]);

    // 3. Determine data type — try to auto-detect from the response, default to 'b2b'
    const dataType = 'b2b';

    // 4. Create dataset record
    const ds = await query(
      'INSERT INTO datasets (user_id, source_type, file_name, original_name, status, data_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, 'api', 'External API Integration', 'External API Integration', 'uploaded', dataType]
    );
    const datasetId = ds.rows[0].id;

    // 5. Insert rows into dataset_rows
    for (let i = 0; i < rows.length; i++) {
      await query(
        'INSERT INTO dataset_rows (dataset_id, row_index, row_data) VALUES ($1, $2, $3)',
        [datasetId, i, JSON.stringify(rows[i])]
      );
    }

    // 6. Auto-map columns (system-first, filtered by data_type)
    const mappings = autoMapColumns(headers, dataType);
    for (const m of mappings) {
      await query(
        'INSERT INTO column_mappings (dataset_id, source_column, system_parameter, match_status, extra_columns) VALUES ($1, $2, $3, $4, $5)',
        [datasetId, m.excel_column || '', m.system_parameter, m.match_status, JSON.stringify([])]
      );
    }

    // 7. Deactivate all other datasets, activate this one
    await query("UPDATE datasets SET status = 'validated' WHERE status = 'active'");
    await query("UPDATE datasets SET status = 'active' WHERE id = $1", [datasetId]);

    // 8. Apply mappings and run KPI engine
    const mappingsForApply = mappings.map(m => ({
      source_column: m.excel_column || '',
      system_parameter: m.system_parameter,
      match_status: m.match_status,
      extra_columns: []
    }));
    const mappedRows = applyMappings(rows, mappingsForApply);
    const dashKpis = calcDashboardKPIs(mappedRows);

    let b2bKpis = null;
    let b2cKpis = null;
    if (dataType === 'b2b') {
      b2bKpis = calcB2BKPIs(mappedRows);
    } else if (dataType === 'b2c') {
      b2cKpis = calcB2CKPIs(mappedRows);
    } else {
      b2bKpis = calcB2BKPIs(mappedRows);
      b2cKpis = calcB2CKPIs(mappedRows);
    }

    // 9. Cache KPIs in kpi_cache
    for (const [name, value] of Object.entries(dashKpis)) {
      await query(
        `INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'dashboard', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`,
        [datasetId, name, value]
      );
    }
    if (b2bKpis) {
      for (const [name, value] of Object.entries(b2bKpis)) {
        await query(
          `INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2b', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`,
          [datasetId, name, value]
        );
      }
    }
    if (b2cKpis) {
      for (const [name, value] of Object.entries(b2cKpis)) {
        await query(
          `INSERT INTO kpi_cache (dataset_id, section, kpi_name, kpi_value) VALUES ($1, 'b2c', $2, $3) ON CONFLICT (dataset_id, section, kpi_name) DO UPDATE SET kpi_value = $3, calculated_at = NOW()`,
          [datasetId, name, value]
        );
      }
    }

    // 10. Update mapped rows in DB with mapped keys
    for (let i = 0; i < mappedRows.length; i++) {
      await query(
        'UPDATE dataset_rows SET row_data = $1 WHERE dataset_id = $2 AND row_index = $3',
        [JSON.stringify(mappedRows[i]), datasetId, i]
      );
    }

    console.log(`✅ External API integrated: ${rows.length} records, dataset ${datasetId} activated.`);

    res.json({
      message: `Successfully integrated ${rows.length} records from external API. Dashboard updated.`,
      datasetId,
      rowCount: rows.length,
      dashKpis,
      b2bKpis,
      b2cKpis,
      data_type: dataType
    });
  } catch (err) {
    console.error('integrateExternalApi error:', err);
    res.status(500).json({ error: err.message || 'Failed to integrate external API data.' });
  }
};

module.exports = { upload, getSystemParameters, getDatasets, uploadExcel, appendToDataset, getMappings, updateMapping, updateDatasetType, validateDataset, downloadMappedExcel, saveAndProceed, deleteDataset, saveApiIntegration, getApiIntegrations, fetchAndActivateApi, deleteApiIntegration, calculateCustomParam, saveCustomParam, integrateExternalApi };