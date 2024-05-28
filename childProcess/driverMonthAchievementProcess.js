const log = require('../log/winston').logger('driverMonthAchievementProcess Child Process');
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const conf = require('../conf/conf.js');

const { Driver } = require('../model/driver.js');
const { DriverMonthAchievement } = require('../model/driverMonthAchievement.js');

process.on('message', async processParams => {
    log.info(`driverMonthAchievementProcess Child Process, receive Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    await startCalc();
    log.info(`driverMonthAchievementProcess Child Process, completed Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    process.send({ success: true })
})

const startCalc = async function() {
    try {
        let perMonth = moment().add(-1, 'month').format('YYYY-MM');
        let effectiveDrivers = await sequelizeObj.query(`
            SELECT
                d.driverId,d.driverName,d.enlistmentDate
            FROM driver d;
        `, { replacements: [], type: QueryTypes.SELECT })

        //perMonth all completed task
        let perMonthAllCompletedTask = await sequelizeObj.query(`
            SELECT
                m.taskId, m.driverId, m.mileageTraveled, m.startTime, m.endTime,
                t.purpose, c.starVal, s.id as incidentId
            FROM mileage m
            LEFT JOIN task t on m.taskId = t.taskId
            LEFT JOIN comment c on m.taskId = c.taskId
            LEFT JOIN sos s ON s.taskId = m.taskId and s.type = 'Incident'
            WHERE DATE_FORMAT(endTime, '%Y-%m') = '${perMonth}' GROUP BY m.taskId
        `, { replacements: [], type: QueryTypes.SELECT })

        //perMonth all platforms
        let perMonthAllPlatforms = await sequelizeObj.query(`
            SELECT
                driverId, COUNT(*) AS platformNum
            FROM driver_platform_conf dp
            WHERE DATE_FORMAT(assessmentDate, '%Y-%m') = '${perMonth}'
            GROUP BY driverId
        `, { replacements: [], type: QueryTypes.SELECT })

        let driverMonthAchievementArray = [];
        for (let driver of effectiveDrivers) {
            let drvierTaskList = perMonthAllCompletedTask.filter(item => item.driverId == driver.driverId);
            let drvierPlatformNum = perMonthAllPlatforms.find(item => item.driverId == driver.driverId);

            let driverTaskNum = drvierTaskList ? drvierTaskList.length : 0;
            let driverTaskMileage = 0;
            let driverTaskHours = 0;
            let driverPlatformTrained = 0;
            const initDriverTaskMileageAndDriverTaskHours = function (){
                if (driverTaskNum > 0) {
                    for (let task of drvierTaskList) {
                        // WPT task doesn't count
                        if (task.purpose && task.purpose.toLowerCase() != 'wpt') {
                            driverTaskMileage += task.mileageTraveled ? task.mileageTraveled : 0;
                        }
    
                        // feedback rating above 4 and no sos incident
                        //if (task.starVal && task.starVal >= 4 && !task.incidentId) {
                        if (!task.incidentId) {
                            let taskMinutes = moment(task.endTime).diff(moment(task.startTime), 'minute');
                            driverTaskHours += taskMinutes / 60;
                        }
                    }
                }
            }
            initDriverTaskMileageAndDriverTaskHours()

            if (drvierPlatformNum) {
                driverPlatformTrained = drvierPlatformNum.platformNum
            }
            driverMonthAchievementArray.push({
                driverId : driver.driverId,
                month: perMonth,
                platformsTrained: driverPlatformTrained,
                totalMileage: driverTaskMileage,
                taskNum: driverTaskNum,
                taskPerfectHours: driverTaskHours
            });
            if (driverMonthAchievementArray.length > 10) {
                await DriverMonthAchievement.bulkCreate(driverMonthAchievementArray, { updateOnDuplicate: ['platformsTrained', 'totalMileage', 'taskNum', 'taskPerfectHours'] });
                driverMonthAchievementArray = [];
            }
        }

        if (driverMonthAchievementArray.length > 0) {
            await DriverMonthAchievement.bulkCreate(driverMonthAchievementArray, { updateOnDuplicate: ['platformsTrained', 'totalMileage', 'taskNum', 'taskPerfectHours'] });
        }

    } catch (error) {
        log.error(`(driverMonthAchievementProcess ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed,  ${error}`);
    }
}


