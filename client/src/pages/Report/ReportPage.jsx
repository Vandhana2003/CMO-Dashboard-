import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

const TIME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export default function ReportPage() {
  const [type, setType] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [channel, setChannel] = useState('all');
  const [timePeriod, setTimePeriod] = useState('all');
  const [channels, setChannels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState('');

  // Auto-detect type from Settings (persisted in localStorage or from dashboard)
  useEffect(() => {
    const stored = localStorage.getItem('cmo_data_type');
    if (stored) setType(stored);
    // Also try to get channels from dashboard
    api.getDashboard().then(r => {
      if (r.data_type) { setType(r.data_type); localStorage.setItem('cmo_data_type', r.data_type); }
      if (r.channels) setChannels(r.channels);
    }).catch(() => {});
  }, []);

  // Watch for type changes from settings
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem('cmo_data_type');
      if (stored && stored !== type) setType(stored);
    }, 2000);
    return () => clearInterval(interval);
  }, [type]);

  const fetchReport = async () => {
    if (!type) return;
    setLoading(true);
    try {
      const res = await api.getReport(type, channel, timePeriod);
      setReport(res);
      if (res.channels) setChannels(res.channels);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openDownloadModal = () => {
    const now = new Date();
    const defaultName = `${type?.toUpperCase()}_Report_${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    setFileName(defaultName);
    setShowModal(true);
  };

  const handleDownload = async () => {
    if (!fileName.trim()) return;
    setShowModal(false);
    setDownloading(true);
    try {
      const blob = await api.downloadReport(type, channel, timePeriod, fileName.trim());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.trim()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  };

  const typeLabel = type === 'b2b' ? 'B2B' : type === 'b2c' ? 'B2C' : '';
  const filterLabel = (channel !== 'all' ? channel : 'All Channels') + ' · ' + (TIME_OPTIONS.find(o => o.value === timePeriod)?.label || 'All Time');

  return (
    <div className="page">
      <div className="dash-header">
        <div>
          <h1 className="page-title">{typeLabel} Reports</h1>
          <p className="page-subtitle">Generate and download {typeLabel} analytics reports</p>
        </div>
        <div className="dash-filters">
          <select className="dash-filter-select" value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="all">All Channels</option>
            {channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>
          <select className="dash-filter-select" value={timePeriod} onChange={e => setTimePeriod(e.target.value)}>
            {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">📄 {typeLabel} Report Generator</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading || !type}>
            {loading ? 'Generating...' : '📊 Generate Report'}
          </button>
          <button className="btn btn-success" onClick={openDownloadModal} disabled={downloading || !type}>
            {downloading ? 'Downloading...' : '⬇ Download Report'}
          </button>
        </div>
      </div>

      {/* Report Preview */}
      {report?.hasData && (
        <>
          {/* Filter Details */}
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-title">🔍 Report Details</div>
            <div className="rpt-detail-grid">
              <div className="rpt-detail-item">
                <span className="rpt-detail-label">Dataset Type</span>
                <span className="rpt-detail-value">{(report.type || '').toUpperCase()}</span>
              </div>
              <div className="rpt-detail-item">
                <span className="rpt-detail-label">Channel</span>
                <span className="rpt-detail-value">{report.filters?.channel === 'all' ? 'All Channels' : report.filters?.channel}</span>
              </div>
              <div className="rpt-detail-item">
                <span className="rpt-detail-label">Time Period</span>
                <span className="rpt-detail-value">{TIME_OPTIONS.find(o => o.value === (report.filters?.time_period || 'all'))?.label}</span>
              </div>
              <div className="rpt-detail-item">
                <span className="rpt-detail-label">Generated</span>
                <span className="rpt-detail-value">{report.generated_at ? new Date(report.generated_at).toLocaleString() : '-'}</span>
              </div>
            </div>
          </div>

          {/* KPI Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="chart-card">
              <div className="chart-title">📈 Dashboard KPIs</div>
              {report.dashboardKPIs && Object.entries(report.dashboardKPIs).map(([k, v]) => (
                <div key={k} className="rpt-kpi-row">
                  <span className="rpt-kpi-label">{k.replace(/_/g, ' ')}</span>
                  <span className="rpt-kpi-value">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                </div>
              ))}
            </div>
            <div className="chart-card">
              <div className="chart-title">{typeLabel} KPIs</div>
              {report.sectionKPIs && Object.entries(report.sectionKPIs).map(([k, v]) => (
                <div key={k} className="rpt-kpi-row">
                  <span className="rpt-kpi-label">{k.replace(/_/g, ' ')}</span>
                  <span className="rpt-kpi-value">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Summary */}
          {report.chartSummary && Object.keys(report.chartSummary).length > 0 && (
            <div className="chart-card">
              <div className="chart-title">📊 Chart Data Summary</div>
              <div className="rpt-chart-summary">
                {Object.entries(report.chartSummary).map(([chart, data]) => (
                  <div key={chart} className="rpt-chart-block">
                    <div className="rpt-chart-name">{chart.replace(/_/g, ' ')}</div>
                    {typeof data === 'object' && !Array.isArray(data) ? (
                      <div className="rpt-chart-items">
                        {Object.entries(data).map(([k, v]) => (
                          <div key={k} className="rpt-kpi-row">
                            <span className="rpt-kpi-label">{k}</span>
                            <span className="rpt-kpi-value">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="rpt-kpi-value">{JSON.stringify(data)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {report && !report.hasData && (
        <div className="chart-card" style={{ textAlign: 'center', padding: 40 }}>
          <span style={{ fontSize: 48, opacity: 0.4 }}>📄</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No data available for the selected filters. Upload a dataset first.</p>
        </div>
      )}

      {/* Filename Modal */}
      {showModal && (
        <div className="rpt-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rpt-modal" onClick={e => e.stopPropagation()}>
            <div className="rpt-modal-title">📁 Enter File Name</div>
            <input
              className="rpt-modal-input"
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="Enter report file name..."
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleDownload(); }}
            />
            <p className="rpt-modal-hint">File will be saved as: <strong>{fileName.trim() || '...'}.xlsx</strong></p>
            <div className="rpt-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDownload} disabled={!fileName.trim()}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
