const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('SOS Schedule');

module.exports.calcSosSchedule = function () {
    // Every one minutes will run this schedule
    schedule.scheduleJob('SOS Schedule', `*/1 * * * *`, async () => {
        log.info(`(SOS Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/sosProcess.js')
        childProcess.on('message', async msg => {
            log.info(`(SOS Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
            childProcess.disconnect();
        })
        childProcess.send({ })
    })
    //exe on restart.
    const childProcess = fork('./childProcess/sosProcess.js')
    log.info(`(SOS Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
    childProcess.on('message', async msg => {
        log.info(`(SOS Schedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
        childProcess.disconnect();
    })
    childProcess.send({ })
}

