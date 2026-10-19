const { getPool, isDbConnected } = require('../config/db');

class PgQuery {
  constructor(model, filter = {}) {
    this.model = model;
    this.filter = filter;
    this._sort = null;
    this._skip = null;
    this._limit = null;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  skip(n) {
    this._skip = Number(n);
    return this;
  }

  limit(n) {
    this._limit = Number(n);
    return this;
  }

  lean() {
    return this;
  }

  async exec() {
    return this.model._executeFind(this.filter, {
      sort: this._sort,
      skip: this._skip,
      limit: this._limit
    });
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

class PgModel {
  constructor(tableName, fields = {}) {
    this.tableName = tableName;
    this.fields = fields; // fieldName -> { column, type, default }
  }

  _col(field) {
    if (this.fields[field] && this.fields[field].column) {
      return this.fields[field].column;
    }
    // Convert camelCase to snake_case
    return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  _field(column) {
    for (const [f, meta] of Object.entries(this.fields)) {
      if (meta.column === column) return f;
    }
    // Convert snake_case to camelCase
    return column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  rowToDoc(row) {
    if (!row) return null;
    const doc = {
      _id: String(row.id),
      id: row.id
    };

    for (const [col, val] of Object.entries(row)) {
      if (col === 'id') continue;
      const f = this._field(col);
      const meta = this.fields[f] || {};

      if (val === null || val === undefined) {
        doc[f] = meta.default !== undefined ? meta.default : null;
        continue;
      }

      if (meta.type === 'number' || (!meta.type && typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val) && (col.includes('rate') || col.includes('price') || col.includes('cost') || col.includes('total') || col.includes('qty') || col.includes('units') || col.includes('days') || col.includes('hours') || col.includes('gross') || col.includes('net') || col.includes('deduction') || col.includes('adjustment') || col.includes('prev') || col.includes('curr') || col.includes('stock') || col.includes('gst') || col.includes('paid') || col.includes('balance')))) {
        doc[f] = Number(val);
      } else if (meta.type === 'json' || typeof val === 'object') {
        doc[f] = typeof val === 'string' ? JSON.parse(val) : val;
      } else {
        doc[f] = val;
      }
    }

    // Aliases
    if (doc.description && !doc.desc) doc.desc = doc.description;
    if (doc.desc && !doc.description) doc.description = doc.desc;

    // Attach non-enumerable .save() method to support legacy Mongoose calls on plain doc
    Object.defineProperty(doc, 'save', {
      value: async function() {
        return await this._model.findByIdAndUpdate(this.id, this);
      }.bind({ _model: this }),
      enumerable: false,
      writable: true,
      configurable: true
    });

    return doc;
  }

  _buildWhere(filter = {}) {
    const pool = getPool();
    if (!pool) throw new Error('Database not connected');

    const conditions = [];
    const values = [];

    const parseFilterObj = (obj) => {
      const parts = [];

      for (const [key, val] of Object.entries(obj)) {
        if (key === '$or' && Array.isArray(val)) {
          const orParts = [];
          for (const item of val) {
            const sub = parseFilterObj(item);
            if (sub) orParts.push(sub);
          }
          if (orParts.length > 0) {
            parts.push(`(${orParts.join(' OR ')})`);
          }
          continue;
        }

        if (key === '$and' && Array.isArray(val)) {
          const andParts = [];
          for (const item of val) {
            const sub = parseFilterObj(item);
            if (sub) andParts.push(sub);
          }
          if (andParts.length > 0) {
            parts.push(`(${andParts.join(' AND ')})`);
          }
          continue;
        }

        let col = this._col(key);
        if (key === '_id' || key === 'id') col = 'id';

        if (val === null || val === undefined) {
          parts.push(`"${col}" IS NULL`);
        } else if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
          // Operators: $in, $regex, $lte, $gte, $lt, $gt, $ne
          for (const [op, opVal] of Object.entries(val)) {
            if (op === '$in' && Array.isArray(opVal)) {
              if (opVal.length === 0) {
                parts.push('FALSE');
              } else {
                values.push(opVal);
                parts.push(`"${col}" = ANY($${values.length})`);
              }
            } else if (op === '$nin' && Array.isArray(opVal)) {
              values.push(opVal);
              parts.push(`NOT ("${col}" = ANY($${values.length}))`);
            } else if (op === '$regex') {
              values.push(`%${opVal}%`);
              parts.push(`"${col}"::text ILIKE $${values.length}`);
            } else if (op === '$gte') {
              values.push(opVal);
              parts.push(`"${col}" >= $${values.length}`);
            } else if (op === '$lte') {
              values.push(opVal);
              parts.push(`"${col}" <= $${values.length}`);
            } else if (op === '$gt') {
              values.push(opVal);
              parts.push(`"${col}" > $${values.length}`);
            } else if (op === '$lt') {
              values.push(opVal);
              parts.push(`"${col}" < $${values.length}`);
            } else if (op === '$ne') {
              values.push(opVal);
              parts.push(`"${col}" != $${values.length}`);
            }
          }
        } else {
          values.push(val);
          parts.push(`"${col}" = $${values.length}`);
        }
      }

      return parts.join(' AND ');
    };

    const whereClause = parseFilterObj(filter);
    return {
      where: whereClause ? `WHERE ${whereClause}` : '',
      values
    };
  }

  async _executeFind(filter = {}, options = {}) {
    const pool = getPool();
    if (!pool) return [];

    const { where, values } = this._buildWhere(filter);
    let order = 'ORDER BY id DESC';

    if (options.sort) {
      const orderParts = [];
      for (const [f, dir] of Object.entries(options.sort)) {
        const col = this._col(f);
        orderParts.push(`"${col}" ${dir === -1 || dir === 'desc' ? 'DESC' : 'ASC'}`);
      }
      if (orderParts.length > 0) {
        order = `ORDER BY ${orderParts.join(', ')}`;
      }
    }

    let limitClause = '';
    if (options.limit !== undefined && options.limit !== null) {
      limitClause += ` LIMIT ${Number(options.limit)}`;
    }
    if (options.skip !== undefined && options.skip !== null) {
      limitClause += ` OFFSET ${Number(options.skip)}`;
    }

    const sql = `SELECT * FROM "${this.tableName}" ${where} ${order} ${limitClause}`;
    const res = await pool.query(sql, values);
    return res.rows.map(r => this.rowToDoc(r));
  }

  find(filter = {}) {
    return new PgQuery(this, filter);
  }

  async findOne(filter = {}) {
    const docs = await this._executeFind(filter, { limit: 1 });
    return docs.length > 0 ? docs[0] : null;
  }

  async findById(id) {
    if (!id && id !== 0) return null;
    const pool = getPool();
    if (!pool) return null;

    if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) {
      const val = parseInt(id, 10);
      const sql = `SELECT * FROM "${this.tableName}" WHERE id = $1 LIMIT 1`;
      try {
        const res = await pool.query(sql, [val]);
        return res.rows.length > 0 ? this.rowToDoc(res.rows[0]) : null;
      } catch (e) {
        return null;
      }
    }

    if (typeof id === 'string') {
      const strId = id.trim();
      const cleanId = strId.replace(/^inv_/, '').trim();
      const whereParts = ['id::text = $1'];
      const params = [strId];

      if (this.tableName === 'employees' && (this.fields.empId || this.fields.emp_id)) {
        params.push(strId);
        whereParts.push(`"${this._col('empId')}"::text = $${params.length}`);
      }
      if (this.fields.invoiceNo || this.fields.invoice_no) {
        params.push(cleanId);
        whereParts.push(`"${this._col('invoiceNo')}"::text = $${params.length}`);
        if (cleanId !== strId) {
          params.push(strId);
          whereParts.push(`"${this._col('invoiceNo')}"::text = $${params.length}`);
        }
      }
      if (this.tableName === 'customers' && (this.fields.customerId || this.fields.customer_id)) {
        params.push(strId);
        whereParts.push(`"${this._col('customerId')}"::text = $${params.length}`);
      }
      if (this.tableName === 'machinery_expenses' && (this.fields.machineId || this.fields.machine_id)) {
        params.push(strId);
        whereParts.push(`"${this._col('machineId')}"::text = $${params.length}`);
      }

      const sql = `SELECT * FROM "${this.tableName}" WHERE ${whereParts.join(' OR ')} LIMIT 1`;
      try {
        const res = await pool.query(sql, params);
        return res.rows.length > 0 ? this.rowToDoc(res.rows[0]) : null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async countDocuments(filter = {}) {
    const pool = getPool();
    if (!pool) return 0;

    const { where, values } = this._buildWhere(filter);
    const sql = `SELECT COUNT(*) AS count FROM "${this.tableName}" ${where}`;
    const res = await pool.query(sql, values);
    return Number(res.rows[0]?.count || 0);
  }

  async create(data) {
    const pool = getPool();
    if (!pool) throw new Error('Database pool not connected');

    const cols = [];
    const params = [];
    const placeholders = [];
    const seenCols = new Set();

    const inputData = { ...data };

    for (const [key, val] of Object.entries(inputData)) {
      if (key === '_id' || key === 'id') continue;
      const meta = this.fields[key];
      if (!meta) continue;

      const col = meta.column || this._col(key);
      if (seenCols.has(col)) continue;
      seenCols.add(col);

      cols.push(`"${col}"`);
      params.push(meta.type === 'json' || Array.isArray(val) || (typeof val === 'object' && val !== null && !(val instanceof Date)) ? JSON.stringify(val) : val);
      placeholders.push(`$${params.length}`);
    }

    const sql = `INSERT INTO "${this.tableName}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const res = await pool.query(sql, params);
    return this.rowToDoc(res.rows[0]);
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const pool = getPool();
    if (!pool) throw new Error('Database pool not connected');

    const cleanUpdate = { ...(update.$set || update) };
    delete cleanUpdate._id;
    delete cleanUpdate.id;

    const setClauses = [];
    const params = [];
    const seenCols = new Set();

    for (const [key, val] of Object.entries(cleanUpdate)) {
      const meta = this.fields[key];
      if (!meta) continue;

      const col = meta.column || this._col(key);
      if (seenCols.has(col)) continue;
      seenCols.add(col);

      params.push(meta.type === 'json' || Array.isArray(val) || (typeof val === 'object' && val !== null && !(val instanceof Date)) ? JSON.stringify(val) : val);
      setClauses.push(`"${col}" = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`"updated_at" = NOW()`);
    let targetPk = id;
    if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) {
      targetPk = parseInt(id, 10);
    } else if (typeof id === 'string') {
      const existing = await this.findById(id);
      if (!existing) return null;
      targetPk = existing.id;
    }
    params.push(targetPk);

    const sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const res = await pool.query(sql, params);
    return res.rows.length > 0 ? this.rowToDoc(res.rows[0]) : null;
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const pool = getPool();
    if (!pool) throw new Error('Database pool not connected');

    const existing = await this.findOne(filter);
    if (!existing) {
      if (options.upsert) {
        const createData = { ...filter };
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            createData[k] = Number(v);
          }
        }
        if (update.$set) {
          Object.assign(createData, update.$set);
        }
        for (const [k, v] of Object.entries(update)) {
          if (!k.startsWith('$')) createData[k] = v;
        }
        return this.create(createData);
      }
      return null;
    }

    const updateData = {};
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        updateData[k] = (Number(existing[k]) || 0) + Number(v);
      }
    }
    if (update.$set) {
      Object.assign(updateData, update.$set);
    }
    for (const [k, v] of Object.entries(update)) {
      if (!k.startsWith('$')) updateData[k] = v;
    }

    return this.findByIdAndUpdate(existing.id, updateData, options);
  }

  async findByIdAndDelete(id) {
    const pool = getPool();
    if (!pool) return null;

    let targetPk = id;
    if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) {
      targetPk = parseInt(id, 10);
    } else if (typeof id === 'string') {
      const existing = await this.findById(id);
      if (!existing) return null;
      targetPk = existing.id;
    }

    const sql = `DELETE FROM "${this.tableName}" WHERE id = $1 RETURNING *`;
    const res = await pool.query(sql, [targetPk]);
    return res.rows.length > 0 ? this.rowToDoc(res.rows[0]) : null;
  }

  async aggregate(pipeline = []) {
    const pool = getPool();
    if (!pool) return [];

    let whereClause = '';
    const values = [];

    for (const stage of pipeline) {
      if (stage.$match) {
        const { where, values: matchVals } = this._buildWhere(stage.$match);
        whereClause = where;
        values.push(...matchVals);
      }
    }

    for (const stage of pipeline) {
      if (stage.$group) {
        const selectParts = [];
        for (const [alias, agg] of Object.entries(stage.$group)) {
          if (alias === '_id') continue;
          if (agg.$sum) {
            let field = typeof agg.$sum === 'string' ? agg.$sum.replace(/^\$/, '') : null;
            if (field) {
              const col = this._col(field);
              selectParts.push(`COALESCE(SUM("${col}"), 0) AS "${alias}"`);
            } else if (agg.$sum === 1) {
              selectParts.push(`COUNT(*) AS "${alias}"`);
            }
          }
        }

        if (selectParts.length > 0) {
          const sql = `SELECT ${selectParts.join(', ')} FROM "${this.tableName}" ${whereClause}`;
          const res = await pool.query(sql, values);
          return res.rows.map(r => {
            const out = { _id: null };
            for (const [k, v] of Object.entries(r)) {
              out[k] = Number(v);
            }
            return out;
          });
        }
      }
    }

    return [];
  }
}

module.exports = PgModel;
