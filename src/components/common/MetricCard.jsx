import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  trend,
  trendType = 'up',
  trendText = 'vs last month',
  icon: Icon,
  iconBg = 'var(--primary-50)',
  iconColor = 'var(--primary-600)',
  onClick,
  isActive = false,
  activeVariant = 'primary',
  badge
}) {
  const isClickable = typeof onClick === 'function';
  const activeClass = isActive
    ? `is-active is-active-${activeVariant}`
    : '';

  return (
    <div
      className={`metric-card ${isClickable ? 'is-clickable' : ''} ${activeClass}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {Icon && (
        <div className="metric-icon-box" style={{ backgroundColor: iconBg, color: iconColor }}>
          <Icon size={18} />
        </div>
      )}
      <div className="metric-info">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
          <div className="metric-title">{title}</div>
          {badge && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 600,
                padding: '0.12rem 0.4rem',
                borderRadius: '9999px',
                backgroundColor: isActive ? 'currentColor' : '#f1f5f9',
                color: isActive ? '#ffffff' : '#64748b'
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="metric-value">{value}</div>
        {trend && (
          <div className={`metric-trend ${trendType === 'up' ? 'trend-up' : 'trend-down'}`}>
            {trendType === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            <span>{trend}</span>
            <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: '2px' }}>
              {trendText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
