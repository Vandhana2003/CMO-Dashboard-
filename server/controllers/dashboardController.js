const { query } = require('../config/db');
const { calcDashboardKPIs, calcDashboardCharts, calcB2BKPIs, calcB2BCharts, calcB2BInsights, calcB2CKPIs, calcB2CCharts, calcB2CInsights } = require('../utils/formulas');

/**
 * Get active dataset rows, optionally filtered by channel and time period.
 */
const getActiveDatasetRows = async (channelFilter, timePeriod) => {
  let ds;
  try {
    ds = await query("SELECT id, data_type FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  } catch (e) {
    ds = await query("SELECT id FROM datasets WHERE status = 'active' ORDER BY uploaded_at DESC LIMIT 1");
  }
  if (ds.rows.length === 0) return { rows: [], dataType: null, channels: [] };
  const dataType = ds.rows[0].data_type || null;
  const rowsResult = await query('SELECT row_data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [ds.rows[0].id]);
  let rows = rowsResult.rows.map(r => r.row_data);

  // Extract unique channels from all rows
  const channelSet = new Set();
  for (const row of rows) {
    const ch = row['Channel'] || row['channel'] || row['Channel Name'] || row['channel name'];
    if (ch && ch.toString().trim()) channelSet.add(ch.toString().trim());
  }
  const channels = [...channelSet].sort();

  // Apply channel filter
  if (channelFilter && channelFilter !== 'all') {
    rows = rows.filter(row => {
      const ch = row['Channel'] || row['channel'] || row['Channel Name'] || row['channel name'];
      return ch && ch.toString().trim().toLowerCase() === channelFilter.toLowerCase();
    });
  }

  // Apply time period filter
  if (timePeriod && timePeriod !== 'all') {
    const now = new Date();
    rows = rows.filter(row => {
      const dateVal = row['Date'] || row['date'] || row['Month'] || row['month'] || row['Period'] || row['period'] || row['Timestamp'] || row['timestamp'];
      if (!dateVal) return true; // keep rows without date info
      const rowDate = parseRowDate(dateVal, now);
      if (!rowDate) return true; // keep rows that can't be parsed
      return isInTimePeriod(rowDate, timePeriod, now);
    });
  }

  return { rows, dataType, channels };
};

/**
 * Parse a date from row data — handles various formats
 */
function parseRowDate(val, now) {
  if (!val) return null;
  const str = val.toString().trim();

  // Try direct Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1970) return d;

  // Handle month names: "Jan", "January", "Jan 2024", etc.
  const monthNames = {
    'jan':0,'january':0,'feb':1,'february':1,'mar':2,'march':2,'apr':3,'april':3,
    'may':4,'jun':5,'june':5,'jul':6,'july':6,'aug':7,'august':7,
    'sep':8,'september':8,'oct':9,'october':9,'nov':10,'november':10,'dec':11,'december':11
  };
  const lower = str.toLowerCase();
  // Check "Jan 2024" or "January 2024"
  const parts = lower.split(/[\s,\/\-]+/);
  for (const p of parts) {
    if (monthNames[p] !== undefined) {
      const yearPart = parts.find(pp => /^\d{4}$/.test(pp));
      const year = yearPart ? parseInt(yearPart) : now.getFullYear();
      return new Date(year, monthNames[p], 15); // mid-month
    }
  }

  // Numeric month: "1", "2", ..., "12"
  const num = parseInt(str);
  if (num >= 1 && num <= 12) {
    return new Date(now.getFullYear(), num - 1, 15);
  }

  return null;
}

/**
 * Check if a date falls within the given time period
 */
function isInTimePeriod(date, period, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today': {
      return date.getFullYear() === today.getFullYear() &&
             date.getMonth() === today.getMonth() &&
             date.getDate() === today.getDate();
    }
    case '7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo && date <= now;
    }
    case 'month': {
      return date.getFullYear() === now.getFullYear() &&
             date.getMonth() === now.getMonth();
    }
    case 'quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
      return date >= qStart && date <= qEnd;
    }
    case 'year': {
      return date.getFullYear() === now.getFullYear();
    }
    default:
      return true;
  }
}

/**
 * Unified Dashboard endpoint — returns Dashboard KPIs/Charts + B2B or B2C KPIs/Charts
 * Accepts query params: ?channel=xxx&time_period=xxx
 */
const getDashboardData = async (req, res) => {
  try {
    const channelFilter = req.query.channel || 'all';
    const timePeriod = req.query.time_period || 'all';

    const { rows, dataType, channels } = await getActiveDatasetRows(channelFilter, timePeriod);

    // If no active dataset, return empty structure with zero values
    if (rows.length === 0) {
      const emptyDash = { revenue: 0, marketing_spend: 0, blended_roi: 0, cac: 0, total_leads: 0, conversion_rate: 0, cpl: 0 };
      const emptyDashCharts = {
        revenue_trend: { labels: [], data: [] },
        cac_vs_ltv: { cac: 0, ltv: 0 },
        cac_vs_ltv_trend: { labels: [], cac_data: [], ltv_data: [] },
        conversion_funnel: { leads: 0, mqls: 0, sqls: 0, customers: 0 },
        channel_roi: { labels: [], data: [] }
      };
      const emptyB2B = {
        kpis: { pipeline_value: 0, mql_sql_conversion: 0, deal_velocity: 0, win_rate: 0, churn_rate: 0 },
        charts: { cpl_by_channel: { labels: [], data: [] }, win_rate_trend: { labels: [], data: [] } },
        insights: []
      };
      const emptyB2C = {
        kpis: { ltv: 0, repeat_purchase_rate: 0, aov: 0, cart_abandonment_rate: 0, purchase_frequency: 0 },
        charts: { repeat_purchase_trend: { labels: [], data: [] }, cart_abandonment_funnel: { carts_created: 0, purchases_completed: 0 } },
        insights: []
      };

      return res.json({
        dashboard: { kpis: emptyDash, charts: emptyDashCharts },
        b2b: dataType === 'b2b' ? emptyB2B : null,
        b2c: dataType === 'b2c' ? emptyB2C : null,
        data_type: dataType,
        channels: channels,
        hasData: false
      });
    }

    // Calculate Dashboard
    const dashKpis = calcDashboardKPIs(rows);
    const dashCharts = calcDashboardCharts(rows);

    let b2bData = null;
    let b2cData = null;

    if (dataType === 'b2b') {
      const b2bKpis = calcB2BKPIs(rows);
      const b2bCharts = calcB2BCharts(rows);
      const b2bInsights = calcB2BInsights(b2bKpis);
      b2bData = { kpis: b2bKpis, charts: b2bCharts, insights: b2bInsights };
    } else if (dataType === 'b2c') {
      const b2cKpis = calcB2CKPIs(rows);
      const b2cCharts = calcB2CCharts(rows);
      const b2cInsights = calcB2CInsights(b2cKpis);
      b2cData = { kpis: b2cKpis, charts: b2cCharts, insights: b2cInsights };
    }

    res.json({
      dashboard: { kpis: dashKpis, charts: dashCharts },
      b2b: b2bData,
      b2c: b2cData,
      data_type: dataType,
      channels: channels,
      hasData: true
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
};

module.exports = { getDashboardData };
