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
                    const updateVehicleByTask = async function (){
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
                                if (dataFrom == 'MT-ADMIN') {
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
                    } 
                    await updateVehicleByTask()

                    let vehicleDutys = allPendingDutys.filter(item => item.vehicleNo == timeOutVehicleNo);
                    let dutyOptLogs = [];
                    let dutyIds = [];
                    let configIds = [];
                    const initUrgentDutyByVehicleNo = async function() {
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
                    await initUrgentDutyByVehicleNo()
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
                    const deleteVehicleBySystem = async function (){
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
                    await deleteVehicleBySystem();
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