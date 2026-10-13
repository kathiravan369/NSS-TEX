import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Fuel,
  Cpu,
  Zap,
  Calendar,
  Wallet,
  Users,
  PlusCircle,
  FileText,
  UserPlus,
  Clock,
  ArrowRight,
  TrendingUp,
  ShoppingCart,
  CalendarX2,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import MetricCard from '../components/common/MetricCard';
import StatusBadge from '../components/common/StatusBadge';
import { dashboardService } from '../services/dashboardService';
import { formatINR } from '../utils/formatters';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendYear, setTrendYear] = useState(new Date().getFullYear().toString());
  const [statsPeriod, setStatsPeriod] = useState('This Month');

  const loadData = async (year = trendYear, period = statsPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getDashboardData(year, period);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(trendYear, statsPeriod);
  }, [trendYear, statsPeriod]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <RotateCw className="animate-spin" size={32} color="var(--primary-600)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading manufacturing metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="erp-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Unable to load Dashboard</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{error || 'No data returned.'}</p>
        <button className="btn btn-primary" onClick={() => loadData(trendYear, statsPeriod)}><RotateCw size={14} /> Retry</button>
      </div>
    );
  }

  const {
    kpis = {},
    expenseComparison = [],
    expenseBreakup = [],
    totalExpensesThisMonth = 0,
    monthlyTrend = [],
    keyStats = {},
    recentTransactions = []
  } = data;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Overview of your manufacturing expenses, production and salary details</p>
        </div>
        <div className="date-pill">
          <Calendar size={14} />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* Row 1: 4 Top Raw Material & Cost KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard
          title="Total Raw Material Expenses"
          value={formatINR(kpis.totalRawMaterial || 0)}
          trend={kpis.totalRawMaterialTrend?.value || 'Live'}
          trendType={kpis.totalRawMaterialTrend?.type || 'neutral'}
          trendText={kpis.totalRawMaterialTrend?.period || 'Real-time'}
          icon={Package}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Thread Expenses (With GST)"
          value={formatINR(kpis.threadWithGST || 0)}
          trend={kpis.threadWithGSTTrend?.value || 'Live'}
          trendType={kpis.threadWithGSTTrend?.type || 'neutral'}
          trendText={kpis.threadWithGSTTrend?.period || 'Real-time'}
          icon={Layers}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Thread Expenses (Without GST)"
          value={formatINR(kpis.threadWithoutGST || 0)}
          trend={kpis.threadWithoutGSTTrend?.value || 'Live'}
          trendType={kpis.threadWithoutGSTTrend?.type || 'neutral'}
          trendText={kpis.threadWithoutGSTTrend?.period || 'Real-time'}
          icon={Layers}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <MetricCard
          title="Oil Expenses"
          value={formatINR(kpis.oilExpenses || 0)}
          trend={kpis.oilExpensesTrend?.value || 'Live'}
          trendType={kpis.oilExpensesTrend?.type || 'neutral'}
          trendText={kpis.oilExpensesTrend?.period || 'Real-time'}
          icon={Fuel}
          iconBg="#fffbeb"
          iconColor="#d97706"
        />
      </div>

      {/* Row 2: 5 Operational & Salary KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <MetricCard
          title="Machinery Expenses"
          value={formatINR(kpis.machineryCost || 0)}
          trend={kpis.machineryCostTrend?.value || 'Live'}
          trendType={kpis.machineryCostTrend?.type || 'neutral'}
          trendText={kpis.machineryCostTrend?.period || 'Real-time'}
          icon={Cpu}
          iconBg="#eff6ff"
          iconColor="#3b82f6"
        />
        <MetricCard
          title="Electricity Expenses"
          value={formatINR(kpis.electricityCost || 0)}
          trend={kpis.electricityCostTrend?.value || 'Live'}
          trendType={kpis.electricityCostTrend?.type || 'neutral'}
          trendText={kpis.electricityCostTrend?.period || 'Real-time'}
          icon={Zap}
          iconBg="#fef3c7"
          iconColor="#ca8a04"
        />
        <MetricCard
          title="Weekly Salary Expenses"
          value={formatINR(kpis.weeklySalary || 0)}
          trend={kpis.weeklySalaryTrend?.value || 'Live'}
          trendType={kpis.weeklySalaryTrend?.type || 'neutral'}
          trendText={kpis.weeklySalaryTrend?.period || 'Real-time'}
          icon={Calendar}
          iconBg="#fee2e2"
          iconColor="#dc2626"
        />
        <MetricCard
          title="Est. Monthly Salary Expenses"
          value={formatINR(kpis.estMonthlySalary || 0)}
          trend={kpis.estMonthlySalaryTrend?.value || 'Live'}
          trendType={kpis.estMonthlySalaryTrend?.type || 'neutral'}
          trendText={kpis.estMonthlySalaryTrend?.period || 'Real-time'}
          icon={Wallet}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Total Employees"
          value={kpis.totalEmployees || 0}
          trend={kpis.totalEmployeesTrend?.value || `${kpis.totalEmployees || 0} Active`}
          trendType={kpis.totalEmployeesTrend?.type || 'up'}
          trendText={kpis.totalEmployeesTrend?.period || 'current'}
          icon={Users}
          iconBg="#dcfce7"
          iconColor="#16a34a"
        />
      </div>

      {/* Middle Section: Comparison Chart (Left) + Breakup Donut (Center) + Quick Actions (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr', gap: '1.25rem' }}>
        {/* Weekly vs Monthly Expense Comparison */}
        <div className="erp-card">
          <div className="card-header">
            <h3 className="card-title">Weekly vs Monthly Expense Comparison</h3>
          </div>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseComparison} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                    return `₹${val}`;
                  }}
                />
                <Tooltip
                  formatter={(value) => [formatINR(value), '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar dataKey="weekly" name="Weekly Salary" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="monthly" name="Total Expenses" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakup Doughnut */}
        <div className="erp-card">
          <div className="card-header">
            <h3 className="card-title">Expense Breakup</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 230, position: 'relative' }}>
            <div style={{ width: '100%', height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakup}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {expenseBreakup.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${val}% (${formatINR(item?.payload?.amount || 0)})`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: 'absolute',
                  top: '52px',
                  left: '0',
                  right: '0',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}
              >
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatINR(totalExpensesThisMonth)}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Total Expenses</div>
              </div>
            </div>

            {/* Compact Legend List */}
            <div
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.25rem 0.5rem',
                fontSize: '0.72rem',
                marginTop: '0.25rem'
              }}
            >
              {expenseBreakup.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <strong>{item.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="erp-card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'space-between', height: '44px', textAlign: 'left', padding: '0 0.85rem' }}
              onClick={() => navigate('/raw-materials/thread-gst')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <PlusCircle size={17} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Add Raw Material</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>Thread, oil or other materials</div>
                </div>
              </span>
              <ArrowRight size={14} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', height: '44px', textAlign: 'left', padding: '0 0.85rem' }}
              onClick={() => navigate('/machinery-cost')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={17} color="var(--primary-600)" />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Add Expense</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Machinery, electricity cost</div>
                </div>
              </span>
              <ArrowRight size={14} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', height: '44px', textAlign: 'left', padding: '0 0.85rem' }}
              onClick={() => navigate('/salary/employees')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={17} color="#7c3aed" />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Add Employee</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Register a new employee</div>
                </div>
              </span>
              <ArrowRight size={14} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', height: '44px', textAlign: 'left', padding: '0 0.85rem' }}
              onClick={() => navigate('/salary/weekly')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Clock size={17} color="#059669" />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Record Salary</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Add weekly work details</div>
                </div>
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Transactions (Left) + Monthly Trend & Key Stats (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr', gap: '1.25rem' }}>
        {/* Left: Recent Expense Transactions Table */}
        <div className="erp-card">
          <div className="card-header">
            <div className="card-title-group">
              <FileText size={18} color="var(--primary-600)" />
              <h3 className="card-title">Recent Transactions</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/raw-materials/thread-gst')}>
              View All
            </button>
          </div>

          <div className="table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Ref No</th>
                  <th>Amount (₹)</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                      No transactions recorded yet. Click "Add Raw Material" or "Add Expense" above to add your first entry.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id || Math.random()}>
                      <td>{tx.date}</td>
                      <td><strong style={{ fontSize: '0.78rem' }}>{tx.category}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{tx.desc}</td>
                      <td><code style={{ fontSize: '0.725rem', color: '#64748b' }}>{tx.refNo}</code></td>
                      <td><strong>{formatINR(tx.amount || 0)}</strong></td>
                      <td><StatusBadge status={tx.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Monthly Expense Trend Line Chart + Key Statistics Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Trend Line Chart */}
          <div className="erp-card">
            <div className="card-header">
              <div className="card-title-group">
                <TrendingUp size={16} color="var(--primary-600)" />
                <h3 className="card-title">Monthly Expense Trend</h3>
              </div>
              <select
                className="form-control"
                style={{ width: '85px', height: '28px', fontSize: '0.75rem', padding: '0 0.4rem' }}
                value={trendYear}
                onChange={(e) => setTrendYear(e.target.value)}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => {
                      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                      return `₹${val}`;
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [formatINR(value), '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="rawMaterial" name="Raw Material" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="machinery" name="Machinery" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="electricity" name="Electricity" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="salary" name="Salary" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Statistics Grid */}
          <div className="erp-card">
            <div className="card-header">
              <h3 className="card-title">Key Statistics</h3>
              <select
                className="form-control"
                style={{ width: '105px', height: '28px', fontSize: '0.75rem', padding: '0 0.4rem' }}
                value={statsPeriod}
                onChange={(e) => setStatsPeriod(e.target.value)}
              >
                <option value="This Month">This Month</option>
                <option value="All Time">All Time</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Purchases</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {keyStats.totalPurchases?.count ?? 0}{' '}
                    <span style={{ fontSize: '0.68rem', color: '#059669' }}>{keyStats.totalPurchases?.trend || ''}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Production</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {keyStats.totalProduction?.count ?? '0 Pcs'}{' '}
                    <span style={{ fontSize: '0.68rem', color: '#059669' }}>{keyStats.totalProduction?.trend || ''}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Employees Present</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {keyStats.employeesPresent?.count ?? 0}{' '}
                    <span style={{ fontSize: '0.68rem', color: '#059669' }}>{keyStats.employeesPresent?.trend || ''}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarX2 size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Leave Days</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {keyStats.leaveDays?.count ?? 0}{' '}
                    <span style={{ fontSize: '0.68rem', color: '#dc2626' }}>{keyStats.leaveDays?.trend || ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
