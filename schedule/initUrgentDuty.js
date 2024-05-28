const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Urgent Duty');

module.exports.urgentDutySchedule = function () {
    // Every one minutes will run this schedule
                                    //seconds minute hour date month week year(year can be empty)
    schedule.scheduleJob('Urgent Duty', `0 0 0 * * 1`, async () => {
        log.info(`(Urgent Duty ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/initUrgentDuty.js')
        childProcess.on('message', async msg => {
            log.info(`(Urgent Duty ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
            childProcess.disconnect();
        })
        childProcess.send({ })
    })
    // exe on restart.
    // const childProcess = fork('./childProcess/initUrgentDuty.js')
    // log.info(`(Urgent Duty ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
    // childProcess.on('message', async msg => {
    //     log.info(`(Urgent Duty ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finish working!`);
    //     childProcess.disconnect();
    // })
    // childProcess.send({ })
}

