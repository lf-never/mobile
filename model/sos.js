const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');
const utils = require('../util/utils');

module.exports.SOS = dbConf.sequelizeObj.define('sos', {
    id: {
        type: DataTypes.INTEGER(11),
        primaryKey: true,
        autoIncrement: true,
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Incident',
        comment: 'Incident, Breakdown, Hazard/Near Miss Report, Road Closure'
    },
    driverId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    taskId: {
        type: DataTypes.STRING,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
    },
    followUpAction: {
        type: DataTypes.TEXT,
    },
    remarks: {
        type: DataTypes.TEXT,
        comment: 'If type is Incident, no need remarks.'
    },
	createdAt: {
        type: DataTypes.DATE,
    },
    updatedAt: {
        type: DataTypes.DATE,
    }
}, {
    // other options
    tableName: 'sos',
    timestamps: false,
});
