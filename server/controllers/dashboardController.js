const { query } = require('../config/db');
const { calcDashboardKPIs, calcDashboardCharts } = require('../utils/formulas');

const getActiveDatasetRows = async () => {
  const ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  if (ds.rows.length === 0) return [];
  const rows = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
  return rows.rows.map(r => r.row_data);
};

const getDashboardData = async (req, res) => {
  try {
    const rows = await getActiveDatasetRows();
    if (rows.length === 0) {
      return res.json({ kpis: {}, charts: {}, hasData: false });
    }
    const kpis = calcDashboardKPIs(rows);
    const charts = calcDashboardCharts(rows);
    res.json({ kpis, charts, hasData: true });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
};

module.exports = { getDashboardData };
