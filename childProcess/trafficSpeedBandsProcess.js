const log = require('../log/winston').logger('Child Process');
const moment = require('moment');
const conf = require('../conf/conf');

const axios = require('axios');
const header = {
    "AccountKey": "aPovYmDwT9KsW8+s1JFtbA==",
    "accept": "application/json",
}

const { SpeedBands } = require('../model/traffic/speedBands');
const { SpeedBandsTemp } = require('../model/traffic/speedBandsTemp');

const { sequelizeObj } = require('../db/dbConf');
const { Sequelize, Op, QueryTypes } = require('sequelize');

process.on('message', async processParams => {
    log.info(`Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `, processParams)
    try {
        let baseUrl = `http://datamall2.mytransport.sg/ltaodataservice/v3/TrafficSpeedBands`

        await sequelizeObj.transaction(async transaction => {
            // 1 clear temp table
            await SpeedBandsTemp.truncate();
            let flag = true, index = 0;
            while (flag) {
                try {
                    let option = {
                        headers: header, 
                        timeout: 10000
                    }
                    if (conf.openProxy) {
                        option.proxy = conf.proxy
                    } 
                    let result = await axios.get(`${ baseUrl }?$skip=${ index * 500 }`, option)
                
                    if (!result.data.value.length) {
                        // TODO: no result, close while
                        flag = false;
                        log.info(`axios (${ baseUrl }?$skip=${ index * 500 }) success , will finish update .........`)
                    } else {
                        // 2 insert table
                        await SpeedBandsTemp.bulkCreate(result.data.value);
                        // TODO: get next 500 data
                        log.info(`axios (${ baseUrl }?$skip=${ index * 500 }) success , will try next 500 .........`)
                        index++;
                        // TODO: Delay
                        await new Promise(resolve => setTimeout(() => resolve(), 1 * 1000));
                    }
                } catch (error) {
                    log.error(`axios (${ baseUrl }?$skip=${ index * 500 }) failed , will skip and try next 500 .........`)
                    index++;
                    log.error(error)
                }
            }
            // 3 clear table
            await SpeedBands.truncate();
            // 4 copy table
            await sequelizeObj.query(` INSERT INTO speed_bands SELECT * FROM speed_bands_temp; `, { type: QueryTypes.INSERT })
        }).catch(error => {
            throw error
        });

        process.send({ success: true })
    } catch (error) {
        log.error(error);
        process.send({ success: false, error })
    }
})
