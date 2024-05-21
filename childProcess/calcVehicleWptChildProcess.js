const log = require('../log/winston').logger('calcVehicleWpt Child Process');
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const { sequelizeSystemObj } = require('../db/dbConf_system');

const { Vehicle } = require('../model/vehicle.js');
const { OperationRecord } = require('../model/operationRecord.js');
const { MtAdmin } = require('../model/mtAdmin');
const { MobileTrip } = require('../model/mobileTrip.js');
const { VehilceMaintenaceTimeoutRecord } = require('../model/vehilceMaintenaceTimeoutRecord.js');


process.on('message', async processParams => {
    log.info(`Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `, processParams)
    await startCalc1();
    process.send({ success: true })
});

const startCalc1 = async function () {
    try {
        let currentDateStr = moment().format("YYYY-MM-DD");
        let wptOrMptTimeoutVehicleNos = await sequelizeObj.query(`
            select vv.vehicleNo from vehicle vv
            where (vv.nextMptTime IS NOT NULL AND vv.nextMptTime <= '${currentDateStr}')
                OR (vv.nextWpt3Time IS NOT NULL AND vv.nextWpt3Time <= '${currentDateStr}')
                OR (vv.nextWpt2Time IS NOT NULL AND vv.nextWpt2Time <= '${currentDateStr}')
                OR (vv.nextWpt1Time IS NOT NULL AND vv.nextWpt1Time <= '${currentDateStr}')
        `, { type: QueryTypes.SELECT, replacements: [] });

        // all pending task
        let allPendingTasks = await sequelizeObj.query(`
            SELECT
                t.taskId, t.vehicleNumber, t.dataFrom, t.indentId
            FROM task t
            WHERE t.driverStatus = 'waitcheck' and t.vehicleNumber is not NULL AND t.indentEndTime > now()
        `, { type: QueryTypes.SELECT, replacements: [] });

        // all pending urgent duty 
        let allPendingDutys = await sequelizeObj.query(`
            SELECT
                ud.dutyId,
                ud.configId,
                ud.vehicleNo
            FROM urgent_duty ud
            WHERE ud.vehicleNo IS NOT NULL AND ud.status = 'waitcheck' and ud.indentEndDate > now()
        `, { type: QueryTypes.SELECT, replacements: [] });

        // wpt timeOut vehicle associated task's vehicleNo will be set NULL.
        if (wptOrMptTimeoutVehicleNos && wptOrMptTimeoutVehicleNos.length > 0) {
            log.info(`calcVehicleWptSchedule has ${wptOrMptTimeoutVehicleNos.length} vehicle wpt or mpt time out.`);

            await sequelizeObj.transaction(async transaction => {
                for (let timeOutVehicle of wptOrMptTimeoutVehicleNos) {
                    let timeOutVehicleNo = timeOutVehicle.vehicleNo;
                    let vehicleTasks = allPendingTasks.filter(item => item.vehicleNumber == timeOutVehicleNo);
                    let taskIds = [];
                    if (vehicleTasks && vehicleTasks.length > 0) {
                        for(let task of vehicleTasks) {
                            taskIds.push(task.taskId);
                        }
                    }
                    if (taskIds.length > 0) {
                        let taskOptLogs = [];
                        for (let task of vehicleTasks) {
                            taskOptLogs.push({
                                businessType: 'task',
                                businessId: task.taskId,
                                optType: 'clear vehicle',
                                beforeData: timeOutVehicleNo,
                                afterData: '',
                                optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                                remarks: `clear task vehicle when vehicle wpt/mpt time out.`,
                            });

                            let dataFrom = task.dataFrom;
                            if (dataFrom == 'SYSTEM') {
                            } else if (dataFrom == 'MT-ADMIN') {
                                await MtAdmin.update({ vehicleNumber: null }, { where: { id: task.indentId } });
                            } else if (dataFrom == 'MOBILE') {
                                await MobileTrip.update({ vehicleNumber: null }, { where: { id: task.indentId } });
                            }
                        }
                        await OperationRecord.bulkCreate(taskOptLogs);

                        let taskIdsStr = taskIds.join(',');
                        log.warn(`calcVehicleWptSchedule set task[${taskIdsStr}]'s vehicleNumber NULL, oldVehicleNumber:${timeOutVehicleNo}.`);
    
                        await sequelizeObj.query(`
                            UPDATE task set vehicleNumber = NULL, updatedAt=NOW() WHERE vehicleNumber='${timeOutVehicleNo}' and driverStatus = 'waitcheck' AND indentEndTime > now()
                        `, { type: QueryTypes.UPDATE, replacements: [] });
                    } else {
                        log.info(`calcVehicleWptSchedule vehicle[${timeOutVehicleNo}] no waitcheck tasks.`);
                    }

                    let vehicleDutys = allPendingDutys.filter(item => item.vehicleNo == timeOutVehicleNo);
                    let dutyOptLogs = [];
                    let dutyIds = [];
                    let configIds = [];
                    if (vehicleDutys.length > 0) {
                        for (let duty of vehicleDutys) {
                            dutyOptLogs.push({
                                businessType: 'Urgent Duty',
                                businessId: duty.dutyId,
                                optType: 'clear vehicle',
                                beforeData: timeOutVehicleNo,
                                afterData: '',
                                optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                                remarks: `clear duty vehicle when vehicle wpt/mpt time out.`,
                            });
                            dutyIds.push(duty.dutyId);
                            if (configIds.indexOf(duty.configId) == -1) {
                                configIds.push(duty.configId);
                            }
                        }
                        await OperationRecord.bulkCreate(dutyOptLogs);

                        let dutyIdsStr = dutyIds.join(',');
                        log.warn(`calcVehicleWptSchedule set duty[${dutyIdsStr}]'s vehicleNumber NULL, oldVehicleNumber:${timeOutVehicleNo}.`);
    
                        await sequelizeObj.query(`
                            UPDATE urgent_duty set vehicleNo = NULL, updatedAt=NOW() WHERE vehicleNo='${timeOutVehicleNo}' and status = 'waitcheck' and indentEndDate > now()
                        `, { type: QueryTypes.UPDATE, replacements: [] });

                        await sequelizeObj.query(`
                            UPDATE urgent_config set vehicleNo = NULL, updatedAt=NOW() WHERE vehicleNo='${timeOutVehicleNo}' and id in(?)
                        `, { type: QueryTypes.UPDATE, replacements: [configIds] });
                    } else {
                        log.info(`calcVehicleWptSchedule vehicle[${timeOutVehicleNo}] no waitcheck dutys.`);
                    }
                }
            });
            await sequelizeSystemObj.transaction(async transaction => {
                for (let timeOutVehicle of wptOrMptTimeoutVehicleNos) {
                    let timeOutVehicleNo = timeOutVehicle.vehicleNo;
                    let vehicleTasks = allPendingTasks.filter(item => item.vehicleNumber == timeOutVehicleNo);
                    let taskIds = [];
                    if (vehicleTasks && vehicleTasks.length > 0) {
                        for(let task of vehicleTasks) {
                            taskIds.push(task.taskId);
                        }
                    }
                    if (taskIds.length > 0) {
                        for (let task of vehicleTasks) {
                            let dataFrom = task.dataFrom;
                            if (dataFrom == 'SYSTEM') {
                                // clear system db task vehicle
                                let systemTaskId = task.taskId;
                                if(systemTaskId.includes('AT-')) systemTaskId = task.taskId.slice(3)
                                await sequelizeSystemObj.query(`
                                    DELETE FROM vehicle where taskId='${systemTaskId}' and vehicleNumber = '${task.vehicleNumber}';
                                `, { type: QueryTypes.DELETE, replacements: [] });
                            }
                        }
                        
                    }
                }
            });
        } else {
            log.info(`calcVehicleWptSchedule no vehicle wpt or mpt time out.`);
        }

    } catch (error) {
        log.error(`(calcVehicleWptSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed,  ${error}`);
        log.error(error);
    }
}

const startCalc = async function() {
    try {
        log.info(`(calcVehicleWptSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): start working`);
        let vehicleList = await Vehicle.findAll({where: {onhold: 0}});
        if (vehicleList && vehicleList.length > 0) {
            let wptStartTimeStr = moment(moment().endOf('isoWeek').format('YYYY-MM-DD') + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'd').format('YYYY-MM-DD HH:mm:ss');
            let wptEndTimeStr = moment(moment().endOf('isoWeek').format('YYYY-MM-DD') + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss').add(7, 'd').format('YYYY-MM-DD HH:mm:ss');
            //wpt cycle task vehicleNos: vk001,vk002,vk003
            let wptCycleVehicleNos = await sequelizeObj.query(`
                SELECT distinct tt.vehicleNumber FROM task tt
                WHERE tt.driverId is not null and tt.driverStatus != 'Cancelled' and tt.driverStatus != 'completed' and tt.indentEndTime > NOW()
                AND ((
                    (indentStartTime >= '${wptStartTimeStr}' AND indentStartTime <= '${wptEndTimeStr}')
                    OR (indentEndTime >= '${wptStartTimeStr}' AND indentEndTime <= '${wptEndTimeStr}')
                    OR (indentStartTime < '${wptStartTimeStr}' AND indentEndTime > '${wptEndTimeStr}')
                )
                or tt.driverStatus = 'started') 
            `, { type: QueryTypes.SELECT, replacements: [] });
            let wptCycleVehicleNoArray = [];
            if (wptCycleVehicleNos && wptCycleVehicleNos.length > 0) {
                for (let temp of wptCycleVehicleNos) {
                    wptCycleVehicleNoArray.push(temp.vehicleNumber);
                }
            }
            log.info(`wpt cycle task vehicleNo: ${wptCycleVehicleNoArray.concat(',')}`)

            let mptStartTimeStr = moment(moment().endOf('isoWeek').format('YYYY-MM-DD') + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'd').format('YYYY-MM-DD HH:mm:ss');
            let mptEndTimeStr = moment(moment().endOf('isoWeek').format('YYYY-MM-DD') + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss').add(21, 'd').format('YYYY-MM-DD HH:mm:ss');
            //mpt cycle task vehicleNos: vk001,vk002,vk003
            let mptCycleVehicleNos = await sequelizeObj.query(`
                SELECT distinct tt.vehicleNumber FROM task tt
                WHERE tt.driverId is not null and tt.driverStatus != 'Cancelled' and tt.driverStatus != 'completed' and tt.indentEndTime > NOW()
                AND ((
                    (indentStartTime >= '${mptStartTimeStr}' AND indentStartTime <= '${mptEndTimeStr}')
                    OR (indentEndTime >= '${mptStartTimeStr}' AND indentEndTime <= '${mptEndTimeStr}')
                    OR (indentStartTime < '${mptStartTimeStr}' AND indentEndTime > '${mptEndTimeStr}')
                )
                or tt.driverStatus = 'started') 
            `, { type: QueryTypes.SELECT, replacements: [] });
            let mptCycleVehicleNoArray = [];
            if (mptCycleVehicleNos && mptCycleVehicleNos.length > 0) {
                for (let temp of mptCycleVehicleNos) {
                    mptCycleVehicleNoArray.push(temp.vehicleNumber);
                }
            }
            log.info(`mpt cycle task vehicleNo: ${mptCycleVehicleNoArray.concat(',')}`);

            let currentDateStr = moment().format('YYYY-MM-DD');
            let vehicleMaintenaceTimeOutRecords = [];
            let vehicleHoldLogRecords = [];
            for (let vehicle of vehicleList) {
                if (vehicle) {
                    let vehicleOnHold = 0;
                    let currentVehicleWptTime = vehicle.nextWpt1Time ? moment(vehicle.nextWpt1Time).format('YYYY-MM-DD') : '';
                    let currentVehicleMptTime = vehicle.nextMptTime ? moment(vehicle.nextMptTime).format('YYYY-MM-DD') : '';
                    let currentVehiclePmTime = vehicle.nextPmTime ? moment(vehicle.nextPmTime).format('YYYY-MM-DD') : '';
                    let currentVehicleAviTime = vehicle.nextAviTime ? moment(vehicle.nextAviTime).format('YYYY-MM-DD') : '';
                    // wpt time <= current time: vehicle wpt maintenace timeout.
                    if (currentVehicleWptTime && currentVehicleWptTime <= currentDateStr) {
                        vehicleMaintenaceTimeOutRecords.push({
                            vehicleNo: vehicle.vehicleNo,
                            type: 'wpt',
                            recordTime: currentDateStr,
                        });
                        //twice wpt timeout: vheicle onhold
                        let preWeekWptCheckDay = moment(moment().startOf('isoWeek')).subtract(1, 'd').format('YYYY-MM-DD');
                        let preWeekWptTimeout = await VehilceMaintenaceTimeoutRecord.findOne({where: {vehicleNo: vehicle.vehicleNo, type: 'wpt', recordTime: preWeekWptCheckDay}});
                        if (preWeekWptTimeout) {
                            log.warn(`Vehicle[${vehicle.vehicleNo}] has twice wpt time out:${preWeekWptCheckDay}, ${currentDateStr}.`);
                            vehicleOnHold = 1;
                        }
                    }
                    // mpt time <= current time: vehicle mpt maintenace timeout.
                    if (currentVehicleMptTime && currentVehicleMptTime <= currentDateStr) {
                        vehicleMaintenaceTimeOutRecords.push({
                            vehicleNo: vehicle.vehicleNo,
                            type: 'mpt',
                            recordTime: currentDateStr,
                        });
                    }
                    // pm time <= current time: vehicle pm maintenace timeout.
                    if (currentVehiclePmTime && currentVehiclePmTime <= currentDateStr) {
                        vehicleMaintenaceTimeOutRecords.push({
                            vehicleNo: vehicle.vehicleNo,
                            type: 'pm',
                            recordTime: currentDateStr,
                        });
                    }
                    // avi time <= current time: vehicle avi maintenace timeout.
                    if (currentVehicleAviTime && currentVehicleAviTime <= currentDateStr) {
                        vehicleMaintenaceTimeOutRecords.push({
                            vehicleNo: vehicle.vehicleNo,
                            type: 'avi',
                            recordTime: currentDateStr,
                        });
                        vehicleOnHold = 1;
                    }

                    //add vehicle onhold log.
                    if (vehicleOnHold == 1) {
                        await Vehicle.update({onhold: vehicleOnHold}, {where: {vehicleNo: vehicle.vehicleNo}});
                        vehicleHoldLogRecords.push({
                            operatorId: 1,
                            businessType: 'vehicle',
                            businessId: vehicle.vehicleNo,
                            optType: 'onhold', 
                            beforeData: '0',
                            afterData: '1',
                            optTime: moment(),
                            remarks: 'schedule vehicle onhold'
                        });
                    } else {
                        let nextWpt1Time = moment(wptEndTimeStr).format('YYYY-MM-DD');
                        if (wptCycleVehicleNoArray.indexOf(vehicle.vehicleNo) != -1) {
                            nextWpt1Time = null;
                        }
                        await Vehicle.update({ nextWpt1Time: nextWpt1Time }, {where: {vehicleNo: vehicle.vehicleNo}});
                        log.info(`reCaclVehicleWptTime vehicle[${vehicle.vehicleNo}] udpate nextWpt1Time: ${nextWpt1Time}`);

                        if (!currentVehicleMptTime || currentVehicleMptTime <= currentDateStr) {
                            let nextMptTime = moment(mptEndTimeStr).format('YYYY-MM-DD');
                            if (mptCycleVehicleNoArray.indexOf(vehicle.vehicleNo) != -1) {
                                nextMptTime = null;
                            }
                            await Vehicle.update({nextMptTime: nextMptTime}, {where: {vehicleNo: vehicle.vehicleNo}});
                            log.info(`reCaclVehicleMptTime vehicle[${vehicle.vehicleNo}] udpate nextMptTime: ${nextMptTime}`);
                        }
                    }
                }
            }
            if (vehicleMaintenaceTimeOutRecords.length > 0) {
                await VehilceMaintenaceTimeoutRecord.bulkCreate(vehicleMaintenaceTimeOutRecords);
            }
            if (vehicleHoldLogRecords.length > 0) {
                await OperationRecord.bulkCreate(vehicleHoldLogRecords);
            }
        }
        log.info(`(calcVehicleWptSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): finished working`);
    } catch (error) {
        log.error(`(calcVehicleWptSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed,  ${error}`);
        log.error(error);
    }
}