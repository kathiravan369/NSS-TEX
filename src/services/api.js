// Centralized Frontend API Service
// Connects React.js UI to Node.js / Express backend with MongoDB persistence
// Base URL is environment-aware and defaults to http://localhost:5000/api

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'http://localhost:5000/api');

/**
 * Core HTTP client wrapper with error handling and retry support
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        (data && data.error) ||
        (data && data.message) ||
        `Request failed with status ${response.status}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    console.warn(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Helper to build query parameter strings
 */
function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const api = {
  baseURL: API_BASE_URL,

  // 1. Dashboard Endpoints
  dashboard: {
    getSummary() {
      return request('/dashboard/summary');
    },
    getExpenses() {
      return request('/dashboard/expenses');
    },
    getRecentTransactions() {
      return request('/dashboard/recent-transactions');
    }
  },

  // 2. Employee Endpoints
  employees: {
    getAll(params = {}) {
      return request(`/employees${buildQuery(params)}`);
    },
    getById(id) {
      return request(`/employees/${id}`);
    },
    create(data) {
      return request('/employees', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id, data) {
      return request(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    patchStatus(id, status) {
      return request(`/employees/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    }
  },

  // 3. Thread Purchases Endpoints (With & Without GST)
  threadPurchases: {
    getAll(params = {}) {
      return request(`/thread-purchases${buildQuery(params)}`);
    },
    getById(id) {
      return request(`/thread-purchases/${id}`);
    },
    create(data) {
      return request('/thread-purchases', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id, data) {
      return request(`/thread-purchases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id) {
      return request(`/thread-purchases/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // 4. Oil Purchases & Inventory Endpoints
  oil: {
    getPurchases(params = {}) {
      return request(`/oil-purchases${buildQuery(params)}`);
    },
    createPurchase(data) {
      return request('/oil-purchases', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    updatePurchase(id, data) {
      return request(`/oil-purchases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    getStock() {
      return request('/oil-stock');
    }
  },

  // 5. Machinery Cost Endpoints
  machinery: {
    getAll(params = {}) {
      return request(`/machinery-expenses${buildQuery(params)}`);
    },
    create(data) {
      return request('/machinery-expenses', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id, data) {
      return request(`/machinery-expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id) {
      return request(`/machinery-expenses/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // 6. Electricity Cost Endpoints
  electricity: {
    getAll(params = {}) {
      return request(`/electricity-expenses${buildQuery(params)}`);
    },
    create(data) {
      return request('/electricity-expenses', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id, data) {
      return request(`/electricity-expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id) {
      return request(`/electricity-expenses/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // 7. Weekly Payroll Endpoints
  payroll: {
    getWeekly(params = {}) {
      return request(`/payroll/weekly${buildQuery(params)}`);
    },
    getWeeklyById(id) {
      return request(`/payroll/weekly/${id}`);
    },
    createWeekly(data) {
      return request('/payroll/weekly', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    updateWeekly(id, data) {
      return request(`/payroll/weekly/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    finalize(id) {
      return request(`/payroll/weekly/${id}/finalize`, {
        method: 'PATCH'
      });
    },
    recordPayment(id, paymentData = {}) {
      return request(`/payroll/weekly/${id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify(paymentData)
      });
    }
  },

  // 8. Reports Endpoints
  reports: {
    getMonthlySalary(params = {}) {
      return request(`/reports/salary/monthly${buildQuery(params)}`);
    },
    getEmployeeSalary(params = {}) {
      return request(`/reports/salary/employee${buildQuery(params)}`);
    },
    getMonthlyExpenses(params = {}) {
      return request(`/reports/expenses/monthly${buildQuery(params)}`);
    }
  },

  // 9. Health & System
  health: {
    check() {
      return request('/health');
    }
  }
};

export default api;
