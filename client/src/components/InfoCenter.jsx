import React, { useState } from 'react';     

const PARAMETERS = [
  { name: 'PR / Media Contribution', desc: 'Revenue or business impact generated through PR activities, advertisements, influencer campaigns, media promotions, or branding campaigns.', usedIn: ['Dashboard'] },
  { name: 'Total Sales Cost', desc: 'Total expenses involved in the sales process such as sales team salaries, commissions, incentives, CRM tools, travel, and operational sales expenses.', usedIn: ['Dashboard'] },
  { name: 'Total Marketing Cost', desc: 'Total amount spent on all marketing activities including ads, promotions, campaigns, SEO, email marketing, branding, and social media.', usedIn: ['Dashboard'] },
  { name: 'Channel Cost', desc: 'The amount spent on a specific marketing or sales channel such as Google Ads, Facebook Ads, LinkedIn, Email Marketing, etc.', usedIn: ['Dashboard', 'B2B'] },
  { name: 'Gross Margin %', desc: 'Percentage of profit remaining after deducting the direct cost of goods/services from revenue.', usedIn: ['B2C'] },
  { name: 'Revenue', desc: 'Total income generated from sales before deducting expenses. Primary business performance metric.', usedIn: ['Dashboard', 'B2C'] },
  { name: 'Number of New Customers', desc: 'Total number of customers acquired for the first time during the selected period.', usedIn: ['Dashboard'] },
  { name: 'Attributed Revenue per Channel', desc: 'Revenue credited to a specific marketing or sales channel. Helps identify which channels generate the most value.', usedIn: ['Dashboard'] },
  { name: 'Number of SQLs', desc: 'Sales Qualified Leads — leads identified by the sales team as highly likely to become customers.', usedIn: ['B2B'] },
  { name: 'Total Days to Close', desc: 'Total number of days taken to close all sales deals. Used to measure sales cycle efficiency.', usedIn: ['B2B'] },
  { name: 'Number of Deals', desc: 'Total count of sales deals or opportunities created during the selected period.', usedIn: ['B2B'] },
  { name: 'Won Deals', desc: 'Number of successfully closed deals that converted into customers or revenue.', usedIn: ['B2B'] },
  { name: 'Total Opportunities', desc: 'Total sales opportunities available in the pipeline, including won, lost, and active deals.', usedIn: ['B2B'] },
  { name: 'Customers Lost', desc: 'Number of customers who stopped purchasing or became inactive during the selected period.', usedIn: ['B2B'] },
  { name: 'Customers at Start of Period', desc: 'Total active customers present at the beginning of the reporting period. Mainly used for churn calculations.', usedIn: ['B2B'] },
  { name: 'AOV (Average Order Value)', desc: 'Average amount spent by customers per order. Calculated using Revenue ÷ Total Orders.', usedIn: ['B2C'] },
  { name: 'Purchase Frequency', desc: 'Average number of purchases made by each customer during a period.', usedIn: ['B2C'] },
  { name: 'Customer Lifespan', desc: 'Average duration a customer continues purchasing from the business before becoming inactive.', usedIn: ['B2C'] },
  { name: 'Repeat Customer', desc: 'Number of customers who made more than one purchase. Used to measure customer loyalty.', usedIn: ['B2C'] },
  { name: 'Total Customers', desc: 'Total number of unique customers during the selected period.', usedIn: ['B2C'] },
  { name: 'Purchases Completed', desc: 'Total number of successful purchase transactions completed by customers.', usedIn: ['B2C'] },
  { name: 'Total Orders', desc: 'Total number of orders placed by customers regardless of order value.', usedIn: ['B2C'] },
  { name: 'Channel Leads', desc: 'Number of leads generated from a specific marketing or sales channel.', usedIn: ['B2B'] },
  { name: 'Carts Created', desc: 'Number of shopping carts initiated by users before completing or abandoning checkout.', usedIn: ['B2C'] },
  { name: 'Leads', desc: 'Total number of potential customers or inquiries generated from campaigns or channels.', usedIn: ['Dashboard'] },
  { name: 'Number of MQLs', desc: 'Marketing Qualified Leads — leads identified by marketing as interested and likely to convert.', usedIn: ['B2B'] },
  { name: 'Deal Value', desc: 'Estimated monetary value of a sales deal or opportunity. Used in revenue forecasting.', usedIn: ['Dashboard', 'B2B'] },
  { name: 'Probability', desc: 'Estimated percentage chance of successfully winning or closing a sales deal.', usedIn: ['Dashboard', 'B2B'] },
  { name: 'Channel Revenue', desc: 'Revenue generated from a specific marketing or sales channel.', usedIn: ['Dashboard'] }, 
];  

const METRICS = [
  { name: 'Revenue', desc: 'Total income generated from all sales and business activities after considering channel revenue and media contribution.', usedIn: ['Dashboard'] },
  { name: 'Blended ROI', desc: 'Measures the overall return generated from total marketing investment across all channels combined.', usedIn: ['Dashboard'] },
  { name: 'Customer Acquisition Cost (CAC)', desc: 'Average cost spent to acquire one new customer. Lower CAC indicates more efficient acquisition.', usedIn: ['Dashboard'] },
  { name: 'Total Leads', desc: 'Total number of potential customers generated from all marketing and sales channels.', usedIn: ['Dashboard'] },
  { name: 'Lead → Customer Conversion Rate', desc: 'Percentage of leads that successfully converted into paying customers.', usedIn: ['Dashboard'] },
  { name: 'Cost Per Lead (CPL)', desc: 'Average cost incurred to generate one lead. Lower CPL indicates more efficient campaigns.', usedIn: ['Dashboard'] },
  { name: 'Pipeline Value', desc: 'Total estimated monetary value of all active sales opportunities in the pipeline.', usedIn: ['B2B'] },
  { name: 'MQL → SQL Conversion Rate', desc: 'Percentage of Marketing Qualified Leads that became Sales Qualified Leads.', usedIn: ['B2B'] },
  { name: 'Deal Velocity (Days)', desc: 'Average number of days required to close a sales deal.', usedIn: ['B2B'] },
  { name: 'Win Rate (%)', desc: 'Percentage of total sales opportunities successfully converted into won deals.', usedIn: ['B2B'] },
  { name: 'Churn Rate (B2B)', desc: 'Percentage of customers lost during a selected period compared to customers at the start.', usedIn: ['B2B'] },
  { name: 'CPL by Channel (B2B)', desc: 'Cost Per Lead for individual channels. Shows how much is spent to generate one lead per channel.', usedIn: ['B2B'] },
  { name: 'Lifetime Value (LTV)', desc: 'Estimated total revenue a customer generates during their relationship with the business.', usedIn: ['B2C'] },
  { name: 'Repeat Purchase Rate', desc: 'Percentage of customers who made more than one purchase. Measures loyalty.', usedIn: ['B2C'] },
  { name: 'Average Order Value (AOV)', desc: 'Average revenue earned per customer order.', usedIn: ['B2C'] },
  { name: 'Cart Abandonment Rate', desc: 'Percentage of users who added products to cart but did not complete the purchase.', usedIn: ['B2C'] },
  { name: 'Purchase Frequency', desc: 'Average number of purchases made by each customer during a selected period.', usedIn: ['B2C'] },
];

const tagColor = { Dashboard: 'var(--accent)', B2B: 'var(--warning)', B2C: 'var(--success)' };

function AccordionList({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="accordion">
      {items.map((item, i) => (
        <div key={i} className="accordion-item">
          <div className="accordion-header" onClick={() => setOpen(open === i ? null : i)}>
            <span>{item.name}</span>
            <span style={{ fontSize: 12, transition: 'transform 0.3s', transform: open === i ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
          </div>
          <div className={`accordion-body ${open === i ? 'open' : ''}`}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>{item.desc}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Used in:</span>
              {item.usedIn.map(u => (
                <span key={u} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: `${tagColor[u]}18`, color: tagColor[u], fontWeight: 600 }}>{u}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InfoCenter({ inline, onClose }) {
  const [tab, setTab] = useState('parameters');

  const content = (
    <div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${tab === 'parameters' ? 'active' : ''}`} onClick={() => setTab('parameters')}>📋 Parameters</button>
        <button className={`tab ${tab === 'metrics' ? 'active' : ''}`} onClick={() => setTab('metrics')}><><i className="bi bi-bar-chart-fill"></i> Metrics</></button>
      </div>
      {tab === 'parameters' && <AccordionList items={PARAMETERS} />}
      {tab === 'metrics' && <AccordionList items={METRICS} />}
    </div>
  );

  if (inline) return content;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><><i className="bi bi-info-circle-fill"></i> Info Centre</></h2>
          <button className="modal-close" onClick={onClose}><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="modal-body">{content}</div>
      </div>
    </div>
  );
}
