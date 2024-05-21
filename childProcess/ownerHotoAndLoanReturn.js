
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')

const { HOTO } = require('../model/hoto');
const { HOTORecord } = require('../model/hotoRecord');
const { OperationRecord } = require('../model/operationRecord');
const { LOANRecord } = require('../model/loanRecord');
const { LOAN } = require('../model/loan');
const { sequelizeSystemObj } = require('../db/dbConf_system');

const log = require('../log/winston').logger('Hoto Return');

let TaskUtils = {
    verifyDriverOrVehicleByDate: async function (vehicleNo, driverId, startDate, endDate, groupId) {
        let sql = `SELECT taskId, vehicleNumber, driverId from task where 1=1 `
        let groupSql = ''
        if(vehicleNo) {
            sql += ` and vehicleStatus not in ('completed', 'cancelled') and vehicleNumber = '${ vehicleNo }'`
            groupSql = ` group by vehicleNumber`
        }
        if(driverId) {
            sql += ` and driverStatus not in ('completed', 'cancelled') and driverId = ${ driverId }`
            groupSql = ` group by driverId`
        }

        sql += ` 
        and ((('${ startDate }' >= indentStartTime AND '${ startDate }' <= indentEndTime) 
        OR ('${ endDate }' >= indentStartTime AND '${ endDate }' <= indentEndTime) 
        OR ('${ startDate }' < indentStartTime AND '${ endDate }' > indentEndTime))
        OR vehicleStatus = 'started'
        )
        `
        if(groupId > 0) {
            sql += ` and taskId like 'CU-%' and groupId = ${ groupId }`
        }
        sql += groupSql;
        let result = await sequelizeObj.query(sql, {  type: QueryTypes.SELECT })
        return result;
    },
    verifyUrgentDriverOrVehicleByDate: async function (vehicleNo, driverId, startDate, endDate) {
        let sql = `select * from urgent_duty where status not in ('completed', 'cancelled') `
        let groupSql = ''
        if(vehicleNo) {
            sql += ` and vehicleNo = '${ vehicleNo }'`
            groupSql = ` group by vehicleNo`
        }
        if(driverId) {
            sql += ` and driverId = ${ driverId }`
            groupSql = ` group by driverId`
        }

        sql += ` 
            and ((('${ startDate }' >= indentStartDate AND '${ startDate }' <= indentEndDate) 
            OR ('${ endDate }' >= indentStartDate AND '${ endDate }' <= indentEndDate) 
            OR ('${ startDate }' < indentStartDate AND '${ endDate }' > indentEndDate))
            OR status = 'started'
            )
        `
        sql += groupSql;
        let result = await sequelizeObj.query(sql, {  type: QueryTypes.SELECT })
        return result;
    },
    getLoanOutDriverOrVehicle: async function (vehicleNo, driverId, startDate, endDate) {
        startDate = moment(startDate).format('YYYY-MM-DD HH:mm:ss')
        endDate = moment(endDate).format('YYYY-MM-DD HH:mm:ss')
        let loanOutDriverOrVehicle = await sequelizeObj.query(
            `SELECT vehicleNo, driverId, startDate, endDate
            FROM loan 
            WHERE (('${ startDate }' >= startDate AND '${ startDate }' <= endDate) 
            OR ('${ endDate }' >= startDate AND '${ endDate }' <= endDate) 
            OR ('${ startDate }' < startDate AND '${ endDate }' > endDate)
            OR '${ startDate }' >= startDate)
            ${ vehicleNo ? ` 
            and vehicleNo = '${ vehicleNo }'
            group by vehicleNo` : '' }
            ${ driverId ? ` 
            and driverId = ${ driverId }
            group by driverId` : '' }
            `,
        {
            type: QueryTypes.SELECT
        })
        return loanOutDriverOrVehicle[0]
    },
    ownerReturn: async function (data) {
        await sequelizeObj.transaction(async transaction => {
            let logDataList = [];
            let requestIdList = data.map(item => item.requestId)
            requestIdList = Array.from(new Set(requestIdList))
            for(let item of data){
                let state = await TaskUtils.verifyDriverOrVehicleByDate(item.vehicleNo ? item.vehicleNo : null, item.driverId ? item.driverId : null, moment(item.hostStartDate).format('YYYY-MM-DD HH:mm:ss'), moment(item.hostEndDate).format('YYYY-MM-DD HH:mm:ss'))
                let state3 = await TaskUtils.verifyUrgentDriverOrVehicleByDate(item.vehicleNo ? item.vehicleNo : null, item.driverId ? item.driverId : null, moment(item.hostStartDate).format('YYYY-MM-DD HH:mm:ss'), moment(item.hostEndDate).format('YYYY-MM-DD HH:mm:ss'))
                let state2 = await TaskUtils.getLoanOutDriverOrVehicle(item.vehicleNo ? item.vehicleNo : null, item.driverId ? item.driverId : null, moment(item.hostStartDate).format('YYYY-MM-DD HH:mm:ss'), moment(item.hostEndDate).format('YYYY-MM-DD HH:mm:ss'))
                if(state.length > 0 || state2 || state3.length > 0){
                    if(state.length > 0 || state3.length > 0) if(item.vehicleNo || item.driverId) log.warn(` The ${ item.vehicleNo ? `vehicle(vehicleNo:${ item.vehicleNo })` : `driver(driverID:${ item.driverId })` } has unfinished business.`)
                    if(state2) if(item.vehicleNo || item.driverId) log.warn(` The ${ item.vehicleNo ? `vehicle(vehicleNo:${ item.vehicleNo })` : `driver(driverID:${ item.driverId })` } has been loaned out.`)
                } else {
                    let hotoItem = await HOTO.findOne({ where: { id: item.id } });
                    await HOTO.destroy({ where: { id: item.id } });
                    let obj = {
                        vehicleNo: hotoItem.vehicleNo, 
                        driverId: hotoItem.driverId,
                        fromHub: hotoItem.fromHub,
                        fromNode: hotoItem.fromNode,
                        toHub: hotoItem.toHub,
                        toNode: hotoItem.toNode,
                        returnDateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                        startDateTime:  moment(hotoItem.startDateTime).format("YYYY-MM-DD HH:mm"),
                        endDateTime: moment(hotoItem.endDateTime).format("YYYY-MM-DD HH:mm"),
                        creator: hotoItem.creator,
                        status: hotoItem.status,
                        requestId: hotoItem.requestId,
                        createdAt: hotoItem.createdAt
                    }
                    await HOTORecord.create(obj)
                    let remarksName = null;
                    if(item.driverId){
                        remarksName = 'Automatically return expired drivers.'
                    } else {
                        if(item.vehicleNo) remarksName = 'Automatic return of expired vehicles.'
                    }
                    logDataList.push({
                        requestId: item.requestId, 
                        dataList: item.driverId ? item.driverId : item.vehicleNo,
                        remarksName: remarksName
                    })                        
                }
            }
            for(let item of requestIdList){
                if(item && item != 'null'){
                    let dataList = []
                    let remarksName = null;
                    for(let item2 of logDataList){
                        if(item == item2.requestId) {
                            dataList.push(item2.dataList)
                            remarksName = item2.remarksName
                        }
                    }
                    if(dataList.length > 0) {
                        let obj = {
                            id: null,
                            operatorId: null,
                            businessType: 'hoto',
                            businessId: item,
                            optType: 'return',
                            afterData: dataList.join(','),
                            optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                            remarks: remarksName
                        }
                        await OperationRecord.create(obj)
                    }
                }
            }
           
        })
    }
}

process.on('message', async processParams => {
    try {
        //loan
        let loanList = await sequelizeObj.query(`
        SELECT id FROM loan 
        WHERE (driverId IS NOT NULL OR vehicleNo IS NOT NULL) 
        AND NOW() > endDate GROUP BY id
        ` ,{ type: QueryTypes.SELECT });
        for(let item of loanList){
            let loanOut = await LOAN.findOne({ where: { id: item.id } })
            let state = await TaskUtils.verifyDriverOrVehicleByDate(loanOut.vehicleNo ? loanOut.vehicleNo : null, loanOut.driverId ? loanOut.driverId : null, moment(loanOut.startDate).format('YYYY-MM-DD HH:mm:ss'), moment(loanOut.endDate).format('YYYY-MM-DD HH:mm:ss'), loanOut.groupId)
            if(state.length > 0){
                if(state.length > 0) if(loanOut.vehicleNo || loanOut.driverId) log.warn(` loan => The ${ loanOut.vehicleNo ? `vehicle(vehicleNo:${ loanOut.vehicleNo })` : `driver(driverID:${ loanOut.driverId })` } has unfinished business.`)
            } else {
                await sequelizeObj.transaction(async transaction => {
                    let newLoanRecord = {
                        driverId: loanOut.driverId,
                        vehicleNo: loanOut.vehicleNo,
                        indentId: loanOut.indentId, 
                        taskId: loanOut.taskId,
                        startDate: loanOut.startDate,
                        endDate: loanOut.endDate, 
                        groupId: loanOut.groupId,
                        returnDate: moment().format('YYYY-MM-DD HH:mm:ss'),
                        returnBy: 0, // 2023-12-12 Used to distinguish whether it is a system operation or a user operation
                        creator: loanOut.creator,
                        returnRemark: null,
                        actualStartTime: loanOut.actualStartTime,
                        actualEndTime: loanOut.actualEndTime,
                        unitId: loanOut.unitId,
                        activity: loanOut.activity,
                        purpose: loanOut.purpose,
                        createdAt: loanOut.createdAt
                    };
                    await LOANRecord.create(newLoanRecord);
                    await LOAN.destroy({ where: { id: item.id } });
                    await OperationRecord.create({
                        id: null,
                        operatorId: 1,
                        businessType: 'loan',
                        businessId: loanOut.taskId,
                        optType: 'return loan',
                        beforeData: `${ loanOut.driverId && loanOut.driverId != '' ? `driverId:${ loanOut.driverId },` : '' }${ loanOut.vehicleNo && loanOut.vehicleNo != '' ? `vehicleNo:${ loanOut.vehicleNo }` : '' }`,
                        afterData: `${ loanOut.driverId && loanOut.driverId != '' ? `driverId:${ loanOut.driverId },` : '' }${ loanOut.vehicleNo && loanOut.vehicleNo != '' ? `vehicleNo:${ loanOut.vehicleNo }` : '' }`,
                        optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                        remarks: `Automatically return loan ${ loanOut.driverId ? 'driver' : '' }${ loanOut.vehicleNo ? 'vehicle' : '' }` 
                    })
                }).catch(error => {
                    throw error
                })
                await sequelizeSystemObj.transaction(async transaction => {
                    if(loanOut.groupId > 0){
                        let __SysTaskId = loanOut.taskId
                        if(__SysTaskId.includes('AT-')) __SysTaskId = __SysTaskId.slice(3)
                        log.warn(`loan system old taskId ==> ${ loanOut.taskId }`)
                        log.warn(`loan system new taskId ==> ${ __SysTaskId }`)
                        await sequelizeSystemObj.query(`
                            update job_task set taskStatus = 'Completed' where id = ${ __SysTaskId }
                        `, { type: QueryTypes.UPDATE, replacements: [] })
                        let sysTask = await sequelizeSystemObj.query(`
                            SELECT tripId FROM job_task
                            WHERE id = ${ __SysTaskId } 
                        `, { type: QueryTypes.SELECT })
                        if(sysTask[0]){
                            let tripStatus = await sequelizeSystemObj.query(`
                                SELECT jt.taskStatus FROM job_task jt
                                LEFT JOIN job j ON j.id = jt.tripId
                                WHERE j.id = ${ sysTask[0].tripId } 
                                GROUP BY jt.taskStatus
                            `, { type: QueryTypes.SELECT })
                            let tripStatus2 = await sequelizeSystemObj.query(`
                                SELECT jt.taskStatus FROM job_task jt
                                LEFT JOIN job j ON j.id = jt.tripId
                                WHERE j.id = ${ sysTask[0].tripId } 
                                and jt.taskStatus = 'completed'
                                GROUP BY jt.taskStatus
                            `, { type: QueryTypes.SELECT })
                            let jobStatus = null;
                            if(tripStatus2.length == tripStatus.length) {
                                jobStatus = 'Completed'
                            }
                            if(jobStatus) {
                                await sequelizeSystemObj.query(`
                                    UPDATE job SET status = '${ jobStatus }' WHERE id = ${ sysTask[0].tripId }
                                `, { type: QueryTypes.UPDATE })
                            }
                        }
                    }
                })
            }
        } 

        //hoto
        let sql = `
            SELECT d.driverId, d.driverName, u.unit, u.subUnit, 
            h.toHub as hostHub, h.toNode as hostNode, h.id, h.requestId,
            h.startDateTime as hostStartDate, h.endDateTime as hostEndDate
            from hoto h
            LEFT JOIN driver d on d.driverId = h.driverId
            LEFT JOIN unit u on d.unitId = u.id
            where h.driverId is not null and h.driverId != '' and h.status = 'Approved'
            and now() > h.endDateTime
            group by h.id
        `                                      
        let pageResult = await sequelizeObj.query(sql ,{ type: QueryTypes.SELECT });
        await TaskUtils.ownerReturn(pageResult)

        let sql2 = `
            SELECT v.vehicleNo, u.unit, u.subUnit, h.id,
            h.toHub as hostHub, h.toNode as hostNode, h.requestId,
            h.startDateTime as hostStartDate, h.endDateTime as hostEndDate
            from hoto h
            LEFT JOIN vehicle v on v.vehicleNo = h.vehicleNo
            LEFT JOIN unit u on v.unitId = u.id
            where h.vehicleNo is not null and h.vehicleNo != '' and h.status = 'Approved'
            and now() > h.endDateTime
            group by h.id
        `    
        let pageResult2 = await sequelizeObj.query(sql2 ,{ type: QueryTypes.SELECT });
        await TaskUtils.ownerReturn(pageResult2)
        process.send({ success: true })
    } catch (error) {
        log.error(error);
        process.send({ success: false, error })
    }
})