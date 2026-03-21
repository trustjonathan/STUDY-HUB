const { DataTypes } = require('sequelize');
const sequelize = require('../../config/postgres');
const User = require('./user');

const Note = sequelize.define('Note', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT },
  ownerId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  tableName: 'notes',
  timestamps: true
});

// Associations
Note.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Note, { foreignKey: 'ownerId', as: 'notes' });

module.exports = Note;