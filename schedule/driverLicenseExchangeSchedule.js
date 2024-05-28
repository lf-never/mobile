const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Schedule driverLicenseExchangeSchedule');

module.exports.calcDriverLicenseExchange = function () {
    // every month 1 day 0 hour exe this schedule.
    schedule.scheduleJob('calcDriverLicenseExchange', `0 0 0 1 * *`, async () => {
        log.info(`(calcDriverLicenseExchange ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/calcDriverLicenseExchangeProcess.js')
        childProcess.on('message', async msg => {
            childProcess.disconnect();
        })
        childProcess.send({})
    })

    //exe on restart.
    // const childProcess = fork('./childProcess/calcDriverLicenseExchangeProcess.js')
    // childProcess.on('message', async msg => {
    //     childProcess.disconnect();
    // })
    // childProcess.send({})
}
