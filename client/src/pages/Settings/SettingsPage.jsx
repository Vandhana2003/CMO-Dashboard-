import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';

export default function SettingsPage() {
  const [tab, setTab] = useState('excel');
  const [datasets, setDatasets] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [excelColumns, setExcelColumns] = useState([]);
  const [selectedDs, setSelectedDs] = useState(null);
  const [sysParams, setSysParams] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [appending, setAppending] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [apiForm, setApiForm] = useState({ name: '', endpoint_url: '', method: 'GET', auth_type: 'none' });
  const [integrations, setIntegrations] = useState([]);
  const [toast, setToast] = useState(null);
  const [fetchingApiId, setFetchingApiId] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const fileRef = useRef(null);
  const appendRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api.getSystemParams().then(res => setSysParams(res.parameters)).catch(() => { });
    api.getDatasets().then(res => setDatasets(res.datasets)).catch(() => { });
    api.getApiIntegrations().then(res => setIntegrations(res.integrations)).catch(() => { });
  }, []);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.uploadExcel(formData);
      showToast(`${res.uploads.length} file(s) uploaded successfully`, 'success');
      const dsRes = await api.getDatasets();
      setDatasets(dsRes.datasets);
      if (res.uploads.length > 0) { setSelectedDs(res.uploads[0].dataset_id); loadMappings(res.uploads[0].dataset_id); }
    } catch (e) { showToast(e.message, 'error'); }
    setUploading(false);
  };

  const handleAppend = async (files) => {
    if (!files || files.length === 0 || !selectedDs) return;
    setAppending(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.appendToDataset(selectedDs, formData);
      showToast(`${res.appended.length} file(s) appended. Headers merged.`, 'success');
      const dsRes = await api.getDatasets();
      setDatasets(dsRes.datasets);
      loadMappings(selectedDs);
    } catch (e) { showToast(e.message, 'error'); }
    setAppending(false);
  };

  const loadMappings = async (dsId) => {
    try {
      const res = await api.getMappings(dsId);
      setMappings(res.mappings);
      setExcelColumns(res.excel_columns || []);
      setSelectedDs(dsId);
      setValidationResult(null);
    } catch (e) { console.error(e); }
  };

  const updateMapping = async (id, excelCol) => {
    try {
      const matchStatus = excelCol ? 'manual' : 'missing';
      await api.updateMapping(id, { excel_column: excelCol, match_status: matchStatus });
      setMappings(prev => prev.map(m =>
        m.id === id ? { ...m, source_column: excelCol || '', match_status: matchStatus } : m
      ));
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleValidate = async () => {
    if (!selectedDs) return;
    try { const res = await api.validateDataset(selectedDs); setValidationResult(res); showToast(res.valid ? 'Validation passed!' : 'Validation has warnings', res.valid ? 'success' : 'error'); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDownloadMapped = async () => {
    if (!selectedDs) return;
    try { const blob = await api.downloadMapped(selectedDs); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mapped_${Date.now()}.xlsx`; a.click(); URL.revokeObjectURL(url); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleSaveProceed = async () => {
    if (!selectedDs) return;
    try { await api.saveAndProceed(selectedDs); showToast('Dataset activated! KPIs calculated.', 'success'); const dsRes = await api.getDatasets(); setDatasets(dsRes.datasets); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDeleteDs = async (id) => {
    try { await api.deleteDataset(id); setDatasets(prev => prev.filter(d => d.id !== id)); if (selectedDs === id) { setSelectedDs(null); setMappings([]); setExcelColumns([]); } showToast('Dataset removed', 'info'); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleFetchApi = async (integrationId) => {
    setFetchingApiId(integrationId);
    try {
      const res = await api.fetchApiIntegration(integrationId);
      showToast(`✅ Fetched ${res.rowCount} records. Dashboard updated!`, 'success');
      // Refresh datasets list so the new API-sourced dataset appears
      const dsRes = await api.getDatasets();
      setDatasets(dsRes.datasets);
    } catch (e) {
      showToast(`Fetch failed: ${e.message}`, 'error');
    }
    setFetchingApiId(null);
  };

  const handleSaveApi = async () => {
    try { const res = await api.saveApiIntegration(apiForm); setIntegrations(prev => [res.integration, ...prev]); setApiForm({ name: '', endpoint_url: '', method: 'GET', auth_type: 'none' }); showToast('API integration saved', 'success'); } catch (e) { showToast(e.message, 'error'); }
  };

  const onDrop = useCallback((e) => { e.preventDefault(); e.currentTarget.classList.remove('active'); handleUpload(e.dataTransfer.files); }, []);

  // Count mapping stats
  const mappedCount = mappings.filter(m => m.source_column && m.source_column.trim() !== '').length;
  const unmappedCount = mappings.length - mappedCount;
  const autoCount = mappings.filter(m => m.match_status === 'auto' && m.source_column && m.source_column.trim() !== '').length;
  const manualCount = mappings.filter(m => m.match_status === 'manual' && m.source_column && m.source_column.trim() !== '').length;

  // Filter mappings for search
  const filteredMappings = mappings.filter(m =>
    !searchFilter ||
    m.system_parameter?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    m.source_column?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Helper: get display label for a status
  const getStatusInfo = (m) => {
    const hasSrc = m.source_column && m.source_column.trim() !== '';
    if (!hasSrc) return { label: 'Not Mapped', className: 'badge-missing' };
    if (m.match_status === 'auto') return { label: 'Auto Matched', className: 'badge-auto' };
    return { label: 'Manual', className: 'badge-manual' };
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Settings</h1><p className="page-subtitle">Data integration & configuration</p></div>
      <div className="tabs">
        <button className={`tab ${tab === 'excel' ? 'active' : ''}`} onClick={() => setTab('excel')}>📄 Excel Import</button>
        <button className={`tab ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>🔗 API Integration</button>
      </div>

      {tab === 'excel' && (
        <>
          <div className="dropzone" onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active'); }} onDragLeave={e => e.currentTarget.classList.remove('active')} onDrop={onDrop}>
            <div className="dropzone-icon">📁</div>
            <div className="dropzone-text">{uploading ? 'Uploading...' : 'Drag & drop Excel files here or click to browse'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Supports .xlsx, .xls, .csv • Multiple files allowed</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple hidden onChange={e => handleUpload(e.target.files)} />
          </div>

          {datasets.length > 0 && (
            <div className="chart-card" style={{ marginTop: 16 }}>
              <div className="chart-title">📦 Imported Datasets</div>
              {datasets.map(ds => (
                <div key={ds.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><span style={{ fontWeight: 500 }}>{ds.original_name || ds.file_name}</span><span className={`badge ${ds.status === 'active' ? 'badge-auto' : 'badge-manual'}`} style={{ marginLeft: 8 }}>{ds.status}</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => loadMappings(ds.id)}>Map</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteDs(ds.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDs && mappings.length > 0 && (
            <div className="chart-card mapper-card" style={{ marginTop: 16 }}>
              {/* Mapper Header */}
              <div className="mapper-header">
                <div className="mapper-header-left">
                  <div className="chart-title" style={{ marginBottom: 0 }}>🗺️ Column Mapper</div>
                  <div className="mapper-stats">
                    <span className="mapper-stat stat-mapped">
                      <span className="stat-dot dot-mapped"></span>
                      {mappedCount} mapped
                    </span>
                    <span className="mapper-stat stat-auto">
                      <span className="stat-dot dot-auto"></span>
                      {autoCount} auto
                    </span>
                    <span className="mapper-stat stat-manual-stat">
                      <span className="stat-dot dot-manual"></span>
                      {manualCount} manual
                    </span>
                    <span className="mapper-stat stat-unmapped">
                      <span className="stat-dot dot-unmapped"></span>
                      {unmappedCount} unmapped
                    </span>
                  </div>
                </div>
                <div className="mapper-header-right">
                  <button className="btn btn-sm btn-add-file" onClick={() => appendRef.current?.click()} disabled={appending}>
                    {appending ? '⏳ Adding...' : '➕ Add More Files'}
                  </button>
                  <input ref={appendRef} type="file" accept=".xlsx,.xls,.csv" multiple hidden onChange={e => handleAppend(e.target.files)} />
                </div>
              </div>

              {/* Info banner */}
              <div className="mapper-info-banner">
                <span>💡</span>
                <span>System parameters are <strong>fixed</strong>. Select the matching Excel column from each dropdown. Auto-matched columns are pre-selected — override manually if needed.</span>
              </div>

              {/* Search/Filter */}
              <div className="mapper-search">
                <input
                  className="form-input mapper-search-input"
                  placeholder="🔍 Search parameters..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                />
              </div>

              {/* Column Headers */}
              <div className="mapper-row mapper-row-header">
                <span>#</span>
                <span>System Parameter (Fixed)</span>
                <span>Excel Column (Select from Dropdown)</span>
                <span>Status</span>
              </div>

              {/* Mapping Rows */}
              <div className="mapper-body">
                {filteredMappings.map((m, idx) => {
                  const statusInfo = getStatusInfo(m);
                  const hasSrc = m.source_column && m.source_column.trim() !== '';
                  return (
                    <div key={m.id} className={`mapper-row ${hasSrc ? 'mapped' : 'unmapped-row'}`}>
                      <div className="mapper-index">{idx + 1}</div>
                      <div className="mapper-label">
                        <span className="mapper-param-name">{m.system_parameter}</span>
                      </div>
                      <div className="mapper-dropdown-cell">
                        <select
                          className={`form-select mapper-select ${hasSrc ? 'mapper-select-mapped' : 'mapper-select-empty'}`}
                          value={m.source_column || ''}
                          onChange={e => updateMapping(m.id, e.target.value)}
                        >
                          <option value="">— Select Excel Column —</option>
                          {excelColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        {hasSrc && (
                          <button
                            className="mapper-clear-btn"
                            onClick={() => updateMapping(m.id, '')}
                            title="Clear mapping"
                          >✕</button>
                        )}
                      </div>
                      <div className="mapper-status-cell">
                        <span className={`badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: validationResult.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{validationResult.valid ? '✅ Validation Passed' : '⚠️ Validation Issues'}</div>
                  <div style={{ fontSize: 13 }}>Mapped: {validationResult.mapped_count} | Missing: {validationResult.missing_count}</div>
                  {validationResult.issues?.map((iss, i) => <div key={i} style={{ fontSize: 13, color: iss.level === 'error' ? 'var(--danger)' : 'var(--warning)', marginTop: 4 }}>{iss.message}</div>)}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mapper-actions">
                <button className="btn btn-primary" onClick={handleValidate}>✓ Validate</button>
                <button className="btn btn-secondary" onClick={handleDownloadMapped}>⬇ Download Mapped Excel</button>
                <button className="btn btn-success" onClick={handleSaveProceed}>💾 Save & Calculate KPIs</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'api' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-title">➕ Add API Integration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="My API" value={apiForm.name} onChange={e => setApiForm({ ...apiForm, name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Endpoint URL</label><input className="form-input" placeholder="https://api.example.com/data" value={apiForm.endpoint_url} onChange={e => setApiForm({ ...apiForm, endpoint_url: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Method</label><select className="form-select" value={apiForm.method} onChange={e => setApiForm({ ...apiForm, method: e.target.value })}><option>GET</option><option>POST</option><option>PUT</option></select></div>
              <div className="form-group"><label className="form-label">Auth Type</label><select className="form-select" value={apiForm.auth_type} onChange={e => setApiForm({ ...apiForm, auth_type: e.target.value })}><option value="none">None</option><option value="bearer">Bearer Token</option><option value="api_key">API Key</option><option value="basic">Basic Auth</option></select></div>
            </div>
            <button className="btn btn-primary" onClick={handleSaveApi} style={{ marginTop: 12 }}>Save Integration</button>
          </div>
          {integrations.length > 0 && (
            <div className="chart-card">
              <div className="chart-title">🔗 Saved Integrations</div>
              {integrations.map(ig => (
                <div key={ig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{ig.name}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{ig.endpoint_url}</span>
                    {ig.last_synced_at && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                        Last synced: {new Date(ig.last_synced_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge badge-auto">{ig.method}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleFetchApi(ig.id)}
                      disabled={fetchingApiId === ig.id}
                    >
                      {fetchingApiId === ig.id ? '⏳ Fetching...' : '⚡ Fetch & Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}