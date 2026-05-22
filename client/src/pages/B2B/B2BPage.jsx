import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend);

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

function mkBar(prefix = '') {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700 },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(10,14,26,0.96)', padding: 14, cornerRadius: 10, titleFont: { family: 'Inter', size: 13, weight: 700 }, bodyFont: { family: 'Inter', size: 12 }, callbacks: { label: ctx => `${prefix}${ctx.parsed.y?.toLocaleString() ?? ctx.parsed.x?.toLocaleString()}` } }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxRotation: 30 }, grid: { color: 'rgba(148,163,184,0.05)' } },
      y: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: v => `${prefix}${v.toLocaleString()}` }, grid: { color: 'rgba(148,163,184,0.05)' } }
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
        label: ds.channel,
        data: ds.data,
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: 'transparent',
        tension: 0.35, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: PALETTE[i % PALETTE.length], pointBorderColor: '#fff', pointBorderWidth: 1.5, pointHoverRadius: 6
      }))
    };
  }
  if (chartData.labels?.length > 0 && chartData.data?.some(v => v !== 0)) {
    return {
      labels: chartData.labels,
      datasets: [{
        label: 'Score', data: chartData.data,
        borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)',
        fill: true, tension: 0.4, borderWidth: 2.5,
        pointRadius: 4, pointBackgroundColor: '#8b5cf6', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7
      }]
    };
  }
  return null;
}

export default function B2BPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const timer                 = useRef(null);

  const load = useCallback(async (init = false) => {
    try { const r = await api.getB2B(); setData(r); setUpdated(new Date()); } catch (_) {}
    if (init) setLoading(false);
  }, []);

  useEffect(() => { load(true); timer.current = setInterval(() => load(), POLL_MS); return () => clearInterval(timer.current); }, [load]);

  if (loading) return <div className="page"><div className="dash-loader"><div className="dash-spinner" /><p>Loading B2B analytics…</p></div></div>;
  if (!data?.hasData) return (
    <div className="page">
      <div className="dash-header"><div><h1 className="page-title">B2B Analytics</h1><p className="page-subtitle">Business-to-business performance metrics</p></div></div>
      <div className="dash-empty"><div className="dash-empty-icon"><i className="bi bi-building-fill"></i></div><h3>No B2B data yet</h3><p>Upload a dataset in Settings to populate B2B analytics</p></div>
    </div>
  );

  const { kpis, charts, insights } = data;

  const kpiCards = [
    { label: 'Pipeline Value',  value: `$${(kpis.pipeline_value   || 0).toLocaleString()}`, icon: '💎', g: 'g1' },
    { label: 'MQL → SQL Rate',  value: `${kpis.mql_sql_conversion || 0}%`,                  icon: '🔄', g: 'g2' },
    { label: 'Deal Velocity',   value: `${kpis.deal_velocity       || 0} days`,              icon: '⚡', g: 'g3' },
    { label: 'Win Rate',        value: `${kpis.win_rate            || 0}%`,                  icon: '🏆', g: 'g4' },
    { label: 'Churn Rate',      value: `${kpis.churn_rate          || 0}%`,                  icon: '📉', g: 'g5' },
  ];

  /* CPL by Channel — bar */
  const cpl    = charts.cpl_by_channel;
  const hasCpl = cpl?.labels?.length > 0;
  const cplBarData = hasCpl ? {
    labels: cpl.labels,
    datasets: [{
      label: 'CPL ($)',
      data: cpl.data,
      backgroundColor: cpl.labels.map((_, i) => PALETTE[i % PALETTE.length]),
      borderRadius: 7, barThickness: 34
    }]
  } : null;

  /* Win Rate Trend — line */
  const wrt = charts.win_rate_trend;
  const hasWrt = wrt?.labels?.length > 0 && wrt?.data?.some(v => v !== 0);
  const winRateData = hasWrt ? {
    labels: wrt.labels,
    datasets: [{
      label: 'Win Rate (%)',
      data: wrt.data,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointRadius: 5,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverRadius: 7
    }]
  } : null;

  const winRateOpts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11, weight: 500 }, usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8 } },
      tooltip: { backgroundColor: 'rgba(10,14,26,0.96)', padding: 14, cornerRadius: 10, titleFont: { family: 'Inter', size: 13, weight: 700 }, bodyFont: { family: 'Inter', size: 12 }, callbacks: { label: ctx => `${ctx.parsed.y}%` } }
    },
    scales: {
      x: { title: { display: true, text: 'Month', color: '#94a3b8', font: { family: 'Inter', size: 12, weight: 600 } }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(148,163,184,0.05)' } },
      y: { title: { display: true, text: 'Win Rate (%)', color: '#94a3b8', font: { family: 'Inter', size: 12, weight: 600 } }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: v => `${v}%` }, grid: { color: 'rgba(148,163,184,0.05)' }, min: 0 }
    }
  };

  return (
    <div className="page">
      <div className="dash-header">
        <div><h1 className="page-title">B2B Analytics</h1><p className="page-subtitle">Business-to-business performance metrics</p></div>
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
        {/* CPL by Channel */}
        {cplBarData ? (
          <div className="ccard">
            <div className="ccard-title">💰 CPL by Channel</div>
            <div className="ccard-body">
              <Bar data={cplBarData} options={mkBar('$')} />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>💰</span><p>CPL channel data not available</p></div>}

        {/* Win Rate Trend */}
        {winRateData ? (
          <div className="ccard">
            <div className="ccard-title">🏆 Win Rate Trend</div>
            <div className="ccard-body">
              <Line data={winRateData} options={winRateOpts} />
            </div>
          </div>
        ) : <div className="ccard ccard-empty"><span>🏆</span><p>Win rate trend data not available</p></div>}
      </div>

      {insights?.length > 0 && (
        <div className="insights-section">
          <div className="insights-title"><><i className="bi bi-search"></i> Key Insights</></div>
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
