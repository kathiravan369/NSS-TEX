import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

// Helper to format Date object to "YYYY-MM-DD"
export function formatDateYMD(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper to parse "YYYY-MM-DD" safely in local timezone
export function parseDateSafe(str) {
  if (!str) return null;
  if (typeof str === 'string' && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'oneMonth', label: 'One month' },
  { id: 'prevMonth', label: 'Prev month' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'last7Days', label: 'Last 7 days' },
  { id: 'prevWeek', label: 'Prev week' },
  { id: 'prev2Weeks', label: 'Prev 2 weeks' },
  { id: 'last14Days', label: 'Last 14 days' },
  { id: 'custom', label: 'Custom Range' }
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DateRangePicker({
  startDate = '',
  endDate = '',
  onChange,
  onReset,
  placeholder = 'Select Date Range',
  defaultPreset = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Active dates state
  const [activeStart, setActiveStart] = useState(startDate ? parseDateSafe(startDate) : null);
  const [activeEnd, setActiveEnd] = useState(endDate ? parseDateSafe(endDate) : null);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset);

  // Base month for dual calendar (left calendar)
  const [baseMonth, setBaseMonth] = useState(() => {
    if (startDate) {
      const d = parseDateSafe(startDate);
      if (d) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Sync internal dates when props change externally
  useEffect(() => {
    setActiveStart(startDate ? parseDateSafe(startDate) : null);
    setActiveEnd(endDate ? parseDateSafe(endDate) : null);
  }, [startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Second calendar month (right calendar)
  const nextMonth = useMemo(() => {
    return new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
  }, [baseMonth]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setBaseMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1));
  };

  // Preset date calculator
  const applyPreset = (presetId) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let s = null;
    let e = null;

    switch (presetId) {
      case 'today':
        s = new Date(today);
        e = new Date(today);
        break;
      case 'yesterday':
        s = new Date(today);
        s.setDate(s.getDate() - 1);
        e = new Date(s);
        break;
      case 'thisMonth':
        s = new Date(today.getFullYear(), today.getMonth(), 1);
        e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'oneMonth':
        s = new Date(today);
        s.setMonth(s.getMonth() - 1);
        e = new Date(today);
        break;
      case 'prevMonth':
        s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        e = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisWeek': {
        const day = today.getDay(); // 0 is Sun, 1 is Mon
        const diff = (day + 6) % 7; // Days since Monday
        s = new Date(today);
        s.setDate(s.getDate() - diff);
        e = new Date(s);
        e.setDate(e.getDate() + 6);
        break;
      }
      case 'last7Days':
        s = new Date(today);
        s.setDate(s.getDate() - 6);
        e = new Date(today);
        break;
      case 'prevWeek': {
        const day = today.getDay();
        const diff = (day + 6) % 7;
        s = new Date(today);
        s.setDate(s.getDate() - diff - 7);
        e = new Date(s);
        e.setDate(e.getDate() + 6);
        break;
      }
      case 'prev2Weeks': {
        const day = today.getDay();
        const diff = (day + 6) % 7;
        s = new Date(today);
        s.setDate(s.getDate() - diff - 14);
        e = new Date(s);
        e.setDate(e.getDate() + 13);
        break;
      }
      case 'last14Days':
        s = new Date(today);
        s.setDate(s.getDate() - 13);
        e = new Date(today);
        break;
      case 'custom':
        setSelectedPreset('custom');
        return;
      default:
        break;
    }

    if (s && e) {
      setActiveStart(s);
      setActiveEnd(e);
      setSelectedPreset(presetId);
      setBaseMonth(new Date(s.getFullYear(), s.getMonth(), 1));
      if (onChange) {
        onChange({
          startDate: formatDateYMD(s),
          endDate: formatDateYMD(e),
          preset: presetId
        });
      }
    }
  };

  // Handle clicking a calendar date cell
  const handleDateClick = (clickedDate) => {
    setSelectedPreset('custom');
    if (!activeStart || (activeStart && activeEnd)) {
      // First click: start new range
      setActiveStart(clickedDate);
      setActiveEnd(null);
    } else if (activeStart && !activeEnd) {
      // Second click: finish range
      let s = activeStart;
      let e = clickedDate;
      if (e < s) {
        const temp = s;
        s = e;
        e = temp;
      }
      setActiveStart(s);
      setActiveEnd(e);
      if (onChange) {
        onChange({
          startDate: formatDateYMD(s),
          endDate: formatDateYMD(e),
          preset: 'custom'
        });
      }
    }
  };

  const handleReset = (e) => {
    if (e) e.stopPropagation();
    setActiveStart(null);
    setActiveEnd(null);
    setSelectedPreset(null);
    if (onReset) {
      onReset();
    } else if (onChange) {
      onChange({ startDate: '', endDate: '', preset: null });
    }
  };

  // Generate calendar days for a given month Date
  const getMonthDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Blank padding before 1st day of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  // Check if date is start, end, or inside selected/hovered range
  const isDateSelected = (d) => {
    if (!d) return { isStart: false, isEnd: false, isInRange: false };
    const t = d.getTime();
    const s = activeStart ? new Date(activeStart.getFullYear(), activeStart.getMonth(), activeStart.getDate()).getTime() : null;
    const e = activeEnd ? new Date(activeEnd.getFullYear(), activeEnd.getMonth(), activeEnd.getDate()).getTime() : null;

    const isStart = s !== null && t === s;
    const isEnd = e !== null && t === e;

    let isInRange = false;
    if (s !== null && e !== null) {
      isInRange = t > s && t < e;
    } else if (s !== null && !e && hoveredDate) {
      const h = new Date(hoveredDate.getFullYear(), hoveredDate.getMonth(), hoveredDate.getDate()).getTime();
      const min = Math.min(s, h);
      const max = Math.max(s, h);
      isInRange = t > min && t < max;
    }

    return { isStart, isEnd, isInRange };
  };

  // Label text for trigger pill
  const displayText = useMemo(() => {
    if (activeStart && activeEnd) {
      return `${formatDateYMD(activeStart)} - ${formatDateYMD(activeEnd)}`;
    }
    if (activeStart && !activeEnd) {
      return `${formatDateYMD(activeStart)} - Select end`;
    }
    return placeholder;
  }, [activeStart, activeEnd, placeholder]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        userSelect: 'none'
      }}
    >
      {/* Reset Button */}
      {(activeStart || activeEnd || selectedPreset) && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset date filter"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.color = '#0f172a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <RotateCcw size={15} />
        </button>
      )}

      {/* Trigger Pill / Input matching screenshot */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.6rem',
          height: '36px',
          padding: '0 0.85rem',
          borderRadius: 'var(--radius-sm, 6px)',
          border: isOpen ? '1px solid #0d9488' : '1px solid #cbd5e1',
          boxShadow: isOpen ? '0 0 0 2px rgba(13, 148, 136, 0.15)' : 'none',
          backgroundColor: '#ffffff',
          color: activeStart ? '#0f172a' : '#64748b',
          fontSize: '0.8125rem',
          fontWeight: activeStart ? 600 : 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <CalendarIcon size={15} color="#0d9488" />
        <span style={{ minWidth: '175px', textAlign: 'center' }}>{displayText}</span>
        <CalendarIcon size={15} color="#64748b" />
      </div>

      {/* Dual-Month Popover Dropdown matching screenshot */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 9999,
            display: 'flex',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            minWidth: '680px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Left Column: Preset Options matching screenshot */}
          <div
            style={{
              width: '150px',
              borderRight: '1px solid #f1f5f9',
              padding: '0.75rem 0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              backgroundColor: '#fafbfc'
            }}
          >
            {PRESETS.map((p) => {
              const isSelected = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    textAlign: 'left',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? '#009688' : 'transparent',
                    color: isSelected ? '#ffffff' : '#475569'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.color = '#0f172a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Right Column: Two Months Side-by-Side */}
          <div style={{ flex: 1, padding: '1rem 1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Left Calendar Month */}
              <div>
                {/* Month Header with < button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#475569',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex'
                    }}
                    title="Previous month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                    {MONTH_NAMES[baseMonth.getMonth()]} {baseMonth.getFullYear()}
                  </span>
                  <div style={{ width: '18px' }} />
                </div>

                {/* Weekday Labels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '4px' }}>
                  {WEEK_DAYS.map((wd) => (
                    <span key={wd} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>
                      {wd}
                    </span>
                  ))}
                </div>

                {/* Month 1 Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
                  {getMonthDays(baseMonth).map((d, idx) => {
                    if (!d) return <div key={`empty-left-${idx}`} style={{ height: '32px' }} />;
                    const { isStart, isEnd, isInRange } = isDateSelected(d);
                    const isEdge = isStart || isEnd;

                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => handleDateClick(d)}
                        onMouseEnter={() => activeStart && !activeEnd && setHoveredDate(d)}
                        style={{
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: isEdge ? 700 : 500,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: isEdge ? '6px' : '0px',
                          backgroundColor: isEdge ? '#009688' : isInRange ? '#e0f2fe' : 'transparent',
                          color: isEdge ? '#ffffff' : isInRange ? '#0284c7' : '#1e293b',
                          transition: 'background-color 0.1s ease'
                        }}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Calendar Month */}
              <div>
                {/* Month Header with > button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}
                >
                  <div style={{ width: '18px' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                    {MONTH_NAMES[nextMonth.getMonth()]} {nextMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#475569',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex'
                    }}
                    title="Next month"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Weekday Labels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '4px' }}>
                  {WEEK_DAYS.map((wd) => (
                    <span key={wd} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>
                      {wd}
                    </span>
                  ))}
                </div>

                {/* Month 2 Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
                  {getMonthDays(nextMonth).map((d, idx) => {
                    if (!d) return <div key={`empty-right-${idx}`} style={{ height: '32px' }} />;
                    const { isStart, isEnd, isInRange } = isDateSelected(d);
                    const isEdge = isStart || isEnd;

                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => handleDateClick(d)}
                        onMouseEnter={() => activeStart && !activeEnd && setHoveredDate(d)}
                        style={{
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: isEdge ? 700 : 500,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: isEdge ? '6px' : '0px',
                          backgroundColor: isEdge ? '#009688' : isInRange ? '#e0f2fe' : 'transparent',
                          color: isEdge ? '#ffffff' : isInRange ? '#0284c7' : '#1e293b',
                          transition: 'background-color 0.1s ease'
                        }}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions Footer */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {activeStart && activeEnd ? (
                  <span>
                    Range: <strong>{formatDateYMD(activeStart)}</strong> to <strong>{formatDateYMD(activeEnd)}</strong>
                  </span>
                ) : (
                  <span>Click start date, then end date</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', height: '30px', padding: '0 0.75rem' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-primary btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    height: '30px',
                    padding: '0 0.85rem',
                    backgroundColor: '#009688',
                    borderColor: '#009688'
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
