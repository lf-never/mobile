require('./db/dbHelper');
const log = require('./log/winston').logger('APP');

// const sosSchedule = require('./schedule/sosSchedule.js');
// sosSchedule.calcSosSchedule();

// const ownerHotoAndLoanReturn = require('./schedule/ownerHotoAndLoanReturn.js');
// ownerHotoAndLoanReturn.hotoReturnSchedule();

// // const intiUrgentDuty = require('./schedule/initUrgentDuty.js');
// // intiUrgentDuty.urgentDutySchedule();

// const DriverORDExpiredSchedule = require('./schedule/DriverORDExpiredSchedule.js');
// DriverORDExpiredSchedule.driverORDExpiredSchedule();

// // const notificationSchedule = require('./schedule/notificationSchedule.js');
// // notificationSchedule.prepareSendNotification();

// const driverLicenseExchangeSchedule = require('./schedule/driverLicenseExchangeSchedule.js');
// driverLicenseExchangeSchedule.calcDriverLicenseExchange();

// const trafficSchedule = require('./schedule/trafficSchedule');
// trafficSchedule.updateTrafficSpeedBandsByChildProcess();

// const driverMonthAchievementSchedule = require('./schedule/driverMonthAchievementSchedule.js');
// driverMonthAchievementSchedule.calcDriverMonthAchievement();

// const VehicleWptSchedule = require('./schedule/VehicleWptSchedule.js');
// VehicleWptSchedule.calcVehicleWptInfoSchedule();

const resourceMonthWorkdaysStatSchedule = require('./schedule/resourceMonthWorkdaysStatSchedule.js');
resourceMonthWorkdaysStatSchedule.calcResourceMonthWorkdays();

// const { urgentNoGoZoneSchedule } = require('./schedule/noGoZoneSchedule.js');
// urgentNoGoZoneSchedule();

// 2022-10-25
// Remove, will calculate by mobile logout
// const mq = require('./activemq/activemq')
// mq.initActiveMQ()
// const obdMileageSchedule = require('./schedule/obdMileageSchedule');
// obdMileageSchedule.CheckOBDDistance();

process.on('uncaughtException', function (e) {
    log.error(`uncaughtException`)
    log.error(e.message)
});
process.on('unhandledRejection', function (err, promise) {
    log.error(`unhandledRejection`);
    log.error(err.message);
})