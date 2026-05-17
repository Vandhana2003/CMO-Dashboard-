import React, { useState } from 'react';
import { api } from '../../services/api';

export default function ReportPage() {
  const [type, setType] = useState('b2b');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try { const res = await api.getReport(type); setReport(res); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await api.downloadReport(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `report_${type}_${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Reports</h1><p className="page-subtitle">Generate and download analytics reports</p></div>
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">📄 Report Generator</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">Report Type</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="b2b">B2B (Dashboard + B2B)</option>
              <option value="b2c">B2C (Dashboard + B2C)</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>{loading ? 'Loading...' : 'Generate Report'}</button>
          <button className="btn btn-success" onClick={handleDownload} disabled={downloading}>{downloading ? 'Downloading...' : '⬇ Download Excel'}</button>
        </div>
      </div>
      {report?.hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="chart-card">
            <div className="chart-title">Dashboard KPIs</div>
            {Object.entries(report.dashboardKPIs).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{typeof v === 'number' ? v.toLocaleString() : v}</span>
              </div>
            ))}
          </div>
          <div className="chart-card">
            <div className="chart-title">{type.toUpperCase()} KPIs</div>
            {Object.entries(report.sectionKPIs).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{typeof v === 'number' ? v.toLocaleString() : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
