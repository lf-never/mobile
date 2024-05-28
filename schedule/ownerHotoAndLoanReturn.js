const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Hoto Return');

module.exports.hotoReturnSchedule = function () {
    // Every one minutes will run this schedule
    schedule.scheduleJob('Hoto Return', `*/10 * * * *`, async () => {
        log.info(`(Hoto Return ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/ownerHotoAndLoanReturn.js')
        childProcess.on('message', async msg => {
            log.info(`(Hoto Return ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
            childProcess.disconnect();
        })
        childProcess.send({ })
    })
    //exe on restart.
    const childProcess = fork('./childProcess/ownerHotoAndLoanReturn.js')
    log.info(`(Hoto Return ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
    childProcess.on('message', async msg => {
        log.info(`(Hoto Return ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
        childProcess.disconnect();
    })
    childProcess.send({ })
}

