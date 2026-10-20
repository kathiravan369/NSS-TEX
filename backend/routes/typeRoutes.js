const express = require('express');
const router = express.Router();
const {
  getTypes,
  getTypeById,
  createType,
  updateType,
  toggleTypeStatus,
  deleteType
} = require('../controllers/typeController');

router.route('/')
  .get(getTypes)
  .post(createType);

router.route('/:id')
  .get(getTypeById)
  .put(updateType)
  .delete(deleteType);

router.route('/:id/toggle-status')
  .patch(toggleTypeStatus);

module.exports = router;
