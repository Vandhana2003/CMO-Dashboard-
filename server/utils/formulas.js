/**
 * CMO Dashboard - KPI Formula Engine
 * All formulas are calculated server-side from raw dataset values.
 * No re-calculating, no duplication - single source of truth.
 */

// ============================================
// SYSTEM PARAMETERS — split by section
// ============================================
// Shared dashboard params (used in both B2B and B2C)
const DASHBOARD_PARAMS = [
  'Channel Revenue', 'PR / Media Revenue', 'Channel cost', 'PR / Media cost',
  'Revenue', 'Marketing cost', 'Sales Cost',
  'Number of New Customers', 'Leads',
  'Attributed Revenue', 'Channel Leads',
  'Date', 'Channel'
];

// B2B-only params
const B2B_PARAMS = [
  'Deal value', 'Probability',
  'Number of MQLs', 'Number of SQLs',
  'Total Days to Close', 'Number of Deals',
  'Won Deals', 'Total Opportunities',
  'Customers Lost', 'Customers at Start of Period'
];

// B2C-only params (AOV and LTV are NOT here — they are auto-calculated KPIs)
const B2C_PARAMS = [
  'Purchase Frequency', 'Customer Lifespan',
  'Gross Margin %', 'COGS',
  'Repeat Customers', 'Total Customers',
  'Total Orders', 'Carts Created', 'Purchases Completed'
];

const SYSTEM_PARAMETERS = [...DASHBOARD_PARAMS, ...B2B_PARAMS, ...B2C_PARAMS];

/**
 * Get system parameters for a given data type
 * @param {string} dataType - 'b2b' or 'b2c'
 * @returns {string[]} Array of parameter names
 */
function getParametersForType(dataType) {
  if (dataType === 'b2b') return [...DASHBOARD_PARAMS, ...B2B_PARAMS];
  if (dataType === 'b2c') return [...DASHBOARD_PARAMS, ...B2C_PARAMS];
  return SYSTEM_PARAMETERS; // fallback: all
}

// Normalize a parameter name for matching
function normalizeKey(key) {
  if (!key) return '';
  return key.toString().trim().toLowerCase().replace(/[\s_\-\/]+/g, ' ').replace(/[()%]/g, '');
}

// Build a lookup from mapped data rows
function buildAggregates(rows) {
  const agg = {};
  const counts = {};

  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      const nk = normalizeKey(key);
      const num = parseFloat(val);
      if (!isNaN(num)) {
        agg[nk] = (agg[nk] || 0) + num;
        counts[nk] = (counts[nk] || 0) + 1;
      }
    }
  }
  return { agg, counts, totalRows: rows.length };
}

// Safe getter
function get(agg, ...aliases) {
  for (const a of aliases) {
    const nk = normalizeKey(a);
    if (agg[nk] !== undefined && agg[nk] !== null) return agg[nk];
  }
  return 0;
}

// NaN-safe round — never returns NaN, Infinity, or undefined
function safe(v) { const n = Number(v); return (isNaN(n) || !isFinite(n)) ? 0 : Math.round(n * 100) / 100; }

// ============================================
// DASHBOARD KPIs
// ============================================
function calcDashboardKPIs(rows) {
  const { agg } = buildAggregates(rows);

  const channelRevenue = get(agg, 'Channel Revenue', 'Channel revenue');
  const prMediaRevenue = get(agg, 'PR / Media Revenue', 'PR Media Revenue');
  const resourceRevenue = get(agg, 'Resource Revenue', 'Resource revenue');
  const channelCost = get(agg, 'Channel cost', 'Channel Cost');
  const prMediaCost = get(agg, 'PR / Media cost', 'PR Media cost');
  console.log("channelRevenue", channelRevenue, "prMediaRevenue", prMediaRevenue, "resourceRevenue", resourceRevenue, "channelCost", channelCost, "prMediaCost", prMediaCost);
  const revenue = (channelRevenue + prMediaRevenue + resourceRevenue) - (channelCost + prMediaCost);
  const mktgCost = get(agg, 'Marketing cost', 'Marketing Cost', 'Total Marketing Cost');
  const salesCost = get(agg, 'Sales Cost', 'Total Sales Cost');
  const newCustomers = get(agg, 'Number of New Customers');
  const leads = get(agg, 'Leads');

  const roi = mktgCost !== 0 ? ((revenue - mktgCost) / mktgCost) : 0;
  const cac = newCustomers !== 0 ? ((salesCost + mktgCost) / newCustomers) : 0;
  const conversionRate = leads !== 0 ? ((newCustomers / leads) * 100) : 0;
  const cpl = leads !== 0 ? (mktgCost / leads) : 0;

  return {
    revenue: safe(revenue),
    marketing_spend: safe(mktgCost),
    blended_roi: safe(roi * 100),
    cac: safe(cac),
    total_leads: safe(leads),
    conversion_rate: safe(conversionRate),
    cpl: safe(cpl)
  };
}

// ============================================
// B2B KPIs
// ============================================
function calcB2BKPIs(rows) {
  const { agg } = buildAggregates(rows);

  // Pipeline Value: Deal Value × Probability (per row)
  let pipelineValue = 0;
  for (const row of rows) {
    const dv = parseFloat(row['Deal value'] || row['Deal Value'] || row['deal value'] || 0) || 0;
    const prob = parseFloat(row['Probability'] || row['probability'] || 0) || 0;
    pipelineValue += dv * (prob / 100);
  }
  // Fallback: use aggregated values
  if (pipelineValue === 0) {
    const dv = get(agg, 'Deal value', 'Deal Value');
    const prob = get(agg, 'Probability');
    pipelineValue = dv * (prob / 100);
  }

  const sqls = get(agg, 'Number of SQLs');
  const mqls = get(agg, 'Number of MQLs');
  const totalDays = get(agg, 'Total Days to Close');
  const numDeals = get(agg, 'Number of Deals');
  const wonDeals = get(agg, 'Won Deals');
  const totalOpps = get(agg, 'Total Opportunities');
  const custLost = get(agg, 'Customers Lost');
  const custStart = get(agg, 'Customers at Start of Period');

  const mqlSqlRate = mqls !== 0 ? ((sqls / mqls) * 100) : 0;
  const dealVelocity = numDeals !== 0 ? (totalDays / numDeals) : 0;
  const winRate = totalOpps !== 0 ? ((wonDeals / totalOpps) * 100) : 0;
  const churnRate = custStart !== 0 ? ((custLost / custStart) * 100) : 0;

  return {
    pipeline_value: safe(pipelineValue),
    mql_sql_conversion: safe(mqlSqlRate),
    deal_velocity: safe(dealVelocity),
    win_rate: safe(winRate),
    churn_rate: safe(churnRate)
  };
}

// ============================================
// B2C KPIs
// ============================================
function calcB2CKPIs(rows) {
  const { agg } = buildAggregates(rows);

  const revenue = get(agg, 'Revenue');
  const totalOrders = get(agg, 'Total Orders');
  const totalCustomers = get(agg, 'Total Customers');
  const repeatCustomers = get(agg, 'Repeat Customers', 'Repeat customer', 'Repeat Customer');
  const cartsCreated = get(agg, 'Carts Created');
  const purchasesCompleted = get(agg, 'Purchases Completed');
  const customerLifespan = get(agg, 'Customer Lifespan');
  const cogs = get(agg, 'COGS', 'COGS Cost of Goods Sold', 'Cost of Goods Sold');

  // Step 1: AOV = Revenue / Total Orders
  const aov = totalOrders !== 0 ? (revenue / totalOrders) : 0;

  // Step 2: Purchase Frequency = Total Orders / Total Customers
  const purchaseFreq = totalCustomers !== 0 ? (totalOrders / totalCustomers) : 0;

  // Step 3: Gross Margin % = [(Revenue - COGS) / Revenue] × 100
  const grossMargin = revenue !== 0 ? (((revenue - cogs) / revenue) * 100) : 0;

  // Step 4: LTV = AOV × Purchase Frequency × Customer Lifespan × Gross Margin%
  const ltv = aov * purchaseFreq * customerLifespan * (grossMargin / 100);

  // Repeat Purchase Rate = (Repeat Customers / Total Customers) × 100
  const repeatRate = totalCustomers !== 0 ? ((repeatCustomers / totalCustomers) * 100) : 0;

  // Cart Abandonment Rate = ((Carts Created - Purchases Completed) / Carts Created) × 100
  const abandonRate = cartsCreated !== 0 ? (((cartsCreated - purchasesCompleted) / cartsCreated) * 100) : 0;

  return {
    ltv: safe(ltv),
    repeat_purchase_rate: safe(repeatRate),
    aov: safe(aov),
    cart_abandonment_rate: safe(abandonRate),
    purchase_frequency: safe(purchaseFreq)
  };
}

// ============================================
// MONTH ORDERING UTILITY
// ============================================
const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_ALIASES = {
  'january': 'Jan', 'february': 'Feb', 'march': 'Mar', 'april': 'Apr', 'may': 'May', 'june': 'Jun',
  'july': 'Jul', 'august': 'Aug', 'september': 'Sep', 'october': 'Oct', 'november': 'Nov', 'december': 'Dec',
  'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr', 'may': 'May', 'jun': 'Jun',
  'jul': 'Jul', 'aug': 'Aug', 'sep': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dec': 'Dec',
  '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'May', '6': 'Jun',
  '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};
function normalizeMonth(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  return MONTH_ALIASES[s] || null;
}
function sortByMonth(labels) {
  return [...labels].sort((a, b) => {
    const ia = MONTH_ORDER.indexOf(normalizeMonth(a) || a);
    const ib = MONTH_ORDER.indexOf(normalizeMonth(b) || b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Get period key from a row
function getPeriod(row) {
  return row['Month'] || row['month'] || row['Period'] || row['period'] || row['Date'] || null;
}

// Get channel key from a row
function getChannel(row) {
  return row['Channel'] || row['channel'] || row['Channel Name'] || row['channel name'] || null;
}

// ============================================
// CHART DATA GENERATORS
// ============================================
function calcDashboardCharts(rows) {
  const kpis = calcDashboardKPIs(rows);
  const b2cKpis = calcB2CKPIs(rows);
  const { agg } = buildAggregates(rows);

  const cacLtvTrend = generateCacLtvTrend(rows);

  return {
    revenue_trend: generateTrendFromRows(rows, ['Channel Revenue', 'Channel revenue', 'Revenue']),
    cac_vs_ltv: { cac: kpis.cac, ltv: b2cKpis.ltv },
    cac_vs_ltv_trend: cacLtvTrend,
    conversion_funnel: {
      leads: kpis.total_leads,
      mqls: get(agg, 'Number of MQLs'),
      sqls: get(agg, 'Number of SQLs'),
      customers: get(agg, 'Number of New Customers')
    },
    channel_roi: extractChannelData(rows, 'roi')
  };
}

function calcB2BCharts(rows) {
  const kpis = calcB2BKPIs(rows);

  // Win Rate Trend: group by month, calculate (Won Deals / Total Opportunities) × 100
  const winRateTrend = generateWinRateTrend(rows);

  return {
    cpl_by_channel: extractChannelData(rows, 'cpl'),
    win_rate_trend: winRateTrend
  };
}

// Win Rate per period: (Won Deals / Total Opportunities) × 100
function generateWinRateTrend(rows) {
  const periods = {};
  for (const row of rows) {
    const period = getPeriod(row) || 'Total';
    if (!periods[period]) periods[period] = { won: 0, total: 0 };
    const won = parseFloat(row['Won Deals'] || row['won deals'] || row['Won deals'] || 0);
    const total = parseFloat(row['Total Opportunities'] || row['total opportunities'] || row['Total opportunities'] || 0);
    if (!isNaN(won)) periods[period].won += won;
    if (!isNaN(total)) periods[period].total += total;
  }
  const rawLabels = Object.keys(periods);
  if (rawLabels.length === 0) return { labels: ['Current'], data: [0] };
  const labels = sortByMonth(rawLabels);
  const data = labels.map(l => {
    const p = periods[l];
    return p.total !== 0 ? Math.round(((p.won / p.total) * 100) * 100) / 100 : 0;
  });
  return { labels, data };
}

function calcB2CCharts(rows) {
  const { agg } = buildAggregates(rows);
  const kpis = calcB2CKPIs(rows);

  let repeatTrend = generatePerChannelTrend(rows, ['Repeat customer', 'Repeat Customer', 'Repeat Customers']);
  if (!repeatTrend) {
    repeatTrend = generateTrendFromRows(rows, ['Repeat customer', 'Repeat Customer', 'Repeat Customers']);
  }
  if (!repeatTrend) {
    // Fallback: single KPI value
    repeatTrend = { labels: ['Current'], data: [kpis.repeat_purchase_rate || 0] };
  }

  return {
    repeat_purchase_trend: repeatTrend,
    cart_abandonment_funnel: {
      carts_created: get(agg, 'Carts Created'),
      purchases_completed: get(agg, 'Purchases Completed')
    }
  };
}

// ============================================
// TREND GENERATORS
// ============================================

// Single-series trend aggregated by period
function generateTrendFromRows(rows, fields) {
  const monthly = {};
  for (const row of rows) {
    const period = getPeriod(row) || 'Total';
    if (!monthly[period]) monthly[period] = 0;
    for (const f of fields) {
      const val = parseFloat(row[f] || 0);
      if (!isNaN(val)) monthly[period] += val;
    }
  }
  const entries = Object.entries(monthly);
  if (entries.length === 0) return null;
  const labels = sortByMonth(entries.map(([k]) => k));
  const dataMap = Object.fromEntries(entries);
  return { labels, data: labels.map(l => dataMap[l] || 0) };
}

// Multi-series trend: one line per channel, x-axis = month
function generatePerChannelTrend(rows, fields) {
  // Group by channel and period
  const channelPeriods = {};
  const allPeriods = new Set();
  for (const row of rows) {
    const ch = getChannel(row);
    const period = getPeriod(row);
    if (!ch || !period) continue;
    if (!channelPeriods[ch]) channelPeriods[ch] = {};
    if (!channelPeriods[ch][period]) channelPeriods[ch][period] = 0;
    for (const f of fields) {
      const val = parseFloat(row[f] || 0);
      if (!isNaN(val)) channelPeriods[ch][period] += val;
    }
    allPeriods.add(period);
  }
  const channels = Object.keys(channelPeriods);
  if (channels.length === 0 || allPeriods.size === 0) {
    // Fallback: single series aggregated trend
    const fallback = generateTrendFromRows(rows, fields);
    return fallback;
  }
  const labels = sortByMonth([...allPeriods]);
  const datasets = channels.map(ch => ({
    channel: ch,
    data: labels.map(l => channelPeriods[ch][l] || 0)
  }));
  // Keep channels even if some have zeros
  const validDatasets = datasets.filter(ds => ds.data.some(v => v !== 0));
  if (validDatasets.length === 0) {
    // Fallback to single series
    return generateTrendFromRows(rows, fields);
  }
  return { labels, datasets: validDatasets, multiSeries: true };
}

// CAC vs LTV trend per period
function generateCacLtvTrend(rows) {
  const periods = {};
  for (const row of rows) {
    const period = getPeriod(row) || 'Total';
    if (!periods[period]) periods[period] = [];
    periods[period].push(row);
  }
  const rawLabels = Object.keys(periods);
  const labels = sortByMonth(rawLabels);
  const cacData = [];
  const ltvData = [];
  for (const label of labels) {
    const periodRows = periods[label];
    const pAgg = buildAggregates(periodRows).agg;

    const mktgCost = get(pAgg, 'Marketing cost', 'Marketing Cost', 'Total Marketing Cost');
    const salesCost = get(pAgg, 'Sales Cost', 'Total Sales Cost');
    const newCust = get(pAgg, 'Number of New Customers');
    cacData.push(newCust !== 0 ? Math.round(((salesCost + mktgCost) / newCust) * 100) / 100 : 0);

    const revenue = get(pAgg, 'Revenue');
    const totalOrders = get(pAgg, 'Total Orders');
    const totalCustomers = get(pAgg, 'Total Customers');
    const customerLifespan = get(pAgg, 'Customer Lifespan');
    const cogs = get(pAgg, 'COGS Cost of Goods Sold', 'COGS', 'Cost of Goods Sold');
    const aov = totalOrders !== 0 ? (revenue / totalOrders) : 0;
    const pf = totalCustomers !== 0 ? (totalOrders / totalCustomers) : 0;
    const gm = revenue !== 0 ? (((revenue - cogs) / revenue) * 100) : 0;
    ltvData.push(Math.round(aov * pf * customerLifespan * (gm / 100) * 100) / 100);
  }
  // Always return — frontend handles display
  return { labels, cac_data: cacData, ltv_data: ltvData };
}

// ============================================
// CHANNEL DATA EXTRACTION
// ============================================
function extractChannelData(rows, type) {
  const channels = {};
  for (const row of rows) {
    const ch = getChannel(row);
    if (!ch) continue; // skip rows without channel
    if (!channels[ch]) channels[ch] = { revenue: 0, cost: 0, leads: 0 };
    const rev = parseFloat(row['Channel Revenue'] || row['Channel revenue'] || row['Attributed Revenue'] || row['Revenue'] || 0) || 0;
    const cost = parseFloat(row['Channel cost'] || row['Channel Cost'] || row['Marketing cost'] || row['Marketing Cost'] || 0) || 0;
    const leads = parseFloat(row['Channel Leads'] || row['Channel leads'] || row['Leads'] || 0) || 0;
    channels[ch].revenue += rev;
    channels[ch].cost += cost;
    channels[ch].leads += leads;
  }
  const labels = Object.keys(channels);
  if (labels.length === 0) return { labels: [], data: [] };
  let data;
  if (type === 'roi') {
    // ROI = (Revenue - Cost) / Cost * 100
    data = labels.map(ch => {
      const c = channels[ch];
      return c.cost !== 0 ? safe(((c.revenue - c.cost) / c.cost) * 100) : 0;
    });
  } else {
    // CPL = Cost / Leads
    data = labels.map(ch => {
      const c = channels[ch];
      return c.leads !== 0 ? safe(c.cost / c.leads) : 0;
    });
  }
  return { labels, data };
}

// ============================================
// KEY INSIGHTS GENERATORS
// ============================================
function calcB2BInsights(kpis) {
  const insights = [];
  if (kpis.win_rate > 50) insights.push({ type: 'positive', text: `Strong win rate at ${kpis.win_rate}% - above industry average.` });
  else insights.push({ type: 'warning', text: `Win rate at ${kpis.win_rate}% - consider improving sales qualification.` });
  if (kpis.churn_rate > 10) insights.push({ type: 'negative', text: `High churn rate of ${kpis.churn_rate}% - customer retention needs attention.` });
  else insights.push({ type: 'positive', text: `Churn rate at ${kpis.churn_rate}% - healthy customer retention.` });
  if (kpis.deal_velocity > 60) insights.push({ type: 'warning', text: `Deal cycle averaging ${kpis.deal_velocity} days - look for bottlenecks.` });
  else insights.push({ type: 'positive', text: `Fast deal velocity at ${kpis.deal_velocity} days.` });
  insights.push({ type: 'info', text: `Pipeline valued at $${kpis.pipeline_value.toLocaleString()}.` });
  return insights;
}

function calcB2CInsights(kpis) {
  const insights = [];
  if (kpis.repeat_purchase_rate > 30) insights.push({ type: 'positive', text: `Strong repeat purchase rate at ${kpis.repeat_purchase_rate}%.` });
  else insights.push({ type: 'warning', text: `Repeat purchase rate at ${kpis.repeat_purchase_rate}% - consider loyalty programs.` });
  if (kpis.cart_abandonment_rate > 70) insights.push({ type: 'negative', text: `High cart abandonment at ${kpis.cart_abandonment_rate}% - optimize checkout flow.` });
  else insights.push({ type: 'positive', text: `Cart abandonment at ${kpis.cart_abandonment_rate}% - within acceptable range.` });
  insights.push({ type: 'info', text: `Customer lifetime value is $${kpis.ltv.toLocaleString()}.` });
  insights.push({ type: 'info', text: `Average order value: $${kpis.aov.toLocaleString()}.` });
  return insights;
}

module.exports = {
  SYSTEM_PARAMETERS, DASHBOARD_PARAMS, B2B_PARAMS, B2C_PARAMS,
  getParametersForType, normalizeKey, buildAggregates, get,
  calcDashboardKPIs, calcB2BKPIs, calcB2CKPIs,
  calcDashboardCharts, calcB2BCharts, calcB2CCharts,
  calcB2BInsights, calcB2CInsights
};
