const schedule = require('node-schedule');
const moment = require('moment');

const log = require('../log/winston').logger('Mobius Service');
const conf = require('../conf/conf');

const notificationService = require('../services/notificationService');

module.exports.prepareSendNotification = function () {
	// every 5 min
    notificationService.prepareSendNotification()
	schedule.scheduleJob('*/5 * * * *', () => {
        log.info(`(prepareSendNotification ${ moment().format('YYYY-MM-DD HH:mm:ss') }): start prepare send notification!`);
        notificationService.prepareSendNotification()
    })
}

