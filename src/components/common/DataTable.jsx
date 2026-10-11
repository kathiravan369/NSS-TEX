import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { isPaidLocked } from '../../utils/formatters';

export default function DataTable({
  columns,
  data = [],
  keyField = 'id',
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  page = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  sortField,
  sortOrder = 'asc',
  onSort
}) {
  return (
    <div className="table-wrapper">
      <div className="table-responsive">
        <table className="erp-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSortable = !!col.sortable;
                const fieldKey = col.sortKey || col.key;
                const isSorted = sortField && sortField === fieldKey;

                return (
                  <th
                    key={col.key || col.header}
                    style={{
                      textAlign: col.align || 'left',
                      width: col.width,
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: isSortable ? 'none' : 'auto'
                    }}
                    onClick={isSortable && onSort ? () => onSort(fieldKey) : undefined}
                    title={isSortable ? `Click to sort by ${col.header}` : undefined}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>{col.header}</span>
                      {isSortable && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: isSorted ? 'var(--primary-600)' : '#94a3b8'
                          }}
                        >
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={13} strokeWidth={2.5} />
                            ) : (
                              <ArrowDown size={13} strokeWidth={2.5} />
                            )
                          ) : (
                            <ArrowUpDown size={12} style={{ opacity: 0.4 }} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {(onView || onEdit || onDelete) && (
                <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onView || onEdit || onDelete ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                >
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const locked = isPaidLocked(row);
                const displaySno = row.sno !== undefined && row.sno !== null
                  ? row.sno
                  : (sortField === 'sno' && sortOrder === 'desc'
                      ? Math.max(1, totalItems - ((page - 1) * itemsPerPage + idx))
                      : (page - 1) * itemsPerPage + idx + 1);

                return (
                  <tr key={row[keyField] || idx}>
                    {columns.map((col) => {
                      const isSnoColumn = col.key === 'sno' || col.header === 'S. No';

                      return (
                        <td key={col.key || col.header} style={{ textAlign: col.align || 'left' }}>
                          {col.render
                            ? col.render(isSnoColumn ? displaySno : row[col.key], row, idx, displaySno)
                            : isSnoColumn
                            ? displaySno
                            : col.isStatus
                            ? (
                                <StatusBadge
                                  status={row[col.key]}
                                  onChange={!locked && onStatusChange ? (newStatus) => onStatusChange(row, newStatus) : null}
                                  options={col.statusOptions || ['Paid', 'Pending']}
                                  isLocked={locked}
                                />
                              )
                            : row[col.key]}
                        </td>
                      );
                    })}
                    {(onView || onEdit || onDelete) && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          {onView && (
                            <button
                              type="button"
                              className="action-icon-btn"
                              title="View Details"
                              onClick={() => onView(row)}
                            >
                              <Eye size={13} />
                            </button>
                          )}
                          {locked ? (
                            <span
                              title="Paid over 24 hours ago. Locked for audit compliance (View Only — cannot edit or delete)."
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '9999px',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                cursor: 'not-allowed',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <Lock size={10} /> Locked
                            </span>
                          ) : (
                            <>
                              {onEdit && (
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  title="Edit Record"
                                  onClick={() => onEdit(row)}
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  type="button"
                                  className="action-icon-btn delete"
                                  title="Delete Record"
                                  onClick={() => onDelete(row)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 0.25rem 0.25rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}
      >
        <div>
          Showing {data.length > 0 ? (page - 1) * itemsPerPage + 1 : 0} to{' '}
          {Math.min(page * itemsPerPage, totalItems || data.length)} of {totalItems || data.length} entries
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className="action-icon-btn"
            disabled={page <= 1}
            onClick={() => onPageChange && onPageChange(page - 1)}
            style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              background: 'var(--primary-600)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          >
            {page}
          </span>
          <button
            type="button"
            className="action-icon-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange && onPageChange(page + 1)}
            style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
