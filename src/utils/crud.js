const db = require('../config/database');

const findAll = async (table) => {
  const result = await db.query(`SELECT * FROM ${table} ORDER BY id DESC`);
  return result.rows;
};

const findById = async (table, id) => {
  const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0];
};

const create = async (table, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  
  const result = await db.query(query, values);
  return result.rows[0];
};

const update = async (table, id, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const query = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
  
  const result = await db.query(query, [...values, id]);
  return result.rows[0];
};

const remove = async (table, id) => {
  const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0];
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
