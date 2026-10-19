import React from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm: '560px',
  md: '760px',
  lg: '1120px',
  xl: '1120px',
  full: '96vw'
};

export default function Modal({ isOpen, onClose, title, children, maxWidth = '1120px', size }) {
  if (!isOpen) return null;

  // Resolve modal max-width (defaults to 1120px for all modals)
  let resolvedMaxWidth = '1120px';
  if (size && SIZES[size]) {
    resolvedMaxWidth = SIZES[size];
  } else if (maxWidth && maxWidth !== '600px' && maxWidth !== '880px') {
    resolvedMaxWidth = maxWidth;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: resolvedMaxWidth,
          maxHeight: '92vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxShadow: '0 25px 35px -5px rgba(0, 0, 0, 0.2), 0 12px 16px -6px rgba(0, 0, 0, 0.12)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>{children}</div>
      </div>
    </div>
  );
}
