const conf = require('../conf/conf');
const axios = require('axios');

const { sequelizeObj } = require('../db/dbConf')
const { QueryTypes, Op } = require('sequelize');
const { Driver } = require('../model/driver');
const { Notification } = require('../model/notification');

const log = require('../log/winston').logger('Notification Service');

const sendNotification = async function (notificationList) {
    try {
        log.info(`Start Send Firebase Notification ...`)
        log.info(JSON.stringify({ notificationList }, null, 4))
        return await axios.post(`${ conf.firebaseServer }/publicFirebaseNotificationBySystem`, { notificationList })
            .then(result => {
                log.info(JSON.stringify(result.data))
                log.info(`Finish Send Firebase Notification ...`)

                if (result.data.resp_code == 1) {
                    log.info(`Send Firebase Notification success.`)
                    return true
                } else {
                    log.warn(`Send Firebase Notification failed.`)
                    return false
                }
            })
    } catch (error) {
        log.error(error)
    }
}

module.exports = {
    prepareSendNotification: async function () {
        try {
            let result = await sequelizeObj.query(`
                SELECT n.id, n.title, n.type, n.description, n.startDateTime, n.endDateTime, u.fullName AS creator, n.driverHubNodeList,
                n.coverImage, n.mainImage  
                FROM notification n
                LEFT JOIN USER u ON u.userId = n.creator
                WHERE n.deleted = 0 
                AND startDateTime <= NOW() AND n.sended = 0 
            `, { type: QueryTypes.SELECT })

            // let driverList = await Driver.findAll();
            let driverList = await sequelizeObj.query(`
                SELECT dd.driverId, dd.driverName, dd.unitId FROM (
                    SELECT d.driverId, d.driverName, IF(h.unitId IS NULL, d.unitId, h.unitId) AS unitId
                    FROM driver d
                    LEFT JOIN (
                        SELECT ho.driverId, ho.unitId FROM hoto ho WHERE ((NOW() >= ho.startDateTime AND NOW() <= ho.endDateTime))
                    ) h ON h.driverId = d.driverId
                ) dd
            `, { type: QueryTypes.SELECT })

            let notificationList = [];
            // Every Notification
            let notificationIdList = []
            for (let notification of result) {
                const initNotificationList = function (){
                    notificationIdList.push(notification.id)
                    if (notification.driverHubNodeList) {
                        let unitIdList = notification.driverHubNodeList.split(',')
                        // Every Hub/Node
                        for (let unit of unitIdList) {
                            // Find Driver in this Hub/Node
                            for (let driver of driverList) {
                                if (driver.unitId == unit) {
                                    notificationList.push({
                                        taskId: `N-${ notification.id }`,
                                        token: null,
                                        driverId: driver.driverId,
                                        vehicleNo: null,
                                        title: notification.title,
                                        content: notification.description,
                                        type: notification.type,
                                    })
                                }
                            }
                        }
                    } else {
                        log.warn(`Notification ID ${ notification.id } do not has driverHubNodeList.`)
                    }
                }
                initNotificationList()
            }

            await Notification.update({ sended: 1 }, { where: { id: notificationIdList } })

            const initSendNotification = function (){
                if (notificationList.length) {
                    // sendNotification(notificationList);
                    log.info(`Current Notification length => ${ notificationList.length }`)
                    let count = Math.ceil(notificationList.length / 100);
                    log.info(`Notification will be cut into parts => ${ count }`)
                    for (let index = 0; index < count; index++) {
                        log.info(` ******************************************* `)
                        log.info(`Will Send Firebase Notification part ${ index + 1 }`)
                        if (index == (count - 1)) {
                            // TODO: last part
                            sendNotification(notificationList.slice( 100 * index ));
                        } else {
                            sendNotification(notificationList.slice( 100 * index, 100 * index + 100 ));
                        }
                    }
                } else {
                    log.warn(`There are no notification need to send.`)
                }
            }
            initSendNotification()
        } catch (error) {
            log.error(error)
        }
    },
}