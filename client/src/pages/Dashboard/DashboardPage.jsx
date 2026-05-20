import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const POLL_MS = 30000;
const PAL = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#ef4444','#ec4899','#14b8a6','#f97316'];
const FC = ['#3b82f6','#8b5cf6','#f59e0b','#10b981'];
const TIME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

function mkLine(yFmt) {
  return { responsive:true, maintainAspectRatio:false, animation:{duration:800}, interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:true,position:'top',labels:{color:'#94a3b8',font:{family:'Inter',size:12},usePointStyle:true,padding:16}},
      tooltip:{backgroundColor:'rgba(10,14,26,0.96)',padding:14,cornerRadius:10,borderColor:'rgba(99,102,241,0.25)',borderWidth:1}},
    scales:{x:{ticks:{color:'#64748b',font:{family:'Inter',size:11}},grid:{color:'rgba(148,163,184,0.05)'}},
      y:{ticks:{color:'#64748b',font:{family:'Inter',size:11},callback:yFmt||(v=>v.toLocaleString())},grid:{color:'rgba(148,163,184,0.05)'}}}
  };
}
function mkBar(o={}) {
  return { responsive:true, maintainAspectRatio:false, animation:{duration:700}, indexAxis:o.horizontal?'y':'x',
    plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(10,14,26,0.96)',padding:14,cornerRadius:10}},
    scales:{x:{ticks:{color:'#64748b',font:{family:'Inter',size:11},callback:o.xFmt||(v=>v),maxRotation:30},grid:{color:'rgba(148,163,184,0.05)'}},
      y:{ticks:{color:'#64748b',font:{family:'Inter',size:11},callback:o.yFmt||(v=>v)},grid:{color:'rgba(148,163,184,0.05)'}}}
  };
}

function gradFill(color,alpha1=0.22,alpha2=0.01){
  return ctx=>{const ca=ctx.chart.chartArea;if(!ca)return`rgba(${color},${alpha1})`;
    const g=ctx.chart.ctx.createLinearGradient(0,ca.top,0,ca.bottom);
    g.addColorStop(0,`rgba(${color},${alpha1})`);g.addColorStop(1,`rgba(${color},${alpha2})`);return g;};
}

function buildMulti(cd){
  if(!cd)return null;
  if(cd.multiSeries&&cd.datasets?.length>0){
    const v=cd.datasets.filter(ds=>ds.data.some(x=>x!==0));if(!v.length)return null;
    return{labels:cd.labels,datasets:v.map((ds,i)=>({label:ds.channel,data:ds.data,borderColor:PAL[i%PAL.length],backgroundColor:'transparent',tension:0.35,borderWidth:2,pointRadius:3}))};
  }
  if(cd.labels?.length>0){
    return{labels:cd.labels,datasets:[{label:'Value',data:cd.data,borderColor:'#10b981',backgroundColor:gradFill('16,185,129'),fill:true,tension:0.4,borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#10b981',pointBorderColor:'#fff',pointBorderWidth:2}]};
  }
  return null;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [channel, setChannel] = useState('all');
  const [timePeriod, setTimePeriod] = useState('all');
  const [channels, setChannels] = useState([]);
  const timer = useRef(null);
  const initialLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await api.getDashboard(channel, timePeriod);
      setData(r);
      if(r.channels) setChannels(r.channels);
      setUpdated(new Date());
    } catch(_){}
    if(initialLoad.current) { setLoading(false); initialLoad.current = false; }
  }, [channel, timePeriod]);

  useEffect(() => { load(); timer.current = setInterval(()=>load(), POLL_MS); return ()=>clearInterval(timer.current); }, [load]);

  // Persist data_type selection
  const storedType = typeof localStorage!=='undefined' ? localStorage.getItem('cmo_data_type') : null;

  if(loading) return <div className="page"><div className="dash-loader"><div className="dash-spinner"/><p>Loading…</p></div></div>;

  const dt = data?.data_type || storedType || null;
  if(dt) localStorage.setItem('cmo_data_type', dt);
  const dashKpis = data?.dashboard?.kpis || {};
  const dashCharts = data?.dashboard?.charts || {};
  const b2b = data?.b2b;
  const b2c = data?.b2c;
  const b2bKpis = b2b?.kpis || {};
  const b2cKpis = b2c?.kpis || {};
  const b2bCharts = b2b?.charts || {};
  const b2cCharts = b2c?.charts || {};
  const insights = dt==='b2b' ? (b2b?.insights||[]) : (b2c?.insights||[]);

  // Dashboard 7 KPIs
  const dashCards = [
    {l:'Revenue',v:`$${(dashKpis.revenue||0).toLocaleString()}`,i:'💰'},
    {l:'Marketing Spend',v:`$${(dashKpis.marketing_spend||0).toLocaleString()}`,i:'💸'},
    {l:'Blended ROI',v:`${dashKpis.blended_roi||0}%`,i:'📈'},
    {l:'CAC',v:`$${(dashKpis.cac||0).toLocaleString()}`,i:'🎯'},
    {l:'Total Leads',v:(dashKpis.total_leads||0).toLocaleString(),i:'👥'},
    {l:'Conversion Rate',v:`${dashKpis.conversion_rate||0}%`,i:'🔄'},
    {l:'CPL',v:`$${(dashKpis.cpl||0).toLocaleString()}`,i:'📉'},
  ];
  // B2B 5 KPIs
  const b2bCards = [
    {l:'Pipeline Value',v:`$${(b2bKpis.pipeline_value||0).toLocaleString()}`,i:'💎'},
    {l:'MQL → SQL Rate',v:`${b2bKpis.mql_sql_conversion||0}%`,i:'🔄'},
    {l:'Deal Velocity',v:`${b2bKpis.deal_velocity||0} days`,i:'⚡'},
    {l:'Win Rate',v:`${b2bKpis.win_rate||0}%`,i:'🏆'},
    {l:'Churn Rate',v:`${b2bKpis.churn_rate||0}%`,i:'📉'},
  ];
  // B2C 5 KPIs
  const b2cCards = [
    {l:'Lifetime Value (LTV)',v:`$${(b2cKpis.ltv||0).toLocaleString()}`,i:'💎'},
    {l:'Repeat Purchase Rate',v:`${b2cKpis.repeat_purchase_rate||0}%`,i:'🔁'},
    {l:'Avg Order Value',v:`$${(b2cKpis.aov||0).toLocaleString()}`,i:'🛍️'},
    {l:'Cart Abandonment',v:`${b2cKpis.cart_abandonment_rate||0}%`,i:'🛒'},
    {l:'Purchase Frequency',v:`${b2cKpis.purchase_frequency||0}x`,i:'📊'},
  ];
  const extraCards = dt==='b2b' ? b2bCards : dt==='b2c' ? b2cCards : [];

  // Chart data
  const rev = dashCharts.revenue_trend;
  const hasRev = rev?.labels?.length>0 && rev?.data?.some(v=>v!==0);
  const cacLtv = dashCharts.cac_vs_ltv_trend;
  const hasCL = cacLtv?.labels?.length>0;
  const fun = dashCharts.conversion_funnel;
  const fStages = [
    {l:'Leads',v:fun?.leads||0,c:FC[0]},{l:'MQLs',v:fun?.mqls||0,c:FC[1]},
    {l:'SQLs',v:fun?.sqls||0,c:FC[2]},{l:'Customers',v:fun?.customers||0,c:FC[3]}
  ];
  const maxF = Math.max(fStages[0].v,1);
  const roi = dashCharts.channel_roi;
  const hasROI = roi?.labels?.length>0;
  // B2B charts
  const cpl = b2bCharts.cpl_by_channel;
  const hasCpl = cpl?.labels?.length>0;
  const wrt = b2bCharts.win_rate_trend;
  const hasWrt = wrt?.labels?.length>0 && wrt?.data?.some(v=>v!==0);
  // B2C charts
  const rpd = buildMulti(b2cCharts.repeat_purchase_trend);
  const cf = b2cCharts.cart_abandonment_funnel;
  const cartsC = cf?.carts_created||0;
  const purch = cf?.purchases_completed||0;
  const aband = cartsC - purch;
  const abandPct = cartsC>0?((aband/cartsC)*100).toFixed(1):'0.0';
  const purchPct = cartsC>0?((purch/cartsC)*100).toFixed(1):'0.0';

  const pageTitle = dt==='b2b' ? 'B2B Analytics' : dt==='b2c' ? 'B2C Analytics' : 'Analytics';

  return (
    <div className="page">
      {/* Header with title + filters */}
      <div className="dash-header">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          {updated && <p className="page-subtitle">Last updated: {updated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>}
        </div>
        <div className="dash-filters">
          <select className="dash-filter-select" value={channel} onChange={e=>setChannel(e.target.value)}>
            <option value="all">All Channels</option>
            {channels.map(ch=><option key={ch} value={ch}>{ch}</option>)}
          </select>
          <select className="dash-filter-select" value={timePeriod} onChange={e=>setTimePeriod(e.target.value)}>
            {TIME_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="live-badge"><span className="live-dot"/>Live</div>
        </div>
      </div>

      {/* ══════ ALL 12 KPI CARDS FIRST ══════ */}
      <div className="kpi-grid">
        {dashCards.map((c,i)=>(
          <div key={`d${i}`} className="kpi-card"><span className="kpi-icon">{c.i}</span><div className="kpi-label">{c.l}</div><div className="kpi-value">{c.v}</div></div>
        ))}
        {extraCards.map((c,i)=>(
          <div key={`e${i}`} className="kpi-card"><span className="kpi-icon">{c.i}</span><div className="kpi-label">{c.l}</div><div className="kpi-value">{c.v}</div></div>
        ))}
      </div>

      {/* ══════ ALL 6 CHARTS AFTER ══════ */}
      <div className="chart-grid-2x2">
        {/* Chart 1: Revenue Trend */}
        <div className="ccard">
          <div className="ccard-title">📈 Revenue Trend</div>
          <div className="ccard-body">
            {hasRev ? <Line data={{labels:rev.labels,datasets:[{label:'Revenue ($)',data:rev.data,borderColor:'#10b981',backgroundColor:gradFill('16,185,129'),fill:true,tension:0.4,borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#10b981',pointBorderColor:'#fff',pointBorderWidth:2}]}} options={mkLine(v=>'$'+v.toLocaleString())} />
            : <div className="ccard-empty-inner"><span>📈</span><p>No revenue data yet</p></div>}
          </div>
        </div>
        {/* Chart 2: CAC vs LTV */}
        <div className="ccard">
          <div className="ccard-title">📉 CAC vs LTV</div>
          <div className="ccard-body">
            {hasCL ? <Line data={{labels:cacLtv.labels,datasets:[
              {label:'CAC ($)',data:cacLtv.cac_data,borderColor:'#f59e0b',backgroundColor:'transparent',tension:0.4,borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#f59e0b',pointBorderColor:'#fff',pointBorderWidth:2},
              {label:'LTV ($)',data:cacLtv.ltv_data,borderColor:'#10b981',backgroundColor:'transparent',tension:0.4,borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#10b981',pointBorderColor:'#fff',pointBorderWidth:2}
            ]}} options={mkLine(v=>'$'+v.toLocaleString())} />
            : <div className="ccard-empty-inner"><span>📉</span><p>No CAC/LTV data yet</p></div>}
          </div>
        </div>
        {/* Chart 3: Conversion Funnel */}
        <div className="ccard">
          <div className="ccard-title">🔻 Conversion Funnel</div>
          <div className="ccard-body funnel-body">
            <div className="funnel-wrap">
              {fStages.map((s,i)=>{
                const pct=((s.v/maxF)*100).toFixed(1);
                const drop=i>0&&fStages[i-1].v>0?((fStages[i-1].v-s.v)/fStages[i-1].v*100).toFixed(1):null;
                return(<div key={i} className="fn-row"><div className="fn-meta"><span className="fn-name">{s.l}</span><span className="fn-count">{s.v.toLocaleString()}</span></div>
                  <div className="fn-track"><div className="fn-bar" style={{width:`${Math.max(Number(pct),5)}%`,background:s.c}}/></div>
                  <div className="fn-right"><span className="fn-pct">{pct}%</span>{drop&&<span className="fn-drop">▼{drop}%</span>}</div></div>);
              })}
            </div>
          </div>
        </div>
        {/* Chart 4: Channel ROI */}
        <div className="ccard">
          <div className="ccard-title">📊 Channel ROI</div>
          <div className="ccard-body">
            {hasROI ? <Bar data={{labels:roi.labels,datasets:[{label:'ROI %',data:roi.data,backgroundColor:roi.labels.map((_,i)=>PAL[i%PAL.length]),borderRadius:7,barThickness:28}]}} options={mkBar({horizontal:true,xFmt:v=>`${v}%`})} />
            : <div className="ccard-empty-inner"><span>📊</span><p>No channel ROI data yet</p></div>}
          </div>
        </div>
        {/* Charts 5-6: B2B or B2C specific */}
        {dt==='b2b' && (<>
          <div className="ccard"><div className="ccard-title">💰 CPL by Channel</div><div className="ccard-body">
            {hasCpl?<Bar data={{labels:cpl.labels,datasets:[{label:'CPL ($)',data:cpl.data,backgroundColor:cpl.labels.map((_,i)=>PAL[i%PAL.length]),borderRadius:7,barThickness:34}]}} options={mkBar({yFmt:v=>`$${v}`})}/>
            :<div className="ccard-empty-inner"><span>💰</span><p>No CPL data yet</p></div>}
          </div></div>
          <div className="ccard"><div className="ccard-title">🏆 Win Rate Trend</div><div className="ccard-body">
            {hasWrt?<Line data={{labels:wrt.labels,datasets:[{label:'Win Rate (%)',data:wrt.data,borderColor:'#10b981',backgroundColor:gradFill('16,185,129'),fill:true,tension:0.4,borderWidth:2.5,pointRadius:5,pointBackgroundColor:'#10b981',pointBorderColor:'#fff',pointBorderWidth:2}]}} options={mkLine(v=>`${v}%`)}/>
            :<div className="ccard-empty-inner"><span>🏆</span><p>No win rate data yet</p></div>}
          </div></div>
        </>)}
        {dt==='b2c' && (<>
          <div className="ccard"><div className="ccard-title">🔁 Repeat Purchase Trend</div><div className="ccard-body">
            {rpd?<Line data={rpd} options={mkLine()}/>
            :<div className="ccard-empty-inner"><span>🔁</span><p>No repeat purchase data yet</p></div>}
          </div></div>
          <div className="ccard"><div className="ccard-title">🛒 Cart Abandonment</div><div className="ccard-body trap-body">
            <div className="trap-funnel">
              <div className="trap-row" style={{'--w':'100%','--delay':'0s'}}><div className="trap-seg" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}><span className="trap-lbl">Carts Created</span><span className="trap-val">{cartsC.toLocaleString()}</span></div></div>
              <div className="trap-row" style={{'--w':`${cartsC>0?Math.max((purch/cartsC)*100,25):60}%`,'--delay':'0.1s'}}><div className="trap-seg" style={{background:'linear-gradient(135deg,#10b981,#34d399)'}}><span className="trap-lbl">Purchased</span><span className="trap-val">{purch.toLocaleString()}</span></div></div>
              <div className="trap-row" style={{'--w':`${cartsC>0?Math.max((aband/cartsC)*100,18):40}%`,'--delay':'0.2s'}}><div className="trap-seg" style={{background:'linear-gradient(135deg,#ef4444,#f87171)'}}><span className="trap-lbl">Abandoned</span><span className="trap-val">{aband.toLocaleString()}</span></div></div>
              <div className="trap-stat"><span className="trap-stat-item" style={{color:'#ef4444'}}>Abandonment: <b>{abandPct}%</b></span><span className="trap-stat-sep">·</span><span className="trap-stat-item" style={{color:'#10b981'}}>Completed: <b>{purchPct}%</b></span></div>
            </div>
          </div></div>
        </>)}
      </div>

      {/* Insights */}
      {insights?.length>0 && (
        <div className="insights-section" style={{marginTop:24}}>
          <div className="insights-title">🔍 Key Insights</div>
          {insights.map((ins,i)=>(<div key={i} className={`insight-item ${ins.type}`}><div className="insight-dot"/><span>{ins.text}</span></div>))}
        </div>
      )}
    </div>
  );
}
