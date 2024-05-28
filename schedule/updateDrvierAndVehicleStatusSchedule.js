const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('updateDrvierAndVehicleStatus Schedule');

module.exports.calcSchedule = function () {
    // Every day 23 will run this schedule
    schedule.scheduleJob('updateDrvierAndVehicleStatus Schedule', `* 1 * * *`, async () => {
        log.info(`(updateDrvierAndVehicleStatus Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/updateDrvierAndVehicleStatusProcess.js')
        childProcess.on('message', async msg => {
            log.info(`(updateDrvierAndVehicleStatus Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
            childProcess.disconnect();
        })
        childProcess.send({ })
    })
    //exe on restart.
    const childProcess = fork('./childProcess/updateDrvierAndVehicleStatusProcess.js')
    log.info(`(updateDrvierAndVehicleStatus Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
    childProcess.on('message', async msg => {
        log.info(`(updateDrvierAndVehicleStatus Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
        childProcess.disconnect();
    })
    childProcess.send({ })
}

