// ==== File: backend/models/Tag.js ====
const db = require('../config/db');

/**
 * Find a tag by its name.
 * @param {string} name - The name of the tag.
 * @returns {Promise<Object|null>} The tag object or null if not found.
 */
const findByName = async (name) => {
  const result = await db.query('SELECT * FROM tags WHERE name = $1', [name]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Find a tag by its ID.
 * @param {string} id - The UUID of the tag.
 * @returns {Promise<Object|null>} The tag object or null if not found.
 */
const findById = async (id) => {
  const result = await db.query('SELECT * FROM tags WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Create a new tag if it doesn't exist, or return the existing one.
 * @param {string} name - The name of the tag.
 * @param {Object} client - Optional database client for transactions.
 * @returns {Promise<Object>} The created or existing tag object.
 */
const findOrCreate = async (name, client = db) => {
  const existingTag = await client.query('SELECT * FROM tags WHERE name = $1', [name]);
  if (existingTag.rows.length > 0) {
    return existingTag.rows[0];
  }
  const result = await client.query(
    'INSERT INTO tags (name) VALUES ($1) RETURNING *',
    [name]
  );
  return result.rows[0];
};

/**
 * Get all tags.
 * @returns {Promise<Array<Object>>} A list of all tags.
 */
const getAll = async () => {
  const result = await db.query('SELECT id, name FROM tags ORDER BY name');
  return result.rows;
};

/**
 * Get all unique tag names that are associated with at least one published course.
 * @returns {Promise<Array<string>>} An array of tag names.
 */
const getUniqueCourseTagNames = async () => {
    const query = `
        SELECT DISTINCT t.name
        FROM tags t
        JOIN course_tags ct ON t.id = ct.tag_id
        JOIN courses c ON ct.course_id = c.id
        WHERE c.is_published = true
        ORDER BY t.name;
    `;
    const result = await db.query(query);
    return result.rows.map(row => row.name);
};


module.exports = {
  findByName,
  findById,
  findOrCreate,
  getAll,
  getUniqueCourseTagNames,
};