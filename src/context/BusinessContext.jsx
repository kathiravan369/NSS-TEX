import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import logoNss from '../assets/logo.png';
import logoKd from '../assets/kd-logo.png';

export const BUSINESS_CONFIGS = {
  nss_text: {
    id: 'nss_text',
    name: 'NSS Text',
    shortName: 'NSS-TEX',
    tagline: 'NSS Textiles ERP',
    subtitle: 'Towels & Textiles Manufacturing ERP',
    dbName: 'nss_towels',
    logo: logoNss,
    fallbackLogo: './logo.png',
    accentColor: '#2563eb',
    badgeText: 'nss_towels',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    badgeColor: '#059669'
  },
  kd_text: {
    id: 'kd_text',
    name: 'KD Text',
    shortName: 'KD-TEX',
    tagline: 'KD Textiles ERP',
    subtitle: 'Textiles Manufacturing ERP',
    dbName: 'KD Text',
    logo: logoKd,
    fallbackLogo: './kd-logo.png',
    accentColor: '#d97706',
    badgeText: 'KD Text database',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeColor: '#2563eb'
  }
};

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  // Use sessionStorage so that a brand new application launch opens the business selection screen,
  // while in-app refreshes retain the chosen business.
  const [selectedBusinessId, setSelectedBusinessId] = useState(() => {
    try {
      const stored = sessionStorage.getItem('nss_active_business_id');
      if (stored && BUSINESS_CONFIGS[stored]) {
        return stored;
      }
    } catch (e) {}
    return null;
  });

  const [isSelecting, setIsSelecting] = useState(() => !selectedBusinessId);

  // Sync active business with backend and localStorage
  const selectBusiness = async (bizId) => {
    if (!BUSINESS_CONFIGS[bizId]) return;

    try {
      sessionStorage.setItem('nss_active_business_id', bizId);
      localStorage.setItem('nss_last_business_id', bizId);
    } catch (e) {}

    setSelectedBusinessId(bizId);
    setIsSelecting(false);

    // Notify backend
    try {
      await api.businesses.select(bizId);
    } catch (err) {
      console.warn('[BusinessContext] Error notifying backend of business selection:', err.message);
    }

    // Trigger storage reload event
    window.dispatchEvent(new CustomEvent('business-changed', { detail: { businessId: bizId } }));
  };

  const switchBusiness = async (bizId) => {
    await selectBusiness(bizId);
  };

  const openSelection = () => {
    setIsSelecting(true);
  };

  const currentBusiness = selectedBusinessId ? BUSINESS_CONFIGS[selectedBusinessId] : null;

  return (
    <BusinessContext.Provider
      value={{
        selectedBusinessId,
        currentBusiness,
        isSelecting,
        businesses: Object.values(BUSINESS_CONFIGS),
        selectBusiness,
        switchBusiness,
        openSelection
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
