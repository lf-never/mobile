const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');
const { system } = require('systeminformation');

module.exports.CheckListQuestion = dbConf.sequelizeObj.define('check_list_question', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    checkListId: {
        type: DataTypes.INTEGER,
    },
    checkListName: {
        type: DataTypes.STRING(255),
    },
    version: {
        type: DataTypes.STRING(50),
    },
    questionId: {
        type: DataTypes.INTEGER,
    },
    text: {
        type: DataTypes.TEXT,
    },
    system: {
        type: DataTypes.STRING(50),
    },
    classification: {
        type: DataTypes.STRING(50),
    },
    typeOfCheck: {
        type: DataTypes.STRING(255),
    },
    systemRemarks: {
        type: DataTypes.TEXT,
    },
    checkListType: {
        type: DataTypes.STRING(255),
    },
}, {
    timestamps: true,
});
