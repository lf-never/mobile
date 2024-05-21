const log = require('../log/winston').logger('driverORDExpired Child Process');
const moment = require('moment');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const conf = require('../conf/conf.js');

const { Driver } = require('../model/driver.js');
const { Unit } = require('../model/unit.js');

process.on('message', async processParams => {

    let driverORDExpiredHub = conf.DriverORDExpiredHub;
    if (!driverORDExpiredHub) {
        log.info(`(driverORDExpiredProcess ${moment().format('YYYY-MM-DD HH:mm:ss')} ): not exist hub conf!`);
    }

    let hubUnit = await Unit.findOne({where: {unit: driverORDExpiredHub, subUnit: { [Op.eq]: null} }});
    if (!hubUnit) {
        log.info(`(driverORDExpiredProcess ${moment().format('YYYY-MM-DD HH:mm:ss')} ): hub conf[${driverORDExpiredHub}] not exist!`);
    } else {
        await sequelizeObj.query(`
            update driver set ordExpiredUnit = ${hubUnit.id} where DATE_FORMAT(operationallyReadyDate, '%Y-%m-%d') < '${moment().format('YYYY-MM-DD')}'
        `, { type: QueryTypes.UPDATE, replacements: [] })

        await sequelizeObj.query(`
            update driver set ordExpiredUnit = null where operationallyReadyDate is null or DATE_FORMAT(operationallyReadyDate, '%Y-%m-%d') >= '${moment().format('YYYY-MM-DD')}'
        `, { type: QueryTypes.UPDATE, replacements: [] })
    }

    process.send({ success: true })
})
