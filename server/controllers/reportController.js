const { query } = require('../config/db');
const { calcDashboardKPIs, calcB2BKPIs, calcB2CKPIs } = require('../utils/formulas');
const XLSX = require('xlsx');

const getActiveDatasetRows = async () => {
  const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  if (ds.rows.length === 0) return [];
  const rows = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
  return rows.rows.map(r => r.row_data);
};

const getReportData = async (req, res) => {
  try {
    const { type } = req.query; // 'b2b' or 'b2c'
    const rows = await getActiveDatasetRows();
    if (rows.length === 0) return res.json({ data: null, hasData: false });

    const dashboardKPIs = calcDashboardKPIs(rows);
    let sectionKPIs;

    if (type === 'b2b') {
      sectionKPIs = calcB2BKPIs(rows);
    } else {
      sectionKPIs = calcB2CKPIs(rows);
    }

    res.json({ dashboardKPIs, sectionKPIs, type, hasData: true });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};

const downloadReport = async (req, res) => {
  try {
    const { type } = req.query;
    const rows = await getActiveDatasetRows();
    if (rows.length === 0) return res.status(404).json({ error: 'No data available.' });

    const dashboardKPIs = calcDashboardKPIs(rows);
    const sectionKPIs = type === 'b2b' ? calcB2BKPIs(rows) : calcB2CKPIs(rows);

    // Build Excel
    const wb = XLSX.utils.book_new();

    // Dashboard sheet
    const dashData = Object.entries(dashboardKPIs).map(([k, v]) => ({ Metric: k.replace(/_/g, ' ').toUpperCase(), Value: v }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashData), 'Dashboard');

    // Section sheet
    const secData = Object.entries(sectionKPIs).map(([k, v]) => ({ Metric: k.replace(/_/g, ' ').toUpperCase(), Value: v }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(secData), type.toUpperCase());

    // Raw data sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Raw Data');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Failed to download report.' });
  }
};

module.exports = { getReportData, downloadReport };
