const mongoose = require('mongoose');
const { MasterType } = require('../models');
const runtimeStore = require('../utils/runtimeStore');
const { getPool } = require('../config/db');

// @desc    Get master types with filtering, searching, and pagination
// @route   GET /api/types
// @access  Public
exports.getTypes = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { category, search, includeInactive, page = 1, limit = 200 } = req.query;

    const boolIncludeInactive = includeInactive === 'true' || includeInactive === true;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(500, Math.max(1, Number(limit) || 200));
    const offset = (pageNum - 1) * limitNum;

    if (isDbConnected) {
      const pool = getPool();
      if (pool) {
        const whereClauses = [];
        const params = [];

        if (category) {
          params.push(category.trim());
          whereClauses.push(`category = $${params.length}`);
        }

        if (!boolIncludeInactive) {
          whereClauses.push(`is_active = TRUE`);
        }

        if (search && search.trim()) {
          params.push(`%${search.trim().toLowerCase()}%`);
          whereClauses.push(`(LOWER(name) LIKE $${params.length} OR LOWER(code) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const countSql = `SELECT COUNT(*) AS count FROM master_types ${whereSql}`;
        const countRes = await pool.query(countSql, params);
        const total = Number(countRes.rows[0]?.count || 0);

        const dataSql = `SELECT * FROM master_types ${whereSql} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const dataRes = await pool.query(dataSql, [...params, limitNum, offset]);
        const types = dataRes.rows.map(r => MasterType.rowToDoc(r));

        return res.json({
          success: true,
          count: types.length,
          total,
          pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
          data: types
        });
      }
    }

    // Runtime store fallback
    let result = [...runtimeStore.types];
    if (category) {
      result = result.filter(t => t.category === category.trim());
    }
    if (!boolIncludeInactive) {
      result = result.filter(t => t.isActive !== false);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const total = result.length;
    const paginated = result.slice(offset, offset + limitNum);

    res.json({
      success: true,
      count: paginated.length,
      total,
      pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      data: paginated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single type by ID
// @route   GET /api/types/:id
// @access  Public
exports.getTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const type = await MasterType.findById(id);
      if (!type) {
        return res.status(404).json({ success: false, error: 'Type not found' });
      }
      return res.json({ success: true, data: type });
    }

    const type = runtimeStore.types.find(t => String(t.id) === String(id) || String(t._id) === String(id));
    if (!type) {
      return res.status(404).json({ success: false, error: 'Type not found' });
    }
    res.json({ success: true, data: type });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new master type with duplicate-name prevention
// @route   POST /api/types
// @access  Public
exports.createType = async (req, res, next) => {
  try {
    const { category, name, code, description, extraData } = req.body;

    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Type name is required' });
    }

    const cleanCategory = category.trim();
    const cleanName = name.trim();
    const cleanCode = (code || '').trim();
    const cleanDescription = (description || '').trim();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const pool = getPool();
      if (pool) {
        // Prevent duplicate names within the same category (case-insensitive)
        const checkSql = `SELECT id, is_active FROM master_types WHERE category = $1 AND LOWER(TRIM(name)) = LOWER($2) LIMIT 1`;
        const checkRes = await pool.query(checkSql, [cleanCategory, cleanName]);

        if (checkRes.rows.length > 0) {
          const existing = checkRes.rows[0];
          // If it was inactive, reactivate it
          if (!existing.is_active) {
            const updateSql = `UPDATE master_types SET is_active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`;
            const reactivateRes = await pool.query(updateSql, [existing.id]);
            return res.status(200).json({
              success: true,
              data: MasterType.rowToDoc(reactivateRes.rows[0]),
              message: 'Reactivated existing type'
            });
          }
          return res.status(400).json({
            success: false,
            error: `"${cleanName}" already exists in ${cleanCategory.replace(/_/g, ' ')}`
          });
        }

        const newType = await MasterType.create({
          category: cleanCategory,
          name: cleanName,
          code: cleanCode,
          description: cleanDescription,
          extraData: extraData || {},
          isActive: true
        });

        return res.status(201).json({ success: true, data: newType });
      }
    }

    // In-memory fallback
    const exists = runtimeStore.types.some(
      t => t.category === cleanCategory && t.name.toLowerCase() === cleanName.toLowerCase() && t.isActive !== false
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        error: `"${cleanName}" already exists in ${cleanCategory.replace(/_/g, ' ')}`
      });
    }

    const newType = {
      id: Date.now(),
      _id: String(Date.now()),
      category: cleanCategory,
      name: cleanName,
      code: cleanCode,
      description: cleanDescription,
      extraData: extraData || {},
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    runtimeStore.types.push(newType);

    res.status(201).json({ success: true, data: newType });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing type
// @route   PUT /api/types/:id
// @access  Public
exports.updateType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, extraData, isActive } = req.body;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const existing = await MasterType.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Type not found' });
      }

      const pool = getPool();
      if (name && name.trim() && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
        const checkSql = `SELECT id FROM master_types WHERE category = $1 AND LOWER(TRIM(name)) = LOWER($2) AND id != $3 LIMIT 1`;
        const checkRes = await pool.query(checkSql, [existing.category, name.trim(), existing.id]);
        if (checkRes.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Another type named "${name.trim()}" already exists in this category`
          });
        }
      }

      const updated = await MasterType.findByIdAndUpdate(existing.id, {
        name: name !== undefined ? name.trim() : existing.name,
        code: code !== undefined ? code.trim() : existing.code,
        description: description !== undefined ? description.trim() : existing.description,
        extraData: extraData !== undefined ? extraData : existing.extraData,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive
      }, { new: true });

      return res.json({ success: true, data: updated });
    }

    const idx = runtimeStore.types.findIndex(t => String(t.id) === String(id) || String(t._id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Type not found' });
    }

    const current = runtimeStore.types[idx];
    if (name && name.trim() && name.trim().toLowerCase() !== current.name.toLowerCase()) {
      const exists = runtimeStore.types.some(
        t => t.category === current.category && t.name.toLowerCase() === name.trim().toLowerCase() && String(t.id) !== String(id)
      );
      if (exists) {
        return res.status(400).json({
          success: false,
          error: `Another type named "${name.trim()}" already exists in this category`
        });
      }
    }

    runtimeStore.types[idx] = {
      ...current,
      name: name !== undefined ? name.trim() : current.name,
      code: code !== undefined ? code.trim() : current.code,
      description: description !== undefined ? description.trim() : current.description,
      extraData: extraData !== undefined ? extraData : current.extraData,
      isActive: isActive !== undefined ? Boolean(isActive) : current.isActive,
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, data: runtimeStore.types[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle active/inactive status
// @route   PATCH /api/types/:id/toggle-status
// @access  Public
exports.toggleTypeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const existing = await MasterType.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Type not found' });
      }

      const updated = await MasterType.findByIdAndUpdate(existing.id, {
        isActive: !existing.isActive
      }, { new: true });

      return res.json({ success: true, data: updated });
    }

    const idx = runtimeStore.types.findIndex(t => String(t.id) === String(id) || String(t._id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Type not found' });
    }

    runtimeStore.types[idx].isActive = !runtimeStore.types[idx].isActive;
    runtimeStore.types[idx].updatedAt = new Date().toISOString();

    res.json({ success: true, data: runtimeStore.types[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete type (or soft-deactivate)
// @route   DELETE /api/types/:id
// @access  Public
exports.deleteType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const pool = getPool();
      if (pool) {
        await pool.query('DELETE FROM master_types WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Type deleted successfully' });
      }
    }

    runtimeStore.types = runtimeStore.types.filter(t => String(t.id) !== String(id) && String(t._id) !== String(id));
    res.json({ success: true, message: 'Type deleted successfully' });
  } catch (error) {
    next(error);
  }
};
