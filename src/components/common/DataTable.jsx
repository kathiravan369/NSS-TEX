import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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
  onRowClick,
  page = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  sortField,
  sortOrder = 'asc',
  onSort
}) {
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);
  const [internalPageSize, setInternalPageSize] = useState(itemsPerPage || 10);
  const [internalPage, setInternalPage] = useState(page || 1);

  useEffect(() => {
    if (itemsPerPage) {
      setInternalPageSize(itemsPerPage);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    if (page) {
      setInternalPage(page);
    }
  }, [page]);

  // Click outside listener for upward items per page menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target)) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isControlled = Boolean(onPageChange);
  const effectiveItemsPerPage = itemsPerPage || internalPageSize || 10;
  const effectiveTotalItems = totalItems !== undefined && totalItems !== null ? totalItems : data.length;
  const computedTotalPages = totalPages || Math.ceil(effectiveTotalItems / effectiveItemsPerPage) || 1;
  const currentPage = isControlled ? (page || 1) : internalPage;

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (computedTotalPages > 0 && newPage > computedTotalPages)) return;
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const handlePageSizeSelect = (size) => {
    setInternalPageSize(size);
    setPageSizeOpen(false);
    if (onItemsPerPageChange) {
      onItemsPerPageChange(size);
    }
    handlePageChange(1);
  };

  const displayRows = isControlled ? data : data.slice((currentPage - 1) * effectiveItemsPerPage, currentPage * effectiveItemsPerPage);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (computedTotalPages <= maxVisible) {
      for (let i = 1; i <= computedTotalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(computedTotalPages, start + maxVisible - 1);
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

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
                <th className="table-actions-col" style={{ textAlign: 'center', width: '100px' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onView || onEdit || onDelete ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                >
                  No records found.
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => {
                const locked = isPaidLocked(row);
                const displaySno = row.sno !== undefined && row.sno !== null
                  ? row.sno
                  : (sortField === 'sno' && sortOrder === 'desc'
                      ? Math.max(1, effectiveTotalItems - ((currentPage - 1) * effectiveItemsPerPage + idx))
                      : (currentPage - 1) * effectiveItemsPerPage + idx + 1);

                return (
                  <tr
                    key={row[keyField] || idx}
                    onClick={(e) => {
                      if (onRowClick && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select') && !e.target.closest('a')) {
                        onRowClick(row);
                      }
                    }}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
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
                      <td className="table-actions-col" style={{ textAlign: 'center' }}>
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

      {/* Pagination Footer Matching Provided Image */}
      <div
        className="pagination-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 0.5rem 0.5rem',
          fontSize: '0.85rem',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Left: Items Per Page [ 20 ^ ] of 69 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', position: 'relative' }}>
          <span style={{ color: '#475569', fontWeight: 500, fontSize: '0.85rem' }}>
            Items Per Page
          </span>

          <div ref={pageSizeRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setPageSizeOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.35rem 0.65rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#1e293b',
                cursor: 'pointer',
                minWidth: '64px',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{effectiveItemsPerPage}</span>
              <ChevronUp
                size={14}
                color="#64748b"
                style={{
                  transform: pageSizeOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>

            {/* Upward Dropdown Menu */}
            {pageSizeOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: 0,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 999,
                  minWidth: '76px',
                  boxSizing: 'border-box'
                }}
              >
                {Array.from(new Set([10, 20, 50, 100, effectiveItemsPerPage])).sort((a, b) => a - b).map((option) => (
                  <div
                    key={option}
                    onClick={() => handlePageSizeSelect(option)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: effectiveItemsPerPage === option ? '#0f172a' : '#64748b',
                      backgroundColor: effectiveItemsPerPage === option ? '#e2e8f0' : 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (effectiveItemsPerPage !== option) e.currentTarget.style.backgroundColor = '#eef2f6';
                    }}
                    onMouseLeave={(e) => {
                      if (effectiveItemsPerPage !== option) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>

          <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.85rem' }}>
            of {effectiveTotalItems}
          </span>
        </div>

        {/* Right: Pagination Controls < 1 2 3 4 > */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {/* Previous Button */}
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: currentPage <= 1 ? '#f8fafc' : '#ffffff',
              color: currentPage <= 1 ? '#cbd5e1' : '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((num) => {
            const isActive = num === currentPage;
            return (
              <button
                key={num}
                type="button"
                onClick={() => handlePageChange(num)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#1e293b' : '#ffffff',
                  color: isActive ? '#ffffff' : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                {num}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            disabled={currentPage >= computedTotalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: currentPage >= computedTotalPages ? '1px solid #e2e8f0' : 'none',
              backgroundColor: currentPage >= computedTotalPages ? '#f8fafc' : '#1e293b',
              color: currentPage >= computedTotalPages ? '#cbd5e1' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPage >= computedTotalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= computedTotalPages ? 0.6 : 1,
              transition: 'all 0.15s ease',
              boxShadow: currentPage < computedTotalPages ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
