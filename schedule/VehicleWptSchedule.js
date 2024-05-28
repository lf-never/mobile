const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Mobius Server');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');

const { Vehicle } = require('../model/vehicle.js');

module.exports.calcVehicleWptInfoSchedule = function () {
    //every sunday 23:30:00 execute  0 30 23 * * 0
    schedule.scheduleJob('calcVehicleWptSchedule', `0 30 23 * * 0`, async () => {
        log.info(`(calcVehicleWptSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/calcVehicleWptChildProcess.js')
        childProcess.on('message', async msg => {
            childProcess.disconnect();
        })
        childProcess.send({})
    })
    //exe on restart.
    // const childProcess = fork('./childProcess/calcVehicleWptChildProcess.js')
    // childProcess.on('message', async msg => {
    //     childProcess.disconnect();
    // })
    // childProcess.send({nextWeek: 0})
}
