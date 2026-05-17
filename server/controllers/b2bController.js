const { query } = require('../config/db');
const { calcB2BKPIs, calcB2BCharts, calcB2BInsights } = require('../utils/formulas');

const getActiveDatasetRows = async () => {
  const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  if (ds.rows.length === 0) return [];
  const rows = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
  return rows.rows.map(r => r.row_data);
};

const getB2BData = async (req, res) => {
  try {
    const rows = await getActiveDatasetRows();
    if (rows.length === 0) {
      return res.json({ kpis: {}, charts: {}, insights: [], hasData: false });
    }
    const kpis = calcB2BKPIs(rows);
    const charts = calcB2BCharts(rows);
    const insights = calcB2BInsights(kpis);
    res.json({ kpis, charts, insights, hasData: true });
  } catch (err) {
    console.error('B2B error:', err);
    res.status(500).json({ error: 'Failed to fetch B2B data.' });
  }
};

module.exports = { getB2BData };
