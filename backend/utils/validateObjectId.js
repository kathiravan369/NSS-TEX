function isValidObjectId(id) {
  if (!id && id !== 0) return false;
  const str = String(id).trim();
  // Allow numeric IDs (PostgreSQL SERIAL), 24-hex MongoDB ObjectIds, or UUIDs
  return /^\d+$/.test(str) || /^[0-9a-fA-F]{24}$/.test(str) || /^[0-9a-fA-F-]{36}$/.test(str);
}

module.exports = { isValidObjectId };
