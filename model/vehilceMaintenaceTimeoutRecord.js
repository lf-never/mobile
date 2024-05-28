const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.VehilceMaintenaceTimeoutRecord = dbConf.sequelizeObj.define('vehilce_maintenace_timeout_record', {
    id: {
        type: DataTypes.BIGINT, 
        primaryKey: true,
        autoIncrement: true,
    },
    vehicleNo: {
        type: DataTypes.STRING(55),
    },
    type: {
        type: DataTypes.STRING(6),
    },
    recordTime: {
        type: DataTypes.DATE,
    },
    creator: {
        type: DataTypes.INTEGER(12),
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW(),
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW(),
    }
  }, {
    // other options
    timestamps: true
});