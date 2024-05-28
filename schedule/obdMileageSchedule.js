const schedule = require('node-schedule');
const activeMQ = require('../activemq/activemq');
const log = require('../log/winston').logger('OBD Mileage Schedule Service');
const moment = require('moment');

const { sequelizeObj } = require('../db/dbConf')
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { Device } = require('../model/device');
const { DevicePositionHistory } = require('../model/event/devicePositionHistory');
const { Mileage } = require('../model/mileage');

const getPayload = async function (deviceId, devicePositionList) {
    const generateMQString = function (fromPoint, toPoint, waypointList) {
        let msg = {};
        msg.FromAddr = fromPoint.lat + ':' + fromPoint.lng;
        msg.ToAddr = toPoint.lat + ':' + toPoint.lng;
        waypointList.forEach((waypoint, index) => {
            msg['Waypoint' + (index + 1) + '_0'] = waypoint.lat + ':' + waypoint.lng
        })
        return msg
    }

    log.info(`DeviceId : ${deviceId}`)

    if (devicePositionList.length && devicePositionList.length > 3) {
        let payloadList = [];
        const MAX_SIZE_ACTIVEMQ_WAYPOINT = 60
        log.info(`Total length ${deviceId} : ` + devicePositionList.length)
        log.info(`MAX_SIZE_ACTIVEMQ_WAYPOINT ${deviceId} : ` + MAX_SIZE_ACTIVEMQ_WAYPOINT)
        for (let index = 0; index < Math.ceil(devicePositionList.length / MAX_SIZE_ACTIVEMQ_WAYPOINT); index++) {
            let sendList = devicePositionList.slice(index * MAX_SIZE_ACTIVEMQ_WAYPOINT, index * MAX_SIZE_ACTIVEMQ_WAYPOINT + MAX_SIZE_ACTIVEMQ_WAYPOINT);
            let fromPoint = sendList[0]
            let toPoint = sendList[sendList.length - 1]
            let waypointList = sendList.slice(1, sendList.length - 1)
            payloadList.push(generateMQString(fromPoint, toPoint, waypointList))
        }
        return payloadList
    } else {
        log.info(`DeviceId ${deviceId} has no position history!`)
        return []
    }
}

const CreateOrUpdateMileage = async function (devicePositionList, device) {
    // get mileage start and end time
    let startTime = devicePositionList[0].createdAt
    let endTime = devicePositionList[devicePositionList.length - 1].createdAt
    // 
    let deviceId = device.deviceId
    let vehicleNo = device.vehicleNo
    let driverId = device.driverId
    let currentDate = moment(new Date()).format("YYYY-MM-DD")

    var mileageObj = await Mileage.findOne({
        where: {
            [Op.and]: [
                { date: currentDate },
                { deviceId: deviceId },
            ]
        }
    })
    if (mileageObj == null) {
        let mileageTraveled = 0
        await Mileage.create({
            date: currentDate,
            startTime: startTime,
            endTime: endTime,
            deviceId: deviceId,
            vehicleNo: vehicleNo,
            driverId: driverId,
            mileageTraveled: mileageTraveled,
        })
    } else {
        mileageObj.endTime = endTime
        await mileageObj.save()
    }
}

const GetDeviceHistoryAndSendMQ = async function (startTime, endTime) {
    try {
        log.info(`TimeZone[${startTime} - ${endTime}]`)

        // let deviceList = await Device.findAll({
        //     attributes: ["deviceId", "vehicleNo", "driver"]
        // });
        let deviceList = await sequelizeObj.query(`
            SELECT d.deviceId, vr.driverId, vr.vehicleNo FROM device d
            LEFT JOIN vehicle_relation vr ON vr.deviceId = d.deviceId
        `, { type: QueryTypes.SELECT })

        for (let device of deviceList) {
            let deviceId = device.deviceId

            let devicePositionList = await DevicePositionHistory.findAll({
                where: {
                    deviceId,
                    createdAt: {
                        [Op.gte]: startTime,
                        [Op.lte]: endTime,
                    },
                },
               
                attributes: ['lat', 'lng', 'createdAt'],
            })

            let payloadList = await getPayload(deviceId, devicePositionList);
            if (!payloadList.length) {
                log.info(`Payload is null!`)
                continue;
            } else {
                log.info(`Payload length(${deviceId}) : ${payloadList.length}`)
            }
            
            // log.info(device)
            await CreateOrUpdateMileage(devicePositionList, device)

            setTimeout(() => {
                for (let payload of payloadList) {
                    log.info(`Payload : ${JSON.stringify(payload)}!`)
                    activeMQ.publicAskForDistance(deviceId, Buffer.from(JSON.stringify(payload)));
                }
            }, 100)
        }
    } catch (error) {
        log.error(error);
    }
}

const StartServerCalculateDistance = async function(){
    let startTime = null
    // first start server, get last updatetime to current time datas calculate obd distance
    let mileage = await Mileage.findOne({
        attributes: ['updatedAt'],
        where: {
            deviceId: { [Op.not]: null }
        },
        order: [
            ['updatedAt', 'DESC']
        ]
    })

    if(mileage == null){
        let devicePositionHistory = await DevicePositionHistory.findOne({
            attributes: ['createdAt'],
            order: [
                ['createdAt', 'ASC']
            ]
        })
        if(devicePositionHistory != null){
            startTime = devicePositionHistory.createdAt
        }
    }else{
        startTime = mileage.updatedAt
    }


    if(startTime != null){
        GetDeviceHistoryAndSendMQ(startTime, moment(new Date()).format("YYYY-MM-DD HH:mm:ss"))
    }
}

module.exports.CheckOBDDistance = () => {
    // schedule 
    schedule.scheduleJob('*/5 * * * *', async () => {
        let endTime = moment(new Date()).format("YYYY-MM-DD HH:mm:ss")
        let startTime = moment(endTime).subtract(5, "minute").format("YYYY-MM-DD HH:mm:ss")
        GetDeviceHistoryAndSendMQ(startTime, endTime)
    })
    StartServerCalculateDistance()
}

module.exports.analyseData = function (deviceId, data) {
    try {
        sequelizeObj.transaction(async transaction => {
            let tempData = data.split(';')[0]
            tempData = tempData.split('-');
            let device = await Device.findByPk(deviceId)
            if (device == null) {
                log.warn(`DeviceId ${deviceId} do not exist in Device Table!`)
                return;
            }
    
            // let driver = device.driver
            // let vehicleNo = device.vehicleNo
            let currentDate = moment(new Date()).format("YYYY-MM-DD")
            let distance = 0
            for (let d of tempData) {
                let objStr = d.split('=');
                // log.info(`${objStr[0]} = ${objStr[1]}`)
                if (objStr[0] === 'd1') {
                    distance += Number.parseFloat(objStr[1]);
                    break;
                }
            }
            // var mileageObj = await Mileage.findOne({
            //     where: {
            //         [Op.and]: [
            //             { date: currentDate },
            //             { deviceId: deviceId },
            //         ]
            //     }
            // })
            // if (mileageObj != null) {
            //     mileageObj.mileageTraveled = Number.parseFloat(mileageObj.mileageTraveled) + distance
            //     await mileageObj.save()
            // }

            await Mileage.increment({ mileageTraveled: distance }, {
                where: {
                    [Op.and]: [
                        { date: currentDate },
                        { deviceId: deviceId },
                    ]
                }
            })
        })
    } catch (error) {
        log.error(error)
    }
}