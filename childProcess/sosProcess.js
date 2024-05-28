const log = require('../log/winston').logger('SOS Child Process');
const moment = require('moment');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');

const { Driver } = require('../model/driver');
const { SOS } = require('../model/sos');

process.on('message', async processParams => {
    let result = await sequelizeObj.query(`
        SELECT SUBSTRING_INDEX(GROUP_CONCAT( id ORDER BY createdAt DESC), ',', 1) AS id, driverId FROM sos GROUP BY driverId;
    `, { type: QueryTypes.SELECT });
    for (let data of result) {
        let sosRecord = await SOS.findByPk(data.id);
        log.info(moment().diff(moment(sosRecord.createdAt)) >= 3 * 60 * 1000)
        if (moment().diff(moment(sosRecord.createdAt)) >= 3 * 60 * 1000 ) {
            log.info(`Update driver ${ sosRecord.driverId }`)
            await Driver.update({ state: null }, { where: { driverId: sosRecord.driverId, state: 'SOS' } })
        }
    }
    process.send({ success: true })
})
