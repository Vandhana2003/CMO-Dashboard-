import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const POLL_MS = 30000;
const PALETTE = [
  '#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#ef4444',
  '#ec4899','#14b8a6','#f97316','#a855f7','#84cc16','#0ea5e9','#d946ef',
  '#22c55e','#eab308','#fb923c','#2dd4bf','#c084fc','#facc15','#4ade80',
  '#f43f5e','#38bdf8','#818cf8','#fb7185','#34d399','#fbbf24','#a3e635',
];

function mkLine(showLegend = true) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: showLegend, position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11, weight: 500 }, usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8 } },
      tooltip: { backgroundColor: 'rgba(10,14,26,0.96)', padding: 14, cornerRadius: 10, titleFont: { family: 'Inter', size: 13, weight: 700 }, bodyFont: { family: 'Inter', size: 12 } }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(148,163,184,0.05)' } },
      y: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(148,163,184,0.05)' } }
    }
  };
}

function buildMulti(chartData) {
  if (!chartData) return null;
  if (chartData.multiSeries && chartData.datasets?.length > 0) {
    const valid = chartData.datasets.filter(ds => ds.data.some(v => v !== 0));
    if (!valid.length) return null;
    return {
      labels: chartData.labels,
      datasets: valid.map((ds, i) => ({
        label: ds.channel, data: ds.data,
        borderColor: PALETTE[i % PALETTE.length], backgroundColor: 'transparent',
        tension: 0.35, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: PALETTE[i % PALETTE.length], pointBorderColor: '#fff', pointBorderWidth: 1.5, pointHoverRadius: 6
      }))
    };
  }
  if (chartData.labels?.length > 0 && chartData.data?.some(v => v !== 0)) {
    return {
      labels: chartData.labels,
      datasets: [{
        label: 'Rate (%)', data: chartData.data,
        borderColor: '#10b981', backgroundColor: ctx => {
          const ca = ctx.chart.chartArea; if (!ca) return 'rgba(16,185,129,0.08)';
          const g = ctx.chart.ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
          g.addColorStop(0, 'rgba(16,185,129,0.22)'); g.addColorStop(1, 'rgba(16,185,129,0.01)'); return g;
        },
        fill: true, tension: 0.4, borderWidth: 2.5,
        pointRadius: 4, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7
      }]
    };
  }
  return null;
}

export default function B2CPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const timer                 = useRef(null);

  const load = useCallback(async (init = false) => {
    try { const r = await api.getB2C(); setData(r); setUpdated(new Date()); } catch (_) {}
    if (init) setLoading(false);
  }, []);

  useEffect(() => { load(true); timer.current = setInterval(() => load(), POLL_MS); return () => clearInterval(timer.current); }, [load]);

  if (loading) return <div className="page"><div className="dash-loader"><div className="dash-spinner" /><p>Loading B2C analytics…</p></div></div>;
  if (!data?.hasData) return (
    <div className="page">
      <div className="dash-header"><div><h1 className="page-title">B2C Analytics</h1><p className="page-subtitle">Consumer performance metrics</p></div></div>
      <div className="dash-empty"><div className="dash-empty-icon">🛒</div><h3>No B2C data yet</h3><p>Upload a dataset in Settings to populate B2C analytics</p></div>
    </div>
  );

  const { kpis, charts, insights } = data;

  const kpiCards = [
    { label: 'Lifetime Value (LTV)',   value: `$${(kpis.ltv                 || 0).toLocaleString()}`, icon: '💎', g: 'g1' },
    { label: 'Repeat Purchase Rate',  value: `${kpis.repeat_purchase_rate  || 0}%`,                  icon: '🔁', g: 'g2' },
    { label: 'Avg Order Value',       value: `$${(kpis.aov                 || 0).toLocaleString()}`, icon: '🛍️', g: 'g3' },
    { label: 'Cart Abandonment',      value: `${kpis.cart_abandonment_rate || 0}%`,                  icon: '🛒', g: 'g4' },
    { label: 'Purchase Frequency',    value: `${kpis.purchase_frequency    || 0}x`,                  icon: '📊', g: 'g5' },
  ];

  /* Repeat Purchase Trend */
  const repeatData = buildMulti(charts.repeat_purchase_trend);

  /* Cart Abandonment Funnel */
  const cartF        = charts.cart_abandonment_funnel;
  const cartsCreated = cartF?.carts_created    || 0;
  const purchased    = cartF?.purchases_completed || 0;
  const abandoned    = cartsCreated - purchased;
  const abandonPct   = cartsCreated > 0 ? ((abandoned / cartsCreated) * 100).toFixed(1) : '0.0';
  const purchasePct  = cartsCreated > 0 ? ((purchased / cartsCreated) * 100).toFixed(1) : '0.0';
  const hasCartFunnel = cartsCreated > 0;

  /* trapezoid widths: 100% → purchasePct% → abandonPct% (min 25%) */
  const w2 = cartsCreated > 0 ? Math.max((purchased / cartsCreated) * 100, 25) : 60;
  const w3 = cartsCreated > 0 ? Math.max((abandoned / cartsCreated) * 100, 18) : 40;

  return (
    <div className="page">
      <div className="dash-header">
        <div><h1 className="page-title">B2C Analytics</h1><p className="page-subtitle">Consumer performance metrics</p></div>
        {updated && <div className="live-badge"><span className="live-dot" />Live · {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
      </div>

      <div className="kpi-grid">
        {kpiCards.map((c, i) => (
          <div key={i} className={`kpi-card kpi-${c.g}`}>
            <span className="kpi-icon">{c.icon}</span>
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="chart-grid-2x2">
        {/* 8 — Repeat Purchase Trend */}
        {repeatData ? (
          <div className="ccard">
            <div className="ccard-title">🔁 Repeat Purchase Rate Trend</div>
            <div className="ccard-body">
              <Line data={repeatData} options={mkLine(true)} />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>🔁</span><p>Repeat purchase data not available</p></div>}

        {/* 7 — Cart Abandonment Funnel */}
        {hasCartFunnel ? (
          <div className="ccard">
            <div className="ccard-title">🛒 Cart Abandonment Rate</div>
            <div className="ccard-body trap-body">
              <div className="trap-funnel">
                {/* Stage 1 – Carts Created */}
                <div className="trap-row" style={{ '--w': '100%', '--delay': '0s' }}>
                  <div className="trap-seg" style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)' }}>
                    <span className="trap-lbl">Carts Created</span>
                    <span className="trap-val">{cartsCreated.toLocaleString()}</span>
                  </div>
                </div>
                {/* Stage 2 – Purchases Completed */}
                <div className="trap-row" style={{ '--w': `${w2}%`, '--delay': '0.1s' }}>
                  <div className="trap-seg" style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}>
                    <span className="trap-lbl">Purchases Completed</span>
                    <span className="trap-val">{purchased.toLocaleString()}</span>
                  </div>
                </div>
                {/* Stage 3 – Abandoned */}
                <div className="trap-row" style={{ '--w': `${w3}%`, '--delay': '0.2s' }}>
                  <div className="trap-seg" style={{ background: 'linear-gradient(135deg,#ef4444,#f87171)' }}>
                    <span className="trap-lbl">Abandoned</span>
                    <span className="trap-val">{abandoned.toLocaleString()}</span>
                  </div>
                </div>
                <div className="trap-stat">
                  <span className="trap-stat-item" style={{ color: '#ef4444' }}>Abandonment Rate: <b>{abandonPct}%</b></span>
                  <span className="trap-stat-sep">·</span>
                  <span className="trap-stat-item" style={{ color: '#10b981' }}>Completed: <b>{purchasePct}%</b></span>
                </div>
              </div>
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>🛒</span><p>Cart abandonment data not available</p></div>}
      </div>

      {insights?.length > 0 && (
        <div className="insights-section">
          <div className="insights-title">🔍 Key Insights</div>
          {insights.map((ins, i) => (
            <div key={i} className={`insight-item ${ins.type}`}>
              <div className="insight-dot" /><span>{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
