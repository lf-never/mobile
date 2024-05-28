const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.MedicSurvey = dbConf.sequelizeObj.define('medicSurvey', {
    id: {
        type: DataTypes.INTEGER, 
        autoIncrement: true,
        primaryKey: true,
    },
    taskId: {
        type: DataTypes.STRING(55),
        allowNull: false
    },
    mtRacId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    answer: {
        type: DataTypes.STRING(55),
        allowNull: false
    },
    photo: {
        type: DataTypes.BLOB('long'),
    },
    remark: {
        type: DataTypes.TEXT,
    },
}, {
    // other options
    tableName: 'medic_survey',
    timestamps: true,
});
