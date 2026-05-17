const { query } = require('../config/db');
const { calcB2CKPIs, calcB2CCharts, calcB2CInsights } = require('../utils/formulas');

const getActiveDatasetRows = async () => {
  const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  if (ds.rows.length === 0) return [];
  const rows = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
  return rows.rows.map(r => r.row_data);
};

const getB2CData = async (req, res) => {
  try {
    const rows = await getActiveDatasetRows();
    if (rows.length === 0) {
      return res.json({ kpis: {}, charts: {}, insights: [], hasData: false });
    }
    const kpis = calcB2CKPIs(rows);
    const charts = calcB2CCharts(rows);
    const insights = calcB2CInsights(kpis);
    res.json({ kpis, charts, insights, hasData: true });
  } catch (err) {
    console.error('B2C error:', err);
    res.status(500).json({ error: 'Failed to fetch B2C data.' });
  }
};

module.exports = { getB2CData };
