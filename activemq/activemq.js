const conf = require('../conf/conf.js');

const Stomp = require('stomp-client');
const client = new Stomp(...conf.activeMQConf);

const log = require('../log/winston').logger('ActiveMQ Server');

const { Device } = require('../model/device');
const obdMileageSchedule = require('../schedule/obdMileageSchedule');

module.exports.initActiveMQ = function () {
    client.connect(function () {
        log.info('Active MQ Server Connected!');

        client.subscribe(`/topic/SendRoute`, function (body, headers) {
            log.info('From Active MQ Server(topic):', `/topic/SendRoute`);
            log.info('From Active MQ Server(body):', body.substr(0, 100), '...');
            // log.info('From Active MQ Server(headers):', headers);

            obdMileageSchedule.analyseData('DDD', body)
        })
    });
}

module.exports.publicAskForDistance = function (deviceId = 'DDD', body) {
    try {
        client.publish(`/topic/AskRoute`, body);
        log.info("Active MQ Send Topic : ", `/topic/AskRoute`);
        log.info("Active MQ Send Body : ", body);
    } catch (e) {
        log.error(e);
    }
}