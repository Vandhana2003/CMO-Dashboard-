import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const OPERATORS = ['+', '-', '*', '/', '(', ')'];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('excel');
  const [datasets, setDatasets] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [excelColumns, setExcelColumns] = useState([]);
  const [selectedDs, setSelectedDs] = useState(null);
  const [sysParams, setSysParams] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [appending, setAppending] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [dataType, setDataType] = useState(null); // 'b2b' or 'b2c'
  const [extraDropdownOpen, setExtraDropdownOpen] = useState(null);
  const [integrating, setIntegrating] = useState(false);
  const [customParams, setCustomParams] = useState([{ name: '', formula: [{ type: 'param', value: '' }], result: null, saved: false }]);
  const [calculating, setCalculating] = useState(null);
  const [saving, setSaving] = useState(null);
  const [allExcelCols, setAllExcelCols] = useState([]);
  const fileRef = useRef(null);
  const appendRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api.getDatasets().then(res => setDatasets(res.datasets)).catch(() => { });
  }, []);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleSelectDataType = (type) => {
    setDataType(type);
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    if (!dataType) {
      showToast('Please select B2B or B2C before uploading', 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    formData.append('data_type', dataType);
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
      if (res.data_type) setDataType(res.data_type);
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

  const addExtraColumn = async (mappingId, extraCol) => {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) return;
    const currentExtras = mapping.extra_columns || [];
    if (currentExtras.includes(extraCol)) return; // already added
    const newExtras = [...currentExtras, extraCol];
    try {
      await api.updateMapping(mappingId, {
        excel_column: mapping.source_column,
        match_status: mapping.source_column ? mapping.match_status : 'missing',
        extra_columns: newExtras
      });
      setMappings(prev => prev.map(m =>
        m.id === mappingId ? { ...m, extra_columns: newExtras } : m
      ));
    } catch (e) { showToast(e.message, 'error'); }
    setExtraDropdownOpen(null);
  };

  const removeExtraColumn = async (mappingId, extraCol) => {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) return;
    const newExtras = (mapping.extra_columns || []).filter(c => c !== extraCol);
    try {
      await api.updateMapping(mappingId, {
        excel_column: mapping.source_column,
        match_status: mapping.source_column ? mapping.match_status : 'missing',
        extra_columns: newExtras
      });
      setMappings(prev => prev.map(m =>
        m.id === mappingId ? { ...m, extra_columns: newExtras } : m
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

    try {
      let respon = await api.saveAndProceed(selectedDs);

      showToast(respon.message, 'success');

      // store selected datatype
      localStorage.setItem('cmo_data_type', respon.data_type);

      const dsRes = await api.getDatasets();
      setDatasets(dsRes.datasets);

      // navigate only to dashboard
      navigate('/dashboard');

    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteDs = async (id) => {
    try { await api.deleteDataset(id); setDatasets(prev => prev.filter(d => d.id !== id)); if (selectedDs === id) { setSelectedDs(null); setMappings([]); setExcelColumns([]); } showToast('Dataset removed', 'info'); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleIntegrateApi = async () => {
    setIntegrating(true);
    try {
      const res = await api.integrateApi();
      sessionStorage.setItem('totalCount', JSON.stringify(res.totalCount));
      showToast(`✅ ${res.message || 'API integrated successfully. Dashboard updated!'}`, 'success');
      // const dsRes = await api.getDatasets();
      // setDatasets(dsRes.datasets);
      // Auto-navigate to dashboard after short delay
      setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
    } catch (e) {
      showToast(`Integration failed: ${e.message}`, 'error');
    }
    setIntegrating(false);
  };

  // Load excel columns for custom param builder
  useEffect(() => {
    if (tab === 'params') {
      const activeDs = datasets.find(d => d.status === 'active');
      if (activeDs) {
        api.getMappings(activeDs.id).then(res => setAllExcelCols(res.excel_columns || [])).catch(() => { });
      }
    }
  }, [tab, datasets]);

  const addFormulaItem = (cpIdx) => {
    setCustomParams(prev => {
      const cp = [...prev];
      const f = [...cp[cpIdx].formula];
      const lastItem = f[f.length - 1];
      if (lastItem.type === 'param' && lastItem.value) {
        f.push({ type: 'op', value: '+' });
        f.push({ type: 'param', value: '' });
      }
      cp[cpIdx] = { ...cp[cpIdx], formula: f, result: null, saved: false };
      return cp;
    });
  };

  const updateFormulaItem = (cpIdx, fIdx, value) => {
    setCustomParams(prev => {
      const cp = [...prev];
      const f = [...cp[cpIdx].formula];
      f[fIdx] = { ...f[fIdx], value };
      cp[cpIdx] = { ...cp[cpIdx], formula: f, result: null, saved: false };
      return cp;
    });
  };

  const removeFormulaRow = (cpIdx, fIdx) => {
    setCustomParams(prev => {
      const cp = [...prev];
      let f = [...cp[cpIdx].formula];
      if (fIdx > 0 && f[fIdx - 1]?.type === 'op') {
        f.splice(fIdx - 1, 2);
      } else if (fIdx === 0 && f.length > 1 && f[1]?.type === 'op') {
        f.splice(0, 2);
      } else {
        f.splice(fIdx, 1);
      }
      if (f.length === 0) f = [{ type: 'param', value: '' }];
      cp[cpIdx] = { ...cp[cpIdx], formula: f, result: null, saved: false };
      return cp;
    });
  };

  const handleCalculate = async (cpIdx) => {
    const cp = customParams[cpIdx];
    const validFormula = cp.formula.filter(f => f.type === 'op' || (f.type === 'param' && f.value));
    if (validFormula.length === 0) { showToast('Add at least one parameter', 'error'); return; }
    setCalculating(cpIdx);
    try {
      const res = await api.calculateCustomParam(validFormula);
      setCustomParams(prev => { const cp2 = [...prev]; cp2[cpIdx] = { ...cp2[cpIdx], result: res.result }; return cp2; });
      showToast(`Calculated: ${res.result}`, 'success');
    } catch (e) { showToast(e.message || 'Calculation failed', 'error'); }
    setCalculating(null);
  };

  const handleSaveParam = async (cpIdx) => {
    const cp = customParams[cpIdx];
    if (!cp.name.trim()) { showToast('Enter parameter name', 'error'); return; }
    if (cp.result === null) { showToast('Calculate first', 'error'); return; }
    setSaving(cpIdx);
    try {
      const validFormula = cp.formula.filter(f => f.type === 'op' || (f.type === 'param' && f.value));
      await api.saveCustomParam(cp.name.trim(), validFormula, cp.result);
      setCustomParams(prev => { const cp2 = [...prev]; cp2[cpIdx] = { ...cp2[cpIdx], saved: true }; return cp2; });
      setAllExcelCols(prev => prev.includes(cp.name.trim()) ? prev : [...prev, cp.name.trim()]);
      showToast(`"${cp.name.trim()}" saved to dataset!`, 'success');
    } catch (e) { showToast(e.message || 'Save failed', 'error'); }
    setSaving(null);
  };

  const addCustomParam = () => {
    setCustomParams(prev => [...prev, { name: '', formula: [{ type: 'param', value: '' }], result: null, saved: false }]);
  };

  const handleGoogleAdsConnect = () => {
    showToast('Google Ads OAuth: Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server .env to enable', 'info');
    // TODO: window.location.href = '/api/settings/google-ads/auth' when OAuth is configured
  };

  const onDrop = useCallback((e) => { e.preventDefault(); e.currentTarget.classList.remove('active'); handleUpload(e.dataTransfer.files); }, [dataType]);

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

  // Get available extra columns for a mapping (exclude already selected main + extras)
  const getAvailableExtras = (mapping) => {
    const used = new Set();
    if (mapping.source_column) used.add(mapping.source_column);
    if (mapping.extra_columns) mapping.extra_columns.forEach(c => used.add(c));
    return excelColumns.filter(c => !used.has(c));
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Settings</h1><p className="page-subtitle">Data integration & configuration</p></div>
      <div className="tabs">
        <button className={`tab ${tab === 'excel' ? 'active' : ''}`} onClick={() => setTab('excel')}>📄 Excel Import</button>
        <button className={`tab ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>🔗 API Integration</button>
        <button className={`tab ${tab === 'params' ? 'active' : ''}`} onClick={() => setTab('params')}>🧮 Multiple Parameter</button>
        <button className={`tab ${tab === 'gads' ? 'active' : ''}`} onClick={() => setTab('gads')}>📊 Google Ads Connector</button>
      </div>

      {tab === 'excel' && (
        <>
          {/* B2B / B2C Selector */}
          <div className="data-type-selector">
            <div className="data-type-label">Select Data Type Before Import</div>
            <div className="data-type-buttons">
              <button
                className={`data-type-btn ${dataType === 'b2b' ? 'active b2b' : ''}`}
                onClick={() => handleSelectDataType('b2b')}
              >
                <span className="data-type-icon">🏢</span>
                <span className="data-type-text">B2B</span>
                <span className="data-type-desc">Business-to-Business</span>
              </button>
              <button
                className={`data-type-btn ${dataType === 'b2c' ? 'active b2c' : ''}`}
                onClick={() => handleSelectDataType('b2c')}
              >
                <span className="data-type-icon">🛒</span>
                <span className="data-type-text">B2C</span>
                <span className="data-type-desc">Business-to-Consumer</span>
              </button>
            </div>
          </div>

          {/* Dropzone — only enabled after type selection */}
          <div
            className={`dropzone ${!dataType ? 'dropzone-disabled' : ''}`}
            onClick={() => { if (dataType) fileRef.current?.click(); else showToast('Select B2B or B2C first', 'error'); }}
            onDragOver={e => { e.preventDefault(); if (dataType) e.currentTarget.classList.add('active'); }}
            onDragLeave={e => e.currentTarget.classList.remove('active')}
            onDrop={onDrop}
          >
            <div className="dropzone-icon">📁</div>
            <div className="dropzone-text">{uploading ? 'Uploading...' : !dataType ? 'Select B2B or B2C above first' : 'Drag & drop Excel files here or click to browse'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Supports .xlsx, .xls, .csv • Multiple files allowed</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple hidden onChange={e => handleUpload(e.target.files)} />
          </div>

          {datasets.length > 0 && (
            <div className="chart-card" style={{ marginTop: 16 }}>
              <div className="chart-title">📦 Imported Datasets</div>
              {datasets.map(ds => (
                <div key={ds.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{ds.original_name || ds.file_name}</span>
                    <span className={`badge ${ds.status === 'active' ? 'badge-auto' : 'badge-manual'}`} style={{ marginLeft: 8 }}>{ds.status}</span>
                    {ds.data_type && (
                      <span className={`badge ${ds.data_type === 'b2b' ? 'badge-b2b' : 'badge-b2c'}`} style={{ marginLeft: 6 }}>
                        {ds.data_type.toUpperCase()}
                      </span>
                    )}
                  </div>
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
                  <div className="chart-title" style={{ marginBottom: 0 }}>🗺️ Column Mapper {dataType && <span className={`badge ${dataType === 'b2b' ? 'badge-b2b' : 'badge-b2c'}`} style={{ marginLeft: 8 }}>{dataType.toUpperCase()}</span>}</div>
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
                <span>System parameters are <strong>fixed</strong> (Dashboard + {dataType ? dataType.toUpperCase() : 'All'}). Select the matching Excel column from each dropdown. Use the <strong>+</strong> button to add extra columns that contribute to the same parameter.</span>
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
                  const extras = m.extra_columns || [];
                  const availableExtras = getAvailableExtras(m);
                  return (
                    <div key={m.id} className={`mapper-row ${hasSrc ? 'mapped' : 'unmapped-row'}`}>
                      <div className="mapper-index">{idx + 1}</div>
                      <div className="mapper-label">
                        <span className="mapper-param-name">{m.system_parameter}</span>
                      </div>
                      <div className="mapper-dropdown-cell">
                        <div className="mapper-dropdown-row">
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
                          {/* "+" button for extra columns */}
                          <div className="extra-col-wrapper">
                            <button
                              className="extra-col-btn"
                              onClick={() => setExtraDropdownOpen(extraDropdownOpen === m.id ? null : m.id)}
                              title="Add extra Excel column"
                            >+</button>
                            {extraDropdownOpen === m.id && (
                              <div className="extra-col-dropdown">
                                <div className="extra-col-dropdown-title">Add Extra Column</div>
                                {availableExtras.length === 0 ? (
                                  <div className="extra-col-dropdown-empty">No more columns</div>
                                ) : (
                                  availableExtras.map(col => (
                                    <button key={col} className="extra-col-dropdown-item" onClick={() => addExtraColumn(m.id, col)}>
                                      {col}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Extra column tags */}
                        {extras.length > 0 && (
                          <div className="extra-col-tags">
                            {extras.map(ec => (
                              <span key={ec} className="extra-col-tag">
                                + {ec}
                                <button className="extra-col-tag-remove" onClick={() => removeExtraColumn(m.id, ec)} title="Remove">✕</button>
                              </span>
                            ))}
                          </div>
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
        <div className="chart-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔗</div>
          <div className="chart-title" style={{ fontSize: 22, marginBottom: 8 }}>API Integration</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.7 }}>
            Connect to your external data source with one click. The backend will fetch data from
            the configured API, process the response, and automatically update your dashboard KPIs and charts.
          </p>
          <button
            className="btn btn-primary"
            // onClick={handleIntegrateApi}
            disabled={integrating}
            style={{
              padding: '14px 40px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.2s ease',
              boxShadow: integrating ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            {integrating ? (
              <>
                <span className="dash-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                Integrating...
              </>
            ) : (
              <>
                <span style={{ fontSize: 20 }}>⚡</span>
                Integrate API
              </>
            )}
          </button>
          <div style={{ marginTop: 28, padding: 16, background: 'rgba(99,102,241,0.06)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)', maxWidth: 500, margin: '28px auto 0' }}>
            <strong>ℹ️ Configuration:</strong> API URL and credentials are managed in the server <code>.env</code> file.
            Contact your administrator to update the external API endpoint.
          </div>
        </div>
      )}

      {/* Multiple Parameter Tab */}
      {tab === 'params' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-title">🧮 Custom Parameter Builder</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Create new calculated parameters from your uploaded Excel columns. Saved parameters are added to your dataset.</p>

            {allExcelCols.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>📂</span>
                Upload and activate a dataset first to use the parameter builder.
              </div>
            )}

            {allExcelCols.length > 0 && customParams.map((cp, cpIdx) => (
              <div key={cpIdx} className="cpb-card">
                <div className="cpb-header">
                  <span className="cpb-num">#{cpIdx + 1}</span>
                  <div className="cpb-name-wrap">
                    <label className="cpb-label">New Parameter Column</label>
                    <input
                      className="cpb-name-input"
                      type="text"
                      placeholder="e.g. Marketing ROI"
                      value={cp.name}
                      onChange={e => setCustomParams(prev => { const c = [...prev]; c[cpIdx] = { ...c[cpIdx], name: e.target.value }; return c; })}
                      disabled={cp.saved}
                    />
                  </div>
                  <span className="cpb-eq">=</span>
                </div>

                <div className="cpb-formula">
                  {cp.formula.map((item, fIdx) => (
                    <div key={fIdx} className="cpb-formula-item">
                      {item.type === 'param' ? (
                        <div className="cpb-param-row">
                          <select
                            className="form-select cpb-select"
                            value={item.value}
                            onChange={e => updateFormulaItem(cpIdx, fIdx, e.target.value)}
                            disabled={cp.saved}
                          >
                            <option value="">— Select Parameter —</option>
                            {allExcelCols.map(col => <option key={col} value={col}>{col}</option>)}
                          </select>
                          {cp.formula.filter(f => f.type === 'param').length > 1 && !cp.saved && (
                            <button className="cpb-remove-btn" onClick={() => removeFormulaRow(cpIdx, fIdx)} title="Remove">✕</button>
                          )}
                        </div>
                      ) : (
                        <select
                          className="form-select cpb-op-select"
                          value={item.value}
                          onChange={e => updateFormulaItem(cpIdx, fIdx, e.target.value)}
                          disabled={cp.saved}
                        >
                          {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                  {!cp.saved && (
                    <button className="cpb-add-btn" onClick={() => addFormulaItem(cpIdx)} title="Add parameter">＋</button>
                  )}
                </div>

                <div className="cpb-actions">
                  {!cp.saved && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleCalculate(cpIdx)} disabled={calculating === cpIdx}>
                        {calculating === cpIdx ? '⏳ Calculating...' : '🔢 Calculate'}
                      </button>
                      {cp.result !== null && (
                        <button className="btn btn-success btn-sm" onClick={() => handleSaveParam(cpIdx)} disabled={saving === cpIdx}>
                          {saving === cpIdx ? '⏳ Saving...' : '💾 Save'}
                        </button>
                      )}
                    </>
                  )}
                  {cp.result !== null && (
                    <div className="cpb-result">
                      <span className="cpb-result-label">Result:</span>
                      <span className="cpb-result-value">{cp.result.toLocaleString()}</span>
                    </div>
                  )}
                  {cp.saved && <span className="badge badge-auto">✅ Saved</span>}
                </div>
              </div>
            ))}

            {allExcelCols.length > 0 && (
              <button className="btn btn-primary" onClick={addCustomParam} style={{ marginTop: 12 }}>＋ Add Parameter</button>
            )}
          </div>
        </div>
      )}

      {/* Google Ads Connector Tab */}
      {tab === 'gads' && (
        <div>
          <div className="chart-card">
            <div className="chart-title">📊 Google Ads Connector</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Connect your Google Ads account to automatically sync campaign data into the CMO Dashboard.</p>

            <div className="gads-flow">
              <div className="gads-step">
                <div className="gads-step-num">1</div>
                <div className="gads-step-content">
                  <div className="gads-step-title">Connect Google Account</div>
                  <p className="gads-step-desc">Sign in with your Google account and grant access to Ads data.</p>
                  <button className="btn btn-primary" onClick={handleGoogleAdsConnect}>
                    <span style={{ marginRight: 6 }}>🔑</span> Connect with Google
                  </button>
                </div>
              </div>
              <div className="gads-step">
                <div className="gads-step-num">2</div>
                <div className="gads-step-content">
                  <div className="gads-step-title">Select Account & Campaign</div>
                  <p className="gads-step-desc">Choose which Google Ads account and campaigns to sync.</p>
                </div>
              </div>
              <div className="gads-step">
                <div className="gads-step-num">3</div>
                <div className="gads-step-content">
                  <div className="gads-step-title">Sync Data</div>
                  <p className="gads-step-desc">Campaign data will automatically populate your KPIs and charts.</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 14, background: 'rgba(245,158,11,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong>⚙️ Setup Required:</strong> To enable Google Ads integration, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to your server <code>.env</code> file. Contact your administrator for credentials.
            </div>
          </div>
        </div>
      )}


      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}