import React from 'react';

export default function StatusBadge({
  status,
  onChange,
  options = ['Paid', 'Pending'],
  isLocked = false
}) {
  if (!status) return null;

  const normalized = status.toString().toLowerCase().trim();

  let badgeClass = 'badge-info';
  let label = status;

  if (normalized === 'paid') {
    badgeClass = 'badge-paid';
    label = 'Paid';
  } else if (normalized === 'pending') {
    badgeClass = 'badge-pending';
    label = 'Pending';
  } else if (normalized === 'overdue') {
    badgeClass = 'badge-overdue';
    label = 'Overdue';
  } else if (normalized === 'active') {
    badgeClass = 'badge-active';
    label = 'Active';
  } else if (normalized === 'inactive') {
    badgeClass = 'badge-inactive';
    label = 'Inactive';
  } else if (normalized === 'low stock' || normalized === 'low_stock') {
    badgeClass = 'badge-low-stock';
    label = 'Low Stock';
  }

  if (isLocked) {
    return (
      <span
        className={`badge ${badgeClass}`}
        title="Payment locked after 24 hours. Cannot be changed back to pending."
        style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
      >
        🔒 {label}
      </span>
    );
  }

  if (onChange) {
    return (
      <select
        value={label}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className={`badge ${badgeClass} badge-interactive`}
        title="Click to change payment status"
      >
        {options.map((opt) => (
          <option
            key={opt}
            value={opt}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontWeight: 500
            }}
          >
            {opt === 'Paid' ? '✓ Paid' : opt === 'Pending' ? '⏳ Pending' : opt === 'Overdue' ? '⚠️ Overdue' : opt}
          </option>
        ))}
      </select>
    );
  }

  return <span className={`badge ${badgeClass}`}>{label}</span>;
}
