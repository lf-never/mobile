const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Schedule driverMonthAchievementSchedule');

module.exports.calcDriverMonthAchievement = function () {
    // every month 1 day 0 hour exe this schedule.
    schedule.scheduleJob('calcDriverMonthAchievement', `0 0 0 1 * *`, async () => {
        log.info(`(calcDriverMonthAchievement ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/driverMonthAchievementProcess.js')
        childProcess.on('message', async msg => {
            childProcess.disconnect();
        })
        childProcess.send({})
    })

    //exe on restart.
    // const childProcess = fork('./childProcess/driverMonthAchievementProcess.js')
    // childProcess.on('message', async msg => {
    //     childProcess.disconnect();
    // })
    // childProcess.send({})
}
