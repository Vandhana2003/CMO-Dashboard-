const { query } = require('../config/db');
const { calcDashboardKPIs, calcDashboardCharts, calcB2BKPIs, calcB2BCharts, calcB2CKPIs, calcB2CCharts } = require('../utils/formulas');
const XLSX = require('xlsx');

/**
 * Get active dataset rows with optional channel + time filters.
 * Mirrors dashboardController logic.
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

  // Extract unique channels
  const channelSet = new Set();
  for (const row of rows) {
    const ch = row['Channel'] || row['channel'] || row['Channel Name'] || row['channel name'];
    if (ch && ch.toString().trim()) channelSet.add(ch.toString().trim());
  }
  const channels = [...channelSet].sort();

  // Channel filter
  if (channelFilter && channelFilter !== 'all') {
    rows = rows.filter(row => {
      const ch = row['Channel'] || row['channel'] || row['Channel Name'] || row['channel name'];
      return ch && ch.toString().trim().toLowerCase() === channelFilter.toLowerCase();
    });
  }

  // Time period filter
  if (timePeriod && timePeriod !== 'all') {
    const now = new Date();
    rows = rows.filter(row => {
      const dateVal = row['Date'] || row['date'] || row['Month'] || row['month'] || row['Period'] || row['period'];
      if (!dateVal) return true;
      const d = new Date(dateVal.toString().trim());
      if (isNaN(d.getTime())) return true;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      switch (timePeriod) {
        case 'today': return d.toDateString() === today.toDateString();
        case '7days': { const w = new Date(today); w.setDate(w.getDate() - 7); return d >= w; }
        case 'month': return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        case 'quarter': { const qs = Math.floor(now.getMonth() / 3) * 3; return d.getFullYear() === now.getFullYear() && d.getMonth() >= qs && d.getMonth() < qs + 3; }
        case 'year': return d.getFullYear() === now.getFullYear();
        default: return true;
      }
    });
  }

  return { rows, dataType, channels };
};

/**
 * GET /api/reports — generate report data with filters
 * Query params: type (b2b|b2c), channel, time_period
 */
const getReportData = async (req, res) => {
  try {
    const type = req.query.type;
    const channelFilter = req.query.channel || 'all';
    const timePeriod = req.query.time_period || 'all';

    const { rows, dataType, channels } = await getActiveDatasetRows(channelFilter, timePeriod);
    const activeType = type || dataType;

    if (rows.length === 0) {
      return res.json({ dashboardKPIs: {}, sectionKPIs: {}, chartSummary: {}, type: activeType, hasData: false, channels, filters: { channel: channelFilter, time_period: timePeriod } });
    }

    const dashboardKPIs = calcDashboardKPIs(rows);
    const dashCharts = calcDashboardCharts(rows);
    let sectionKPIs = {};
    let sectionCharts = {};

    if (activeType === 'b2b') {
      sectionKPIs = calcB2BKPIs(rows);
      sectionCharts = calcB2BCharts(rows);
    } else if (activeType === 'b2c') {
      sectionKPIs = calcB2CKPIs(rows);
      sectionCharts = calcB2CCharts(rows);
    }

    // Build chart summary for preview
    const chartSummary = {};
    if (dashCharts.revenue_trend?.labels?.length > 0) {
      chartSummary.revenue_trend = { periods: dashCharts.revenue_trend.labels.length, total: dashCharts.revenue_trend.data.reduce((a, b) => a + b, 0) };
    }
    if (dashCharts.channel_roi?.labels?.length > 0) {
      chartSummary.channel_roi = {};
      dashCharts.channel_roi.labels.forEach((l, i) => { chartSummary.channel_roi[l] = dashCharts.channel_roi.data[i] + '%'; });
    }
    if (dashCharts.conversion_funnel) {
      chartSummary.conversion_funnel = dashCharts.conversion_funnel;
    }
    if (activeType === 'b2b' && sectionCharts.cpl_by_channel?.labels?.length > 0) {
      chartSummary.cpl_by_channel = {};
      sectionCharts.cpl_by_channel.labels.forEach((l, i) => { chartSummary.cpl_by_channel[l] = '$' + sectionCharts.cpl_by_channel.data[i]; });
    }
    if (activeType === 'b2c' && sectionCharts.cart_abandonment_funnel) {
      chartSummary.cart_abandonment = sectionCharts.cart_abandonment_funnel;
    }

    res.json({
      dashboardKPIs, sectionKPIs, chartSummary,
      type: activeType, hasData: true, channels,
      filters: { channel: channelFilter, time_period: timePeriod },
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};

/**
 * GET /api/reports/download — download Excel report with filters
 * Query params: type, channel, time_period, filename
 */
const downloadReport = async (req, res) => {
  try {
    const type = req.query.type;
    const channelFilter = req.query.channel || 'all';
    const timePeriod = req.query.time_period || 'all';
    const filename = req.query.filename || `report_${type}_${Date.now()}`;

    const { rows, dataType } = await getActiveDatasetRows(channelFilter, timePeriod);
    const activeType = type || dataType;
    if (rows.length === 0) return res.status(404).json({ error: 'No data available.' });

    const dashboardKPIs = calcDashboardKPIs(rows);
    const sectionKPIs = activeType === 'b2b' ? calcB2BKPIs(rows) : calcB2CKPIs(rows);
    const dashCharts = calcDashboardCharts(rows);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Report Information
    const infoData = [
      { Field: 'Dataset Type', Value: (activeType || '').toUpperCase() },
      { Field: 'Generated Date', Value: new Date().toLocaleString() },
      { Field: 'Selected Channel', Value: channelFilter === 'all' ? 'All Channels' : channelFilter },
      { Field: 'Selected Time Period', Value: timePeriod === 'all' ? 'All Time' : timePeriod },
      { Field: 'Total Records', Value: rows.length }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(infoData), 'Report Info');

    // Sheet 2: KPI Summary (all 12)
    const kpiData = [
      ...Object.entries(dashboardKPIs).map(([k, v]) => ({ Metric: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), Value: v, Section: 'Dashboard' })),
      ...Object.entries(sectionKPIs).map(([k, v]) => ({ Metric: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), Value: v, Section: (activeType || '').toUpperCase() }))
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiData), 'KPI Summary');

    // Sheet 3: Chart Summary
    const chartRows = [];
    if (dashCharts.revenue_trend?.labels) {
      dashCharts.revenue_trend.labels.forEach((l, i) => chartRows.push({ Chart: 'Revenue Trend', Period: l, Value: dashCharts.revenue_trend.data[i] }));
    }
    if (dashCharts.channel_roi?.labels) {
      dashCharts.channel_roi.labels.forEach((l, i) => chartRows.push({ Chart: 'Channel ROI', Channel: l, 'ROI %': dashCharts.channel_roi.data[i] }));
    }
    if (dashCharts.conversion_funnel) {
      const f = dashCharts.conversion_funnel;
      chartRows.push({ Chart: 'Conversion Funnel', Stage: 'Leads', Value: f.leads });
      chartRows.push({ Chart: 'Conversion Funnel', Stage: 'MQLs', Value: f.mqls });
      chartRows.push({ Chart: 'Conversion Funnel', Stage: 'SQLs', Value: f.sqls });
      chartRows.push({ Chart: 'Conversion Funnel', Stage: 'Customers', Value: f.customers });
    }
    if (chartRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chartRows), 'Chart Data');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Failed to download report.' });
  }
};

module.exports = { getReportData, downloadReport };
