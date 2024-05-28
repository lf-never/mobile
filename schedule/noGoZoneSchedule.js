const schedule = require('node-schedule');
const moment = require('moment');

const { NogoZone } = require('../model/nogoZone');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');

const log = require('../log/winston').logger('No Go Zone Schedule');

module.exports.urgentNoGoZoneSchedule = function () {
    schedule.scheduleJob('Update NoGoZone Status', `0 0 0 * * *`, async () => {
        log.info(`(Update NoGoZone Status ${ moment().format('YYYY-MM-DD HH:mm:ss') } ): start working!`);
        scheduleNoGoZone()
    })
}

const scheduleNoGoZone = async function () {
    try {
        let sql = `
            SELECT nz.*, u.unitId, u.userType, u.fullName as creator, un.unit as hub, un.subUnit as node,
            GROUP_CONCAT(CONCAT(DATE_FORMAT(nt.startTime, '%H:%i'), ' - ', DATE_FORMAT(nt.endTime, '%H:%i'))) AS selectedTimes 
            FROM nogo_zone nz
            LEFT JOIN nogo_time nt ON nt.zoneId = nz.id
            LEFT JOIN user u on nz.owner = u.userId
            LEFT JOIN unit un on un.id = u.unitId
            WHERE nz.deleted = 0 and nz.enable = 1 
            GROUP BY nz.id
        `
        let zoneList = await sequelizeObj.query(sql, { type: QueryTypes.SELECT })
        for (let zone of zoneList) {
            let currentDate = moment().format('YYYY-MM-DD')
            // check date
            if (!moment(currentDate, 'YYYY-MM-DD').isBetween(moment(zone.startDate, 'YYYY-MM-DD'), moment(zone.endDate, 'YYYY-MM-DD'), null, [])) {
                // not in
                await NogoZone.update({ enable: 0 }, { where: { id: zone.id } })
            }
        }

    } catch (error) {
        log.error(error)
    }
}
