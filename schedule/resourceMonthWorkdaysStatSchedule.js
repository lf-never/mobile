const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');

const log = require('../log/winston').logger('Schedule driverMonthAchievementSchedule');

module.exports.calcResourceMonthWorkdays = function () {
    // every month 1 day 0 hour exe this schedule.
    schedule.scheduleJob('calcDriverMonthAchievement', `0 0 0 1 * *`, async () => {
        log.info(`(calcResourceMonthWorkdays ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working!`);
        const childProcess = fork('./childProcess/resourceMonthWorkdaysStatProcess.js')
        childProcess.on('message', async msg => {
            childProcess.disconnect();
        })
        let preMonthStr = moment().add(-1, 'months').format('YYYY-MM');
        childProcess.send([preMonthStr])
    })

    //exe on restart.
    const childProcess = fork('./childProcess/resourceMonthWorkdaysStatProcess.js')
    childProcess.on('message', async msg => {
        childProcess.disconnect();
    })
    //current year month
    let monthStrs = [];
    let startMonth = moment(moment().year()+'-01', 'YYYY-MM');
    let currentMonthStr = moment().format('YYYY-MM');
    while (startMonth.format('YYYY-MM') != currentMonthStr) {
        monthStrs.push(startMonth.format('YYYY-MM'));

        startMonth = startMonth.add(1, 'months');
    }

    childProcess.send(monthStrs);
}
