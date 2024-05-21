
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const { Unit } = require('../model/unit');
const jsonfile = require('jsonfile')
const { UrgentConfig } = require('../model/urgent/urgentConfig');
const { OperationRecord } = require('../model/operationRecord');
const { UrgentDuty } = require('../model/urgent/urgentDuty');

const log = require('../log/winston').logger('Urgent Duty');

let TaskUtils = {
    getVehicle: async function (startDate, endDate, hub, node, vehicleType) {
        startDate = moment(startDate).format('YYYY-MM-DD HH:mm:ss')
        endDate = moment(endDate).format('YYYY-MM-DD HH:mm:ss')
        let indentStartDate = moment(startDate).format('YYYY-MM-DD')
        let indentEndDate = moment(endDate).format('YYYY-MM-DD')
        let vehicle_leave = await sequelizeObj.query(`
            SELECT vl.vehicleNo FROM vehicle_leave_record vl WHERE vl.status = 1 
            AND ( ('${ startDate }' >= vl.startTime AND '${ startDate }' <= vl.endTime) 
            OR ('${ endDate }' >= vl.startTime AND '${ endDate }' <= vl.endTime) 
            OR ('${ startDate }' < vl.startTime AND '${ endDate }' > vl.endTime))
            AND vl.vehicleNo IS NOT NULL GROUP BY vl.vehicleNo
        `, { type: QueryTypes.SELECT })
        vehicle_leave = vehicle_leave.map(item => item.vehicleNo);
        let vehicle_loan = await sequelizeObj.query(`
            SELECT vehicleNo FROM loan 
            WHERE (('${ startDate }' >= startDate AND '${ startDate }' <= endDate) 
            OR ('${ endDate }' >= startDate AND '${ endDate }' <= endDate) 
            OR ('${ startDate }' < startDate AND '${ endDate }' > endDate))
            AND vehicleNo IS NOT NULL GROUP BY vehicleNo
        `, { type: QueryTypes.SELECT })
        vehicle_loan = vehicle_loan.map(item => item.vehicleNo);
        let vehicle_hoto = await sequelizeObj.query(`
            SELECT vehicleNo FROM hoto 
            WHERE (('${ startDate }' >= startDateTime AND '${ startDate }' <= endDateTime) 
            OR ('${ endDate }' >= startDateTime AND '${ endDate }' <= endDateTime) 
            OR ('${ startDate }' < startDateTime AND '${ endDate }' > endDateTime))
            AND vehicleNo NOT IN (SELECT vehicleNo FROM hoto 
                    WHERE '${ startDate }' >= startDateTime AND '${ endDate }' <= endDateTime 
                    AND vehicleNo IS NOT NULL  AND STATUS = 'Approved'
            ) AND STATUS = 'Approved'
            AND vehicleNo IS NOT NULL GROUP BY vehicleNo
        `, { type: QueryTypes.SELECT })
        vehicle_hoto = vehicle_hoto.map(item => item.vehicleNo);
        let vehicle_config = await sequelizeObj.query(`
            SELECT vehicleNo FROM urgent_config 
            WHERE cancelledDateTime IS NULL AND vehicleNo IS NOT NULL
            AND (('${ indentStartDate }' >= indentStartDate AND '${ indentStartDate }' <= indentEndDate) 
            OR ('${ indentEndDate }' >= indentStartDate AND '${ indentEndDate }' <= indentEndDate) 
            OR ('${ indentStartDate }' < indentStartDate AND '${ indentEndDate }' > indentEndDate))
            GROUP BY vehicleNo
        `, { type: QueryTypes.SELECT })
        vehicle_config = vehicle_config.map(item => item.vehicleNo);
        let excludeVehicle = vehicle_leave.concat(vehicle_loan).concat(vehicle_hoto).concat(vehicle_config)    
        excludeVehicle = excludeVehicle.map(item => item);
        excludeVehicle = Array.from(new Set(excludeVehicle))  
        let sql = `
            SELECT vv.vehicleNo, vv.hub, vv.node FROM (
                SELECT a.vehicleNo, 
                IF(h.toHub IS NULL, u.unit, h.toHub) AS hub, 
                IF(h.toNode IS NULL, u.subUnit, h.toNode) AS node
                FROM vehicle a
                LEFT JOIN unit u ON u.id = a.unitId
                LEFT JOIN (SELECT ho.vehicleNo, ho.toHub, ho.toNode FROM hoto ho 
                    WHERE (('${ startDate }' >= ho.startDateTime AND '${ endDate }' <= ho.endDateTime)) AND ho.status = 'Approved'
                    ) h ON h.vehicleNo = a.vehicleNo 
                WHERE a.vehicleType = '${ vehicleType }' AND a.groupId IS NULL             
                AND (a.nextAviTime > '${ moment(endDate).format('YYYY-MM-DD') }' OR a.nextAviTime IS NULL)
                ) vv WHERE vv.hub = '${ hub }' 
                ${ node ? ` AND vv.node = '${ node }'` : `` }
                ${ excludeVehicle.length > 0 ? ` AND vv.vehicleNo NOT IN ('${ excludeVehicle.join("','") }')` : '' }
                GROUP BY vv.vehicleNo
        `
        let vehicleList = await sequelizeObj.query(sql, { type: QueryTypes.SELECT })
        return vehicleList[0] ? vehicleList[0].vehicleNo : null;
    },
    getDriver: async function (indentStartTime, indentEndTime, hub, node, vehicleType) {
        indentStartTime = moment(indentStartTime).format('YYYY-MM-DD HH:mm:ss')
        indentEndTime = moment(indentEndTime).format('YYYY-MM-DD HH:mm:ss')
        let indentStartDate = moment(indentStartTime).format('YYYY-MM-DD')
        let indentEndDate = moment(indentEndTime).format('YYYY-MM-DD')
        let driver_leave = await sequelizeObj.query(`
            SELECT dl.driverId FROM driver_leave_record dl WHERE dl.status = 1 AND dl.driverId IS NOT NULL
            AND ( ('${ indentStartTime }' >= dl.startTime AND '${ indentStartTime }' <= dl.endTime) 
            OR ('${ indentEndTime }' >= dl.startTime AND '${ indentEndTime }' <= dl.endTime) 
            OR ('${ indentStartTime }' < dl.startTime AND '${ indentEndTime }' > dl.endTime)
            ) GROUP BY dl.driverId
        `, { type: QueryTypes.SELECT })
        driver_leave = driver_leave.map(item => item.driverId);
        let driver_loan = await sequelizeObj.query(`
            SELECT driverId FROM loan 
            WHERE (('${ indentStartTime }' >= startDate AND '${ indentStartTime }' <= endDate) 
            OR ('${ indentEndTime }' >= startDate AND '${ indentEndTime }' <= endDate) 
            OR ('${ indentStartTime }' < startDate AND '${ indentEndTime }' > endDate))
            AND driverId IS NOT NULL GROUP BY driverId
        `, { type: QueryTypes.SELECT })
        driver_loan = driver_loan.map(item => item.driverId);
        let driver_hoto = await sequelizeObj.query(`
            SELECT driverId FROM hoto 
            WHERE (('${ indentStartTime }' >= startDateTime AND '${ indentStartTime }' <= endDateTime) 
            OR ('${ indentEndTime }' >= startDateTime AND '${ indentEndTime }' <= endDateTime) 
            OR ('${ indentStartTime }' < startDateTime AND '${ indentEndTime }' > endDateTime))
            AND driverId NOT IN (SELECT driverId FROM hoto 
                    WHERE '${ indentStartTime }' >= startDateTime AND '${ indentEndTime }' <= endDateTime
                    AND driverId IS NOT NULL AND STATUS = 'Approved'
            ) AND STATUS = 'Approved' AND driverId IS NOT NULL GROUP BY driverId
        `, { type: QueryTypes.SELECT })
        driver_hoto = driver_hoto.map(item => item.driverId);
        let driver_config = await sequelizeObj.query(`
            SELECT driverId FROM urgent_config 
            WHERE cancelledDateTime IS NULL AND driverId IS NOT NULL
            AND (('${ indentStartDate }' >= indentStartDate AND '${ indentStartDate }' <= indentEndDate) 
            OR ('${ indentEndDate }' >= indentStartDate AND '${ indentEndDate }' <= indentEndDate) 
            OR ('${ indentStartDate }' < indentStartDate AND '${ indentEndDate }' > indentEndDate))
            GROUP BY driverId
        `, { type: QueryTypes.SELECT })
        driver_config = driver_config.map(item => item.driverId);
        let excludeDriver = driver_leave.concat(driver_loan).concat(driver_hoto).concat(driver_config)    
        excludeDriver = excludeDriver.map(item => item);
        excludeDriver = Array.from(new Set(excludeDriver))  
        let sql = `
            SELECT dd.driverId, dd.hub, dd.node FROM (
                SELECT d.driverId,
                IF(h.toHub IS NULL, u.unit, h.toHub) AS hub,
                IF(h.toHub IS NULL, u.subUnit, h.toNode) AS node
                FROM driver d
                LEFT JOIN unit u ON u.id = d.unitId
                LEFT JOIN driver_platform_conf dc ON dc.driverId = d.driverId AND dc.approveStatus='Approved'
                LEFT JOIN (SELECT ho.driverId, ho.toHub, ho.toNode FROM hoto ho 
                WHERE (('${ indentStartTime }' >= ho.startDateTime AND '${ indentEndTime }' <= ho.endDateTime)) AND ho.status = 'Approved'
                ) h ON h.driverId = d.driverId 
                WHERE d.permitStatus != 'invalid'
                AND FIND_IN_SET('${ vehicleType }', dc.vehicleType)
                AND (d.operationallyReadyDate > '${ moment(indentEndTime).format('YYYY-MM-DD') }' OR d.operationallyReadyDate IS NULL)
                ) dd WHERE dd.hub = '${ hub }' 
                ${ node ? ` AND dd.node = '${ node }'` : `` }
                ${ excludeDriver.length > 0 ? ` AND dd.driverId NOT IN ('${ excludeDriver.join("','") }')` : '' }
                GROUP BY dd.driverId
        `
        let driverList = await sequelizeObj.query(sql, { type: QueryTypes.SELECT })
        return driverList[0] ? driverList[0].driverId : null;
    },
    getConfigByType: async function (vehicleType, unitId, indentEndDate){
        let urgentConfigList = await sequelizeObj.query(`
        select * from urgent_config 
        where createdAt like '${ moment().format('YYYY-MM-DD') } 00:%' 
        AND '${ moment(indentEndDate).format('YYYY-MM-DD') }' BETWEEN indentStartDate AND indentEndDate
        and vehicleType = '${ vehicleType }' and unitId = ${ unitId }
        `, { type: QueryTypes.SELECT })
        return urgentConfigList
    },
    getSingaporePublicHolidaysInFile: async function () {
        let thisYear = moment().format("YYYY")
        let hols = []
        try {
            let datas = await jsonfile.readFileSync(`./public_holiday/${thisYear}.json`)
            for (let data of datas) {
                let date = data["Date"]
                hols.push(moment(date).format("YYYY-MM-DD"))
                if (data["Observance Strategy"] == "next_monday") {
                    let next_monday = moment(date).add(1, 'd').format("YYYY-MM-DD")
                    hols.push(next_monday)
                }
            }
            return hols
        } catch (error) {
            log.error(error)
            return []
        }
    }
}

process.on('message', async processParams => {
    try {
        //Exclude Saturdays, Sundays and holidays
        let holidayList = await TaskUtils.getSingaporePublicHolidaysInFile();
        let date = moment().isoWeekday(5).format('YYYY-MM-DD')
        let dateList = []
        for (let index = 3; index < 8; index++) {
            let weekDate = moment(moment(date).format('YYYY-MM-DD')).add(index , 'days').format('YYYY-MM-DD');
            if(holidayList.indexOf(moment(weekDate).format('YYYY-MM-DD')) == -1) {
                dateList.push(weekDate)
            }
        }
        await sequelizeObj.transaction(async transaction => {
            let unitList = await Unit.findAll({ group: 'id' });
            // let vehicleTypeList = ['Ford Everest OUV', 'Agilis (Auto)', '5 Ton GS (Auto)', '6 Ton GS (Auto)']
            let vehicleTypeList = ['Ford Everest OUV', '5 Ton GS (Auto)']
            for(let item of unitList) {
                for(let type of vehicleTypeList){
                    for(let index of dateList){
                        let urgentDuty = {
                            "purpose": "Urgent Duty",
                            "hub": item.unit,
                            "node": item.subUnit ?? null,
                            "unitId": item.id,
                            "category": "MV",
                            "indentStartDate": `${ moment(index).format('YYYY-MM-DD') }`,
                            "indentEndDate": `${ moment(index).format('YYYY-MM-DD') }`,
                            "startTime": "09:30",
                            "endTime": "17:00",
                            "vehicleType": type,
                            "creator": 1,
                        }
                        // let vehicleNo = await TaskUtils.getVehicle(`${ urgentDuty.indentStartDate } ${ urgentDuty. startTime}`, `${ urgentDuty.indentEndDate } ${ urgentDuty.endTime }`, urgentDuty.hub, urgentDuty.node, urgentDuty.vehicleType)
                        // let driverId = await TaskUtils.getDriver(`${ urgentDuty.indentStartDate } ${ urgentDuty. startTime}`, `${ urgentDuty.indentEndDate } ${ urgentDuty.endTime }`, urgentDuty.hub, urgentDuty.node, urgentDuty.vehicleType)
                        // urgentDuty.vehicleNo = vehicleNo
                        // urgentDuty.driverId = driverId
                        // if(vehicleNo && driverId){
                            let configList = await TaskUtils.getConfigByType(urgentDuty.vehicleType, urgentDuty.unitId, urgentDuty.indentEndDate)
                            if(configList.length <= 0) {
                                let newUrgentConfig = await UrgentConfig.create(urgentDuty);
                                await OperationRecord.create({
                                    id: null,
                                    operatorId: 1,
                                    businessType: 'Urgent Duty',
                                    businessId: newUrgentConfig.id,
                                    optType: 'New',
                                    afterData: `${ JSON.stringify(newUrgentConfig) }`, 
                                    optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                                    remarks: 'Scheduling creates Urgent Config.'
                                })
                                let startDate = `${ urgentDuty.indentStartDate } ${ urgentDuty.startTime }`
                                startDate = moment(startDate).format('YYYY-MM-DD HH:mm')
                                let endDate = `${ urgentDuty.indentEndDate } ${ urgentDuty.endTime }`
                                endDate = moment(endDate).format('YYYY-MM-DD HH:mm')
                                const newurgentDuty = await UrgentDuty.create({ configId: newUrgentConfig.id, driverId: newUrgentConfig.driverId, 
                                    vehicleNo: newUrgentConfig.vehicleNo, indentStartDate: startDate, indentEndDate: endDate, status: 'waitcheck' });
                                await UrgentDuty.update({ dutyId: 'DUTY-'+newurgentDuty.id }, { where: { id: newurgentDuty.id } });
                                await OperationRecord.create({
                                    id: null,
                                    operatorId: 1,
                                    businessType: 'Urgent Duty',
                                    businessId: newUrgentConfig.id,
                                    optType: 'New',
                                    afterData: `${ JSON.stringify(newurgentDuty) }`, 
                                    optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                                    remarks: 'Scheduling creates Urgent Duty.'
                                })
                            }
                        // } else {
                        //     log.warn(` Creation failed, there is no ${ driverId ? 'vehicle' : 'driver' } for this (${ urgentDuty.vehicleType }) type under ${ urgentDuty.hub }/${ urgentDuty.node ?? '-' }.`)
                        // }
                    }
                }
            }
        }).catch(error => {
            throw error
        })
        process.send({ success: true })
    } catch (error) {
        log.error(error);
        process.send({ success: false, error })
    }
})