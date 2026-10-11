import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { type = 'success', message } = toast;

  const getStyle = () => {
    switch (type) {
      case 'success':
        return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: <CheckCircle2 size={18} color="#059669" /> };
      case 'error':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: <AlertCircle size={18} color="#dc2626" /> };
      default:
        return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: <Info size={18} color="#2563eb" /> };
    }
  };

  const style = getStyle();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 10000,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.85rem',
        fontWeight: 500,
        maxWidth: '380px',
        animation: 'slideIn 0.2s ease-out'
      }}
    >
      {style.icon}
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
