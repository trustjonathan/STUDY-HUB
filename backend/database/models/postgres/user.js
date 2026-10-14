const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database'); // points to your DB instance

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'google_id',
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user',
  },
  classLevel: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'class_level',
  },
  subjects: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },
  onboardingComplete: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'onboarding_complete',
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;