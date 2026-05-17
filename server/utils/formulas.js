/**
 * CMO Dashboard - KPI Formula Engine
 * All formulas are calculated server-side from raw dataset values.
 * No re-calculating, no duplication - single source of truth.
 */

// ============================================
// SYSTEM PARAMETERS (canonical keys)
// ============================================
const SYSTEM_PARAMETERS = [
  'PR / Media Revenue', 'PR / Media cost', 'Total Sales Cost', 'Total Marketing Cost',
  'Channel Cost', 'Gross Margin %', 'Revenue', 'Number of New Customers',
  'Attributed Revenue per Channel', 'Number of SQLs', 'Total Days to Close',
  'Number of Deals', 'Won Deals', 'Total Opportunities', 'Customers Lost',
  'Customers at Start of Period', 'AOV', 'Purchase Frequency', 'Customer Lifespan',
  'Repeat customer', 'Total Customers', 'Purchases Completed', 'Total Orders',
  'Channel leads', 'Carts Created', 'Leads', 'Number of MQLs', 'Deal Value',
  'Probability', 'Channel revenue', 'COGS(Cost of Goods Sold)', 'Price per unit', 'quantity'
];

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

// ============================================
// DASHBOARD KPIs
// ============================================
function calcDashboardKPIs(rows) {
  const { agg } = buildAggregates(rows);

  const channelRevenue = get(agg, 'Channel revenue', 'Channel Revenue');
  const prMediaRevenue = get(agg, 'PR / Media Revenue', 'PR Media Revenue');
  const resourceRevenue = get(agg, 'Resource revenue', 'Resource Revenue');
  const channelCost = get(agg, 'Channel Cost');
  const prMediaCost = get(agg, 'PR / Media cost', 'PR Media cost');

  const revenue = (channelRevenue + prMediaRevenue + resourceRevenue) - (channelCost + prMediaCost);
  const mktgCost = get(agg, 'Total Marketing Cost');
  const salesCost = get(agg, 'Total Sales Cost');
  const newCustomers = get(agg, 'Number of New Customers');
  const leads = get(agg, 'Leads');

  const roi = mktgCost !== 0 ? ((revenue - mktgCost) / mktgCost) : 0;
  const cac = newCustomers !== 0 ? ((salesCost + mktgCost) / newCustomers) : 0;
  const totalLeads = leads;
  const conversionRate = leads !== 0 ? ((newCustomers / leads) * 100) : 0;
  const cpl = leads !== 0 ? (mktgCost / leads) : 0;

  return {
    revenue: Math.round(revenue * 100) / 100,
    blended_roi: Math.round(roi * 10000) / 100,
    cac: Math.round(cac * 100) / 100,
    total_leads: Math.round(totalLeads),
    conversion_rate: Math.round(conversionRate * 100) / 100,
    cpl: Math.round(cpl * 100) / 100
  };
}

// ============================================
// B2B KPIs
// ============================================
function calcB2BKPIs(rows) {
  const { agg } = buildAggregates(rows);

  // Pipeline Value: first calc Deal Value = Price per unit * quantity, then pipeline = Σ(DealValue × Probability)
  // For aggregated data, we calculate per-row if possible
  let pipelineValue = 0;
  for (const row of rows) {
    const price = parseFloat(row['Price per unit'] || row['price per unit'] || 0);
    const qty = parseFloat(row['quantity'] || row['Quantity'] || 0);
    const prob = parseFloat(row['Probability'] || row['probability'] || 0);
    const dealVal = price * qty;
    pipelineValue += dealVal * (prob / 100);
  }
  // Fallback if Deal Value is provided directly
  if (pipelineValue === 0) {
    const dv = get(agg, 'Deal Value');
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
    pipeline_value: Math.round(pipelineValue * 100) / 100,
    mql_sql_conversion: Math.round(mqlSqlRate * 100) / 100,
    deal_velocity: Math.round(dealVelocity * 100) / 100,
    win_rate: Math.round(winRate * 100) / 100,
    churn_rate: Math.round(churnRate * 100) / 100
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
  const repeatCustomers = get(agg, 'Repeat customer', 'Repeat Customer', 'Repeat Customers');
  const cartsCreated = get(agg, 'Carts Created');
  const purchasesCompleted = get(agg, 'Purchases Completed');
  const customerLifespan = get(agg, 'Customer Lifespan');
  const cogs = get(agg, 'COGS Cost of Goods Sold', 'COGS', 'Cost of Goods Sold');

  // Step 1: AOV
  const aov = totalOrders !== 0 ? (revenue / totalOrders) : 0;

  // Step 2: Purchase Frequency
  const purchaseFreq = totalCustomers !== 0 ? (totalOrders / totalCustomers) : 0;

  // Step 3: Gross Margin %
  const grossMargin = revenue !== 0 ? (((revenue - cogs) / revenue) * 100) : 0;

  // Step 4: LTV = AOV × Purchase Frequency × Customer Lifespan × Gross Margin%
  const ltv = aov * purchaseFreq * customerLifespan * (grossMargin / 100);

  // Repeat Purchase Rate
  const repeatRate = totalCustomers !== 0 ? ((repeatCustomers / totalCustomers) * 100) : 0;

  // Cart Abandonment Rate
  const abandonRate = cartsCreated !== 0 ? (((cartsCreated - purchasesCompleted) / cartsCreated) * 100) : 0;

  return {
    ltv: Math.round(ltv * 100) / 100,
    repeat_purchase_rate: Math.round(repeatRate * 100) / 100,
    aov: Math.round(aov * 100) / 100,
    cart_abandonment_rate: Math.round(abandonRate * 100) / 100,
    purchase_frequency: Math.round(purchaseFreq * 100) / 100
  };
}

// ============================================
// MONTH ORDERING UTILITY
// ============================================
const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_ALIASES = {
  'january':'Jan','february':'Feb','march':'Mar','april':'Apr','may':'May','june':'Jun',
  'july':'Jul','august':'Aug','september':'Sep','october':'Oct','november':'Nov','december':'Dec',
  'jan':'Jan','feb':'Feb','mar':'Mar','apr':'Apr','may':'May','jun':'Jun',
  'jul':'Jul','aug':'Aug','sep':'Sep','oct':'Oct','nov':'Nov','dec':'Dec',
  '1':'Jan','2':'Feb','3':'Mar','4':'Apr','5':'May','6':'Jun',
  '7':'Jul','8':'Aug','9':'Sep','10':'Oct','11':'Nov','12':'Dec'
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
    revenue_trend: generateTrendFromRows(rows, ['Channel revenue', 'Revenue']),
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
  // Try per-channel trend; if no engagement columns exist, synthesize from MQL→SQL rate
  let engagement = generatePerChannelTrend(rows, ['engagement_score', 'Account Engagement Score', 'Number of MQLs']);
  if (!engagement) {
    engagement = generateTrendFromRows(rows, ['Number of MQLs', 'Number of SQLs']);
  }
  if (!engagement) {
    // Ultimate fallback: single KPI value
    engagement = { labels: ['Current'], data: [kpis.mql_sql_conversion || 0] };
  }
  return {
    cpl_by_channel: extractChannelData(rows, 'cpl'),
    engagement_trend: engagement
  };
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

    const mktgCost = get(pAgg, 'Total Marketing Cost');
    const salesCost = get(pAgg, 'Total Sales Cost');
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
    const ch = getChannel(row) || 'Unknown';
    if (!channels[ch]) channels[ch] = { revenue: 0, cost: 0, leads: 0 };
    channels[ch].revenue += parseFloat(row['Channel revenue'] || row['Revenue'] || 0);
    channels[ch].cost += parseFloat(row['Channel Cost'] || row['Total Marketing Cost'] || 0);
    channels[ch].leads += parseFloat(row['Channel leads'] || row['Leads'] || 0);
  }
  const labels = Object.keys(channels);
  let data;
  if (type === 'roi') {
    data = labels.map(ch => channels[ch].cost !== 0 ? ((channels[ch].revenue - channels[ch].cost) / channels[ch].cost) * 100 : 0);
  } else {
    data = labels.map(ch => channels[ch].leads !== 0 ? (channels[ch].cost / channels[ch].leads) : 0);
  }
  // Always return all channels — let frontend decide display
  return { labels, data: data.map(v => Math.round(v * 100) / 100) };
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
  SYSTEM_PARAMETERS, normalizeKey, buildAggregates, get,
  calcDashboardKPIs, calcB2BKPIs, calcB2CKPIs,
  calcDashboardCharts, calcB2BCharts, calcB2CCharts,
  calcB2BInsights, calcB2CInsights
};
