import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const POLL_MS = 30000;

/* ── shared chart option builders ── */
function mkLine(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12, weight: 500 }, usePointStyle: true, pointStyle: 'circle', padding: 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(10,14,26,0.96)', padding: 14, cornerRadius: 10,
        titleFont: { family: 'Inter', size: 13, weight: 700 }, bodyFont: { family: 'Inter', size: 12 },
        borderColor: 'rgba(99,102,241,0.25)', borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(148,163,184,0.05)' } },
      y: {
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: yFmt || (v => v.toLocaleString()) },
        grid: { color: 'rgba(148,163,184,0.05)' }
      }
    }
  };
}

function mkBar(opts = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700 },
    indexAxis: opts.horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10,14,26,0.96)', padding: 14, cornerRadius: 10,
        titleFont: { family: 'Inter', size: 13, weight: 700 }, bodyFont: { family: 'Inter', size: 12 }
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: opts.xFmt || (v => v) }, grid: { color: 'rgba(148,163,184,0.05)' } },
      y: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11, weight: 600 }, callback: opts.yFmt || (v => v) }, grid: { color: 'rgba(148,163,184,0.05)' } }
    }
  };
}

/* ── funnel colours ── */
const FUNNEL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];

export default function DashboardPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [updated, setUpdated]   = useState(null);
  const timer                   = useRef(null);

  const load = useCallback(async (init = false) => {
    try {
      const r = await api.getDashboard();
      setData(r);
      setUpdated(new Date());
    } catch (_) {}
    if (init) setLoading(false);
  }, []);

  useEffect(() => { load(true); timer.current = setInterval(() => load(), POLL_MS); return () => clearInterval(timer.current); }, [load]);

  /* ── loading ── */
  if (loading) return <div className="page"><div className="dash-loader"><div className="dash-spinner" /><p>Loading dashboard…</p></div></div>;

  /* ── no data ── */
  if (!data?.hasData) return (
    <div className="page">
      <div className="dash-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Marketing performance overview</p></div></div>
      <div className="dash-empty"><div className="dash-empty-icon">📊</div><h3>No data yet</h3><p>Upload a dataset in Settings to populate your dashboard</p></div>
    </div>
  );

  const { kpis, charts } = data;

  /* ── KPI cards ── */
  const cards = [
    { label: 'Revenue',         value: `$${(kpis.revenue || 0).toLocaleString()}`,      icon: '💰', g: 'g1' },
    { label: 'Blended ROI',     value: `${kpis.blended_roi || 0}%`,                     icon: '📈', g: 'g2' },
    { label: 'CAC',             value: `$${(kpis.cac || 0).toLocaleString()}`,          icon: '🎯', g: 'g3' },
    { label: 'Total Leads',     value: (kpis.total_leads || 0).toLocaleString(),        icon: '👥', g: 'g4' },
    { label: 'Conversion Rate', value: `${kpis.conversion_rate || 0}%`,                 icon: '🔄', g: 'g5' },
    { label: 'CPL',             value: `$${(kpis.cpl || 0).toLocaleString()}`,          icon: '📉', g: 'g2' },
  ];

  /* ── chart 1: Revenue Trend ── */
  const revTrend = charts.revenue_trend;
  const hasRev   = revTrend?.labels?.length > 0 && revTrend?.data?.length > 0;

  /* ── chart 2: CAC vs LTV ── */
  const cacLtv    = charts.cac_vs_ltv_trend;
  const hasCacLtv = cacLtv?.labels?.length > 0;

  /* ── chart 3: Conversion Funnel ── */
  const funnel = charts.conversion_funnel;
  const funnelStages = [
    { label: 'Leads',     value: funnel?.leads     || 0, color: FUNNEL_COLORS[0] },
    { label: 'MQLs',      value: funnel?.mqls      || 0, color: FUNNEL_COLORS[1] },
    { label: 'SQLs',      value: funnel?.sqls      || 0, color: FUNNEL_COLORS[2] },
    { label: 'Customers', value: funnel?.customers || 0, color: FUNNEL_COLORS[3] },
  ].filter(s => s.value > 0);
  const hasFunnel  = funnelStages.length >= 2;
  const maxFunnelV = hasFunnel ? funnelStages[0].value : 1;

  /* ── chart 4: Channel ROI ── */
  const chROI    = charts.channel_roi;
  const hasROI   = chROI?.labels?.length > 0 && chROI?.data?.length > 0;

  return (
    <div className="page">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Marketing performance overview</p>
        </div>
        {updated && (
          <div className="live-badge">
            <span className="live-dot" />
            Live · {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {cards.map((c, i) => (
          <div key={i} className={`kpi-card kpi-${c.g}`}>
            <span className="kpi-icon">{c.icon}</span>
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts 2×2 Grid */}
      <div className="chart-grid-2x2">

        {/* 1 — Revenue Trend */}
        {hasRev ? (
          <div className="ccard">
            <div className="ccard-title">📈 Revenue Trend</div>
            <div className="ccard-body">
              <Line
                data={{
                  labels: revTrend.labels,
                  datasets: [{
                    label: 'Revenue ($)',
                    data: revTrend.data,
                    borderColor: '#10b981',
                    backgroundColor: ctx => {
                      const ca = ctx.chart.chartArea;
                      if (!ca) return 'rgba(16,185,129,0.08)';
                      const g = ctx.chart.ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
                      g.addColorStop(0, 'rgba(16,185,129,0.22)');
                      g.addColorStop(1, 'rgba(16,185,129,0.01)');
                      return g;
                    },
                    fill: true, tension: 0.4, borderWidth: 2.5,
                    pointRadius: 4, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7
                  }]
                }}
                options={mkLine(v => '$' + v.toLocaleString())}
              />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>📈</span><p>Revenue trend data not available</p></div>}

        {/* 2 — CAC vs LTV */}
        {hasCacLtv ? (
          <div className="ccard">
            <div className="ccard-title">📉 CAC vs LTV</div>
            <div className="ccard-body">
              <Line
                data={{
                  labels: cacLtv.labels,
                  datasets: [
                    {
                      label: 'CAC ($)', data: cacLtv.cac_data,
                      borderColor: '#f59e0b', backgroundColor: 'transparent',
                      tension: 0.4, borderWidth: 2.5,
                      pointRadius: 4, pointBackgroundColor: '#f59e0b', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7
                    },
                    {
                      label: 'LTV ($)', data: cacLtv.ltv_data,
                      borderColor: '#10b981', backgroundColor: 'transparent',
                      tension: 0.4, borderWidth: 2.5,
                      pointRadius: 4, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7
                    }
                  ]
                }}
                options={mkLine(v => '$' + v.toLocaleString())}
              />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>📉</span><p>CAC / LTV data not available</p></div>}

        {/* 3 — Conversion Funnel */}
        {hasFunnel ? (
          <div className="ccard">
            <div className="ccard-title">🔻 Conversion Funnel</div>
            <div className="ccard-body funnel-body">
              <div className="funnel-wrap">
                {funnelStages.map((s, i) => {
                  const pct     = ((s.value / maxFunnelV) * 100).toFixed(1);
                  const dropPct = i > 0 && funnelStages[i - 1].value > 0
                    ? ((funnelStages[i - 1].value - s.value) / funnelStages[i - 1].value * 100).toFixed(1)
                    : null;
                  return (
                    <div key={i} className="fn-row" style={{ '--delay': `${i * 0.08}s` }}>
                      <div className="fn-meta">
                        <span className="fn-name">{s.label}</span>
                        <span className="fn-count">{s.value.toLocaleString()}</span>
                      </div>
                      <div className="fn-track">
                        <div className="fn-bar" style={{ width: `${Math.max(Number(pct), 5)}%`, background: s.color }} />
                      </div>
                      <div className="fn-right">
                        <span className="fn-pct">{pct}%</span>
                        {dropPct && <span className="fn-drop">▼{dropPct}%</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>🔻</span><p>Funnel data not available</p></div>}

        {/* 4 — Channel ROI */}
        {hasROI ? (
          <div className="ccard">
            <div className="ccard-title">📊 Channel ROI</div>
            <div className="ccard-body">
              <Bar
                data={{
                  labels: chROI.labels,
                  datasets: [{
                    label: 'ROI %',
                    data: chROI.data,
                    backgroundColor: chROI.labels.map((_, i) =>
                      ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#ef4444'][i % 7]
                    ),
                    borderRadius: 7, barThickness: 28
                  }]
                }}
                options={mkBar({ horizontal: true, xFmt: v => `${v}%` })}
              />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>📊</span><p>Channel ROI data not available</p></div>}

      </div>
    </div>
  );
}
