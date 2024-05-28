const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.NogoZone = dbConf.sequelizeObj.define('nogoZone', {
    id: {
        type: DataTypes.INTEGER(11), 
        primaryKey: true,
        autoIncrement: true,
    },
    zoneName: {
        type: DataTypes.STRING(55),
        allowNull: false,
    },
    polygon: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    color: {
        type: DataTypes.STRING(55),
        allowNull: false,
    },
    owner: {
        type: DataTypes.INTEGER(11),
        allowNull: false,
    },
    deleted: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0
    },
    alertType: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0
    },
    enable: {
        type: DataTypes.TINYINT(1),
        defaultValue: 1
    },
    enableVoice: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0
    },
    selectedWeeks: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
}, {
    // other options
    tableName: 'nogo_zone',
    timestamps: true,
});