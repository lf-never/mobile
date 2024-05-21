const log = require('../log/winston').logger('updateDrvierAndVehicleStatus Child Process');
const moment = require('moment');

const { Sequelize, Op, QueryTypes, fn } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');

const { Driver } = require('../model/driver');
const { Vehicle } = require('../model/vehicle.js');

process.on('message', async processParams => {
    try {
        // update current day data
        let currentDayStr = moment().format("YYYY-MM-DD");

        let currentTaskList = await sequelizeObj.query(`
            SELECT tt.taskId, tt.driverId, tt.vehicleNumber FROM task tt
            WHERE tt.driverStatus != 'Cancelled'
            and (('${currentDayStr}' BETWEEN DATE_FORMAT(tt.indentStartTime, '%Y-%m-%d') and DATE_FORMAT(tt.indentEndTime, '%Y-%m-%d'))
            or tt.driverStatus = 'started')
        `, { type: QueryTypes.SELECT , replacements: []})

        let currentDriverIdArray = [];
        let currentVehicleNumArray = [];

        if (currentTaskList) {
            for (let task of currentTaskList) {
                if (task.driverId  && !currentDriverIdArray.find(item => item == task.driverId)) {
                    currentDriverIdArray.push(task.driverId);
                }
                if (task.vehicleNumber && !currentVehicleNumArray.find(item => item == task.vehicleNumber)) {
                    currentVehicleNumArray.push(task.vehicleNumber);
                }
            }
        }
        //update driver status 
        await sequelizeObj.query(`
            UPDATE driver
                SET overrideStatus = '', overrideStatusTime = NULL, status = 'Deployable'
            WHERE overrideStatusTime IS NOT NULL AND DATE_FORMAT(overrideStatusTime, '%Y-%m-%d') != '${currentDayStr}'
        `, { type: QueryTypes.UPDATE, replacements: [] })
        if (currentDriverIdArray.length > 0) {
            await Driver.update({ status: 'Deployed'}, {where: {driverId: {[Op.in]: currentDriverIdArray}}});
        }

        //update vehicle status 
        await sequelizeObj.query(`
            UPDATE vehicle
                SET overrideStatus = '', overrideStatusTime = NULL, status = 'Deployable'
            WHERE overrideStatusTime IS NOT NULL AND DATE_FORMAT(overrideStatusTime, '%Y-%m-%d') != '${currentDayStr}'
        `, { type: QueryTypes.UPDATE, replacements: [] })
        if (currentVehicleNumArray.length > 0) {
            await Vehicle.update({ status: 'Deployed'}, {where: {vehicleNo: {[Op.in]: currentVehicleNumArray}}});
        }
    } catch(error) {
        log.error('updateDrvierAndVehicleStatus fail: ', error);
    }

    process.send({ success: true })
})
