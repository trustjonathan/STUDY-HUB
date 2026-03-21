const { DataTypes } = require('sequelize');
const sequelize = require('../../config/postgres');
const User = require('./user');

const Flashcard = sequelize.define('Flashcard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  question: { type: DataTypes.TEXT, allowNull: false },
  answer: { type: DataTypes.TEXT },
  ownerId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  tableName: 'flashcards',
  timestamps: true
});

Flashcard.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Flashcard, { foreignKey: 'ownerId', as: 'flashcards' });

module.exports = Flashcard;