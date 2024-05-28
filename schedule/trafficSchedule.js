const log = require('../log/winston').logger('Traffic Service');

const schedule = require('node-schedule');
const { fork } = require('child_process')
const moment = require('moment');


module.exports = {
    updateTrafficSpeedBandsByChildProcess: async function () {
        try {
            log.info(`(update Traffic Speed Bands ${ moment().format('YYYY-MM-DD HH:mm:ss') }): start update!`);
            forkHandler()
            // TODO: every 15 min 
            schedule.scheduleJob('*/15 * * * *', () => {
                log.info(`(update Traffic Speed Bands ${ moment().format('YYYY-MM-DD HH:mm:ss') }): start update!`);
                forkHandler();
            })            
        } catch (error) {
            log.error(error)
        }
    },
}

const forkHandler = function () {
    const trafficSpeedBandsProcessForked = fork('./childProcess/trafficSpeedBandsProcess')
    trafficSpeedBandsProcessForked.on('message', async msg => {
        if (msg.success) {
            log.info(`(update Traffic Speed Bands ${ moment().format('YYYY-MM-DD HH:mm:ss') }): success!`);
        } else {
            log.info(`(update Traffic Speed Bands ${ moment().format('YYYY-MM-DD HH:mm:ss') }): failed!`);
        }
        log.info(`(update Traffic Speed Bands ${ moment().format('YYYY-MM-DD HH:mm:ss') }): finish update!`);
        trafficSpeedBandsProcessForked.disconnect();
    })
    trafficSpeedBandsProcessForked.send({})
}