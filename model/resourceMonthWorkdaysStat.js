const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.DriverMonthWorkdays = dbConf.sequelizeObj.define('driver_month_workdays_stat', {
    id: {
        type: DataTypes.INTEGER(11),
        primaryKey: true,
        autoIncrement: true,
    },
    driverId: {
        type: DataTypes.INTEGER(11),
    },
    driverUnitId: {
        type: DataTypes.INTEGER(11),
    }, 
    workUnitId: {
        type: DataTypes.INTEGER(11),
    },
    month: {
        type: DataTypes.STRING(8),
    },
    taskNum: {
        type: DataTypes.INTEGER(8),
    },
    planWorkDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    actualWorkDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    leaveDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    hotoOutDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW(),
    }
  }, {
    // other options
    timestamps: false
});

module.exports.VehicleMonthWorkdays = dbConf.sequelizeObj.define('vehicle_month_workdays_stat', {
    id: {
        type: DataTypes.INTEGER(11),
        primaryKey: true,
        autoIncrement: true,
    },
    vehicleNo: {
        type: DataTypes.STRING(55),
    },
    vehicleUnitId: {
        type: DataTypes.INTEGER(11),
    }, 
    workUnitId: {
        type: DataTypes.INTEGER(11),
    },
    month: {
        type: DataTypes.STRING(8),
    },
    taskNum: {
        type: DataTypes.INTEGER(8),
    },
    planWorkDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    actualWorkDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    eventDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    hotoOutDays: {
        type: DataTypes.FLOAT(4, 1),
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW(),
    }
  }, {
    // other options
    timestamps: false
});