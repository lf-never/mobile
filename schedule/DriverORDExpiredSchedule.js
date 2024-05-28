const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('DriverORDExpired Schedule');

module.exports.driverORDExpiredSchedule = function () {
    // Every 30 minutes will run this schedule
    schedule.scheduleJob('DriverORDExpired Schedule', `*/30 * * * *`, async () => {
        log.info(`(DriverORDExpired Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/driverORDExpiredProcess.js')
        childProcess.on('message', async msg => {
            log.info(`(DriverORDExpired Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
            childProcess.disconnect();
        })
        childProcess.send({ })
    })
}

