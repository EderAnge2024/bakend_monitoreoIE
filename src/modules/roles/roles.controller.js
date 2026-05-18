const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM roles ORDER BY id_rol ASC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll
};
