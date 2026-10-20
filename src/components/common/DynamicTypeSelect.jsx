import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Settings, Search, Edit2, Check, X, AlertTriangle, Power } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../services/api';

/**
 * DynamicTypeSelect - Reusable dynamic type selector with integrated database persistence,
 * instant Add Type (+) modal, duplicate prevention, and management capabilities.
 */
export default function DynamicTypeSelect({
  category,
  value,
  onChange,
  label = 'Type',
  placeholder = 'Select option...',
  required = false,
  allowManage = true,
  disabled = false,
  extraFields = [], // e.g. [{ key: 'rate', label: 'Rate (₹)', type: 'number' }]
  onTypeCreated = null, // optional callback when a new type is created with full object
  className = '',
  style = {}
}) {
  const [types, setTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('add'); // 'add' | 'manage'
  
  // Add Type Form State
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeExtra, setTypeExtra] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Manage Types State
  const [manageSearch, setManageSearch] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [managePage, setManagePage] = useState(1);
  const itemsPerPage = 8;

  const loadTypes = async () => {
    if (!category) return;
    setIsLoading(true);
    try {
      const res = await api.types.getByCategory(category, { includeInactive: true, limit: 300 });
      if (res && res.success && Array.isArray(res.data)) {
        setTypes(res.data);
      }
    } catch (err) {
      console.warn(`[DynamicTypeSelect] Could not load types for ${category}:`, err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, [category]);

  const activeTypes = useMemo(() => {
    return types.filter(t => t.isActive !== false);
  }, [types]);

  // Ensure current selected value is available even if recently added or historical
  const optionsList = useMemo(() => {
    const list = [...activeTypes];
    if (value && !list.some(t => t.name === value)) {
      // Historical or external type
      list.unshift({ id: `hist_${value}`, name: value, category, isActive: true });
    }
    return list;
  }, [activeTypes, value, category]);

  // Handle Dropdown Change
  const handleSelectChange = (e) => {
    const selectedVal = e.target.value;
    if (selectedVal === '__ADD_NEW__') {
      openAddModal();
      return;
    }
    const found = types.find(t => t.name === selectedVal);
    onChange(selectedVal, found || null);
  };

  const openAddModal = () => {
    setTypeName('');
    setTypeCode('');
    setTypeDesc('');
    setTypeExtra({});
    setErrorMsg('');
    setModalTab('add');
    setIsModalOpen(true);
    loadTypes();
  };

  const openManageModal = () => {
    setErrorMsg('');
    setModalTab('manage');
    setIsModalOpen(true);
    loadTypes();
  };

  // Duplicate Check
  const isDuplicateName = (nameToCheck, excludeId = null) => {
    const clean = nameToCheck.trim().toLowerCase();
    return types.some(t => t.name.trim().toLowerCase() === clean && t.id !== excludeId);
  };

  // Submit New Type
  const handleSaveNewType = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    if (!typeName.trim()) {
      setErrorMsg('Name is required.');
      return;
    }

    if (isDuplicateName(typeName)) {
      setErrorMsg(`"${typeName.trim()}" already exists in ${label}.`);
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        category,
        name: typeName.trim(),
        code: typeCode.trim(),
        description: typeDesc.trim(),
        extraData: typeExtra
      };

      const res = await api.types.create(payload);
      if (res && res.success && res.data) {
        const created = res.data;
        // Update local types list
        setTypes(prev => {
          const filtered = prev.filter(p => p.id !== created.id);
          return [...filtered, created].sort((a, b) => a.name.localeCompare(b.name));
        });

        // Auto-select newly created type
        onChange(created.name, created);
        if (onTypeCreated) {
          onTypeCreated(created);
        }

        setIsModalOpen(false);
      } else {
        setErrorMsg(res.error || 'Failed to save type.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Server error saving type.');
    } finally {
      setIsSaving(false);
    }
  };

  // Inline Edit Existing Type Name
  const handleSaveEdit = async (typeId) => {
    if (!editingName.trim()) return;
    if (isDuplicateName(editingName, typeId)) {
      alert(`"${editingName.trim()}" already exists.`);
      return;
    }

    try {
      const res = await api.types.update(typeId, { name: editingName.trim() });
      if (res && res.success && res.data) {
        setTypes(prev => prev.map(t => t.id === typeId ? res.data : t));
        if (value === types.find(t => t.id === typeId)?.name) {
          onChange(res.data.name, res.data);
        }
        setEditingTypeId(null);
        setEditingName('');
      }
    } catch (err) {
      alert(err.message || 'Failed to update type');
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (typeItem) => {
    try {
      const res = await api.types.toggleStatus(typeItem.id);
      if (res && res.success && res.data) {
        setTypes(prev => prev.map(t => t.id === typeItem.id ? res.data : t));
      }
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Filtered Types for Manage Table
  const filteredManageTypes = useMemo(() => {
    if (!manageSearch.trim()) return types;
    const q = manageSearch.trim().toLowerCase();
    return types.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [types, manageSearch]);

  const totalPages = Math.ceil(filteredManageTypes.length / itemsPerPage) || 1;
  const paginatedManageTypes = useMemo(() => {
    const start = (managePage - 1) * itemsPerPage;
    return filteredManageTypes.slice(start, start + itemsPerPage);
  }, [filteredManageTypes, managePage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', ...style }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select
          className={`form-control ${className}`}
          value={value || ''}
          onChange={handleSelectChange}
          required={required}
          disabled={disabled || isLoading}
          style={{ flex: 1, height: '36px', minWidth: 0 }}
        >
          {optionsList.length === 0 ? (
            <option value="">No {label}s added yet — Click "+" to add</option>
          ) : (
            <option value="">{placeholder}</option>
          )}

          {optionsList.map(item => (
            <option key={item.id || item.name} value={item.name}>
              {item.name} {item.code ? `(${item.code})` : ''}
            </option>
          ))}

          <option value="__ADD_NEW__" style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
            + Add New {label}...
          </option>
        </select>

        {/* Quick Add (+) Button */}
        <button
          type="button"
          onClick={openAddModal}
          disabled={disabled}
          title={`Add new ${label}`}
          className="btn btn-primary"
          style={{
            height: '36px',
            width: '36px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Plus size={16} />
        </button>

        {/* Manage Settings Gear Button */}
        {allowManage && (
          <button
            type="button"
            onClick={openManageModal}
            disabled={disabled}
            title={`Manage ${label}s`}
            className="btn btn-secondary"
            style={{
              height: '36px',
              width: '36px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Settings size={15} />
          </button>
        )}
      </div>

      {/* Modal for Add & Manage Types */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Manage ${label}s`}
        maxWidth="720px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tabs: Add New vs Manage Existing */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => { setModalTab('add'); setErrorMsg(''); }}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'none',
                borderBottom: modalTab === 'add' ? '2px solid var(--primary-600)' : '2px solid transparent',
                fontWeight: modalTab === 'add' ? 700 : 500,
                color: modalTab === 'add' ? 'var(--primary-600)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              + Add New {label}
            </button>
            <button
              type="button"
              onClick={() => { setModalTab('manage'); setErrorMsg(''); }}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'none',
                borderBottom: modalTab === 'manage' ? '2px solid var(--primary-600)' : '2px solid transparent',
                fontWeight: modalTab === 'manage' ? 700 : 500,
                color: modalTab === 'manage' ? 'var(--primary-600)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>All {label}s</span>
              <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{types.length}</span>
            </button>
          </div>

          {/* TAB 1: Add New Type */}
          {modalTab === 'add' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {errorMsg && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 'var(--radius-md)',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {label} Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Enter ${label.toLowerCase()} name`}
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveNewType(e);
                    }
                  }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Code / ID (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CD-01"
                    value={typeCode}
                    onChange={(e) => setTypeCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveNewType(e);
                      }
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description / Remarks (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Brief description..."
                    value={typeDesc}
                    onChange={(e) => setTypeDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveNewType(e);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Extra Custom Fields (e.g. for Products: Rate, GST Rate, Unit) */}
              {extraFields.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(extraFields.length, 3)}, 1fr)`,
                  gap: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0'
                }}>
                  {extraFields.map(field => (
                    <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{field.label}</label>
                      <input
                        type={field.type || 'text'}
                        step={field.step || 'any'}
                        className="form-control"
                        placeholder={field.placeholder || ''}
                        value={typeExtra[field.key] || ''}
                        onChange={(e) => setTypeExtra(prev => ({ ...prev, [field.key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveNewType(e);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                marginTop: '0.5rem'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ minWidth: '100px' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveNewType(e);
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Type'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Manage Existing Types */}
          {modalTab === 'manage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div className="search-box" style={{ flex: 1, height: '34px' }}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder={`Search ${label.toLowerCase()}s...`}
                    value={manageSearch}
                    onChange={(e) => {
                      setManageSearch(e.target.value);
                      setManagePage(1);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setModalTab('add')}
                >
                  <Plus size={14} /> Add New
                </button>
              </div>

              {filteredManageTypes.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}>
                  No {label.toLowerCase()}s found matching "{manageSearch}".
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Name</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '90px' }}>Code</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '80px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '100px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedManageTypes.map(item => {
                        const isEditing = editingTypeId === item.id;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ height: '28px', fontSize: '0.8rem' }}
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <div>
                                  <span style={{ fontWeight: 600, color: item.isActive === false ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: item.isActive === false ? 'line-through' : 'none' }}>
                                    {item.name}
                                  </span>
                                  {item.description && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.description}</div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                              {item.code || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                backgroundColor: item.isActive !== false ? '#ecfdf5' : '#f1f5f9',
                                color: item.isActive !== false ? '#059669' : '#64748b'
                              }}>
                                {item.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-xs"
                                      onClick={() => handleSaveEdit(item.id)}
                                      title="Save name"
                                      style={{ padding: '3px 6px' }}
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => { setEditingTypeId(null); setEditingName(''); }}
                                      title="Cancel"
                                      style={{ padding: '3px 6px' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => { setEditingTypeId(item.id); setEditingName(item.name); }}
                                      title="Rename type"
                                      style={{ padding: '3px 6px' }}
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => handleToggleActive(item)}
                                      title={item.isActive !== false ? 'Deactivate type' : 'Reactivate type'}
                                      style={{
                                        padding: '3px 6px',
                                        color: item.isActive !== false ? '#d97706' : '#059669'
                                      }}
                                    >
                                      <Power size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination if > 8 items */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Showing {paginatedManageTypes.length} of {filteredManageTypes.length} types</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      disabled={managePage === 1}
                      onClick={() => setManagePage(p => p - 1)}
                    >
                      Prev
                    </button>
                    <span style={{ padding: '2px 8px', fontWeight: 600 }}>{managePage} / {totalPages}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      disabled={managePage === totalPages}
                      onClick={() => setManagePage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
