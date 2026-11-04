import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { storageService } from '../services/storageService';
import { Database, ArrowRight, ShieldCheck, Factory, Sparkles, Building2, Layers } from 'lucide-react';

export default function BusinessSelection() {
  const navigate = useNavigate();
  const { businesses, selectBusiness, selectedBusinessId } = useBusiness();
  const [loadingBiz, setLoadingBiz] = useState(null);

  const handleSelect = async (bizId) => {
    setLoadingBiz(bizId);
    try {
      await selectBusiness(bizId);
      // Immediately reload data for the newly selected business database
      await storageService.reloadAllCollections();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error selecting business:', err);
    } finally {
      setLoadingBiz(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      {/* Top Header Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 1rem',
        backgroundColor: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: '9999px',
        color: '#475569',
        fontSize: '0.825rem',
        fontWeight: 600,
        marginBottom: '1rem',
        letterSpacing: '0.02em'
      }}>
        <Factory size={16} color="#2563eb" />
        <span>STEP 1 — BUSINESS SELECTION</span>
      </div>

      {/* Main Title & Subtitle */}
      <h1 style={{
        fontSize: '2.25rem',
        fontWeight: 800,
        color: '#0f172a',
        margin: '0 0 0.5rem 0',
        textAlign: 'center',
        letterSpacing: '-0.03em'
      }}>
        Select Manufacturing Business
      </h1>
      <p style={{
        fontSize: '1rem',
        color: '#64748b',
        maxWidth: '540px',
        textAlign: 'center',
        margin: '0 0 2.5rem 0',
        lineHeight: 1.5
      }}>
        Choose your enterprise profile to load dedicated purchases, inventory, payroll, and PostgreSQL production records.
      </p>

      {/* Business Cards Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))',
        gap: '2rem',
        width: '100%',
        maxWidth: '820px',
        justifyContent: 'center'
      }}>
        {businesses.map((biz) => {
          const isCurrent = selectedBusinessId === biz.id;
          const isLoading = loadingBiz === biz.id;

          return (
            <div
              key={biz.id}
              onClick={() => !isLoading && handleSelect(biz.id)}
              style={{
                backgroundColor: '#ffffff',
                border: isCurrent ? `2px solid ${biz.accentColor}` : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '2rem',
                cursor: isLoading ? 'wait' : 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isCurrent
                  ? `0 12px 24px -6px ${biz.accentColor}25`
                  : '0 4px 16px -2px rgba(15, 23, 42, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 16px 32px -4px ${biz.accentColor}20`;
                  e.currentTarget.style.borderColor = biz.accentColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isCurrent
                    ? `0 12px 24px -6px ${biz.accentColor}25`
                    : '0 4px 16px -2px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.borderColor = isCurrent ? biz.accentColor : '#e2e8f0';
                }
              }}
            >
              {/* Logo Box */}
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                padding: '0.75rem',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <img
                  src={biz.logo}
                  alt={`${biz.name} Logo`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    if (biz.fallbackLogo && e.currentTarget.src !== biz.fallbackLogo) {
                      e.currentTarget.src = biz.fallbackLogo;
                    }
                  }}
                />
              </div>

              {/* Business Name */}
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em'
              }}>
                {biz.name}
              </h2>

              {/* Tagline */}
              <div style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginBottom: '1rem',
                fontWeight: 500
              }}>
                {biz.tagline}
              </div>

              {/* Database Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.85rem',
                backgroundColor: biz.badgeBg,
                border: `1px solid ${biz.badgeBorder}`,
                borderRadius: '9999px',
                color: biz.badgeColor,
                fontSize: '0.75rem',
                fontWeight: 600,
                marginBottom: '1.75rem'
              }}>
                <Database size={13} />
                <span>{biz.badgeText}</span>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.25rem',
                  backgroundColor: biz.accentColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.925rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: isLoading ? 'wait' : 'pointer',
                  transition: 'background-color 0.15s ease',
                  boxShadow: `0 4px 12px ${biz.accentColor}35`
                }}
              >
                {isLoading ? (
                  <span>Connecting to {biz.dbName}...</span>
                ) : (
                  <>
                    <span>Open Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: '3rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#94a3b8',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        <ShieldCheck size={16} color="#10b981" />
        <span>Separate PostgreSQL connection pools & schemas active • Zero data cross-contamination</span>
      </div>
    </div>
  );
}

