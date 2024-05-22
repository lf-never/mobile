const log = require('../log/winston').logger('resourceMonthWorkdaysStatProcess Child Process');
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const conf = require('../conf/conf.js');
const utils = require('../util/utils.js');

const { Driver } = require('../model/driver.js');
const { DriverMonthWorkdays, VehicleMonthWorkdays } = require('../model/resourceMonthWorkdaysStat.js');

process.on('message', async processParams => {
    log.info(`resourceMonthWorkdaysStatProcess Child Process, receive Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    let selectedMonths = processParams;
    if (!selectedMonths || selectedMonths.length == 0) {
        selectedMonths = [];
        let preMonthStr = moment().add(-1, 'months').format('YYYY-MM');
        selectedMonths.push(preMonthStr);
    }
    for (let selectedMonth of selectedMonths) {
        let monthRestDayStrs = await utils.getMonthRestdays(selectedMonth);
        //check has month data
        let toMonthDataNumSql = `
            select count(*) as dataNum from driver_month_workdays_stat where month='${selectedMonth}'
        `;
        let toMonthDataNumResult = await sequelizeObj.query(toMonthDataNumSql, { type: QueryTypes.SELECT, replacements: [] })
        let toDataNum = 0;
        if (toMonthDataNumResult) {
            toDataNum = toMonthDataNumResult[0].dataNum;
        }
        if (toDataNum == 0) {
            await startCalcTo(selectedMonth, monthRestDayStrs);
        }
        
        let vehicleMonthDataNumSql = `
            select count(*) as dataNum from vehicle_month_workdays_stat where month='${selectedMonth}'
        `;
        let vehicleMonthDataNumResult = await sequelizeObj.query(vehicleMonthDataNumSql, { type: QueryTypes.SELECT, replacements: [] })
        let vehicleDataNum = 0;
        if (vehicleMonthDataNumResult) {
            vehicleDataNum = vehicleMonthDataNumResult[0].dataNum;
        }
        if (vehicleDataNum == 0) {
            await startCalcVehicle(selectedMonth, monthRestDayStrs);
        }
    }
    log.info(`resourceMonthWorkdaysStatProcess Child Process, completed Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    process.send({ success: true })
})

const startCalcTo = async function(selectedMonth, monthRestDayStrs) {
    try {
        let allDriversSql = `
            SELECT
                d.driverId,
                d.unitId
            FROM driver d
            LEFT JOIN USER u ON d.driverId = u.driverId
            LEFT JOIN unit un ON d.unitId = un.id
            WHERE u.role = 'TO' AND d.unitId IS NOT NULL AND (d.operationallyReadyDate is NULL OR DATE_FORMAT(d.operationallyReadyDate, '%Y-%m') >= '${selectedMonth}') 
        `;
        let allDriverResult = await sequelizeObj.query(allDriversSql, { type: QueryTypes.SELECT, replacements: [] })
        //stat TO driver workdays
        let taskInfoSql = `
            SELECT
                t.taskId,
                t.driverId,
                if(un.id is NOT NULL, un.id, -1) as unitId,
                t.indentStartTime,
                t.indentEndTime,
                t.mobileStartTime,
                t.mobileEndTime
            FROM task t
            LEFT JOIN driver d ON t.driverId = d.driverId
            LEFT JOIN user u ON d.driverId = u.driverId
            LEFT JOIN unit un ON t.hub = un.unit and (t.node = un.subUnit OR (t.node is NULL and un.subUnit is NULL))
            where u.role = 'TO' AND t.driverStatus != 'Cancelled' AND (
                DATE_FORMAT(t.indentStartTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(t.indentEndTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(t.indentStartTime, '%Y-%m') AND DATE_FORMAT(t.indentEndTime, '%Y-%m'))
            )
        `;
        let taskInfoResult = await sequelizeObj.query(taskInfoSql, { type: QueryTypes.SELECT, replacements: [] })

        //all driver leave result 
        let leaveDaysSql = `
            SELECT
                driverId,
                startTime,
                endTime,
                IF (dayType = 'all', 1, 0.5) AS leaveDays
            FROM driver_leave_record
            WHERE STATUS = 1 and driverId is not null AND DATE_FORMAT(startTime, '%Y-%m') = '${selectedMonth}' and DATE_FORMAT(startTime, '%Y-%m-%d') not in(?)
        `;
        let leaveDaysResult = await sequelizeObj.query(leaveDaysSql, { type: QueryTypes.SELECT, replacements: [monthRestDayStrs] });

        // all driver hotoOut data
        let hotoDaysSql = `
            select driverId, unitId, startDateTime, endDateTime
            from hoto 
            where status='Approved' and driverId is not null
            AND (
                DATE_FORMAT(startDateTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(endDateTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(startDateTime, '%Y-%m') AND DATE_FORMAT(endDateTime, '%Y-%m'))
            )
            UNION ALL
            select hr.driverId, un.id as unitId, startDateTime, returnDateTime as endDateTime
            from hoto_record hr
            LEFT JOIN unit un ON hr.toHub = un.unit and (hr.toNode = un.subUnit OR (hr.toNode is NULL and un.subUnit is NULL))
            where status='Approved' and hr.driverId is not null
            AND (
                DATE_FORMAT(startDateTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(returnDateTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(startDateTime, '%Y-%m') AND DATE_FORMAT(returnDateTime, '%Y-%m'))
            )
        `;
        let hotoDaysResult = await sequelizeObj.query(hotoDaysSql, { type: QueryTypes.SELECT, replacements: [] });

        for (let driverInfo of allDriverResult) {
            let driverUnitWorkdaysList = [];

            let driverId = driverInfo.driverId;
            let driverUnitId = driverInfo.unitId;
            let driverTasks = taskInfoResult.filter(item => item.driverId == driverId);

            let workUnitIds = Array.from(new Set(driverTasks.map(item => item.unitId)));
            async function buildDriverUnitWorkData() {
                if (workUnitIds.length > 0) {
                    for (let workUnitId of workUnitIds) {
                        let unitTasks = taskInfoResult.filter(item => item.driverId == driverId && item.unitId == workUnitId);
                        let leaveDays = [];
                        let hotoOutDays = [];
                        if (workUnitId == driverUnitId) {
                            leaveDays = leaveDaysResult.filter(item => item.driverId == driverId);
                            hotoOutDays = hotoDaysResult.filter(item => item.driverId == driverId);
                        }
                        let toWorkTimeInfo = await calcDriverMonthWorkTime(driverId, selectedMonth, unitTasks, leaveDays, hotoOutDays, monthRestDayStrs);
    
                        driverUnitWorkdaysList.push({
                            driverId,
                            month: selectedMonth,
                            driverUnitId,
                            workUnitId: workUnitId,
                            taskNum: toWorkTimeInfo.taskNum,
                            planWorkDays: toWorkTimeInfo.planWorkDays, 
                            actualWorkDays: toWorkTimeInfo.actualWorkDays,
                            leaveDays: toWorkTimeInfo.toLeaveDays,
                            hotoOutDays: toWorkTimeInfo.toHotoOutDays
                        });
                    }
                }
                if (driverUnitWorkdaysList.length == 0) {
                    let leaveDays = leaveDaysResult.filter(item => item.driverId == driverId);
                    let hotoOutDays = hotoDaysResult.filter(item => item.driverId == driverId);
                    let toWorkTimeInfo = await calcDriverMonthWorkTime(driverId, selectedMonth, [], leaveDays, hotoOutDays, monthRestDayStrs);
    
                    driverUnitWorkdaysList.push({
                        driverId,
                        month: selectedMonth,
                        driverUnitId,
                        workUnitId: driverUnitId,
                        taskNum: 0,
                        planWorkDays: 0, 
                        actualWorkDays: 0,
                        leaveDays: toWorkTimeInfo ? toWorkTimeInfo.toLeaveDays : 0,
                        hotoOutDays: toWorkTimeInfo ? toWorkTimeInfo.toHotoOutDays : 0
                    });
                }
            }

            await buildDriverUnitWorkData();

            await DriverMonthWorkdays.destroy({where: {driverId, month: selectedMonth}});
            await DriverMonthWorkdays.bulkCreate(driverUnitWorkdaysList);
        }
    } catch (error) {
        log.error(`(resourceMonthWorkdaysStatProcess.caclTo ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed.`);
        log.error(error);
    }
}

const startCalcVehicle = async function(selectedMonth, monthRestDayStrs) {
    try {
        let allVehicleInfoSql = `
            select
                vv.unitId,
                vv.vehicleNo
            from vehicle vv
            LEFT JOIN unit un ON vv.unitId = un.id
            WHERE vv.unitId is NOT NULL
        `;
        let allVehicleInfoResult = await sequelizeObj.query(allVehicleInfoSql, { type: QueryTypes.SELECT, replacements: [] })

        //stat vehicle workdays
        let taskInfoSql = `
            SELECT
                t.taskId,
                if(un.id is NOT NULL, un.id, -1) as unitId,
                t.vehicleNumber as vehicleNo,
                t.indentStartTime,
                t.indentEndTime,
                t.mobileStartTime,
                t.mobileEndTime
            FROM task t
            LEFT JOIN unit un ON t.hub = un.unit and (t.node = un.subUnit OR (t.node is NULL and un.subUnit is NULL))
            where t.vehicleNumber is not null AND t.driverStatus != 'Cancelled' AND (
                DATE_FORMAT(t.indentStartTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(t.indentEndTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(t.indentStartTime, '%Y-%m') AND DATE_FORMAT(t.indentEndTime, '%Y-%m'))
            )
        `;
        let taskInfoResult = await sequelizeObj.query(taskInfoSql, { type: QueryTypes.SELECT, replacements: [] })

        //all vehicle leave result 
        let leaveDaysSql = `
            SELECT
                vehicleNo,
                startTime,
                endTime,
                IF (dayType = 'all', 1, 0.5) AS leaveDays
            FROM vehicle_leave_record
            WHERE STATUS = 1 and vehicleNo is not null AND DATE_FORMAT(startTime, '%Y-%m') = '${selectedMonth}' and DATE_FORMAT(startTime, '%Y-%m-%d') not in(?)
        `;
        let leaveDaysResult = await sequelizeObj.query(leaveDaysSql, { type: QueryTypes.SELECT, replacements: [monthRestDayStrs] });

        // all vehicle hotoOut data
        let hotoDaysSql = `
            select vehicleNo, unitId, startDateTime, endDateTime
            from hoto 
            where status='Approved' and vehicleNo is not null
            AND (
                DATE_FORMAT(startDateTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(endDateTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(startDateTime, '%Y-%m') AND DATE_FORMAT(endDateTime, '%Y-%m'))
            )
            UNION ALL
            select hr.vehicleNo, un.id as unitId, startDateTime, returnDateTime as endDateTime
            from hoto_record hr
            LEFT JOIN unit un ON hr.toHub = un.unit and (hr.toNode = un.subUnit OR (hr.toNode is NULL and un.subUnit is NULL))
            where status='Approved' and hr.vehicleNo is not null
            AND (
                DATE_FORMAT(startDateTime, '%Y-%m') = '${selectedMonth}' 
                OR DATE_FORMAT(returnDateTime, '%Y-%m') = '${selectedMonth}'
                OR ('${selectedMonth}' BETWEEN DATE_FORMAT(startDateTime, '%Y-%m') AND DATE_FORMAT(returnDateTime, '%Y-%m'))
            )
        `;
        let hotoDaysResult = await sequelizeObj.query(hotoDaysSql, { type: QueryTypes.SELECT, replacements: [] });

        for (let vehicleInfo of allVehicleInfoResult) {
            let vehicleUnitWorkdaysList = [];

            let vehicleNo = vehicleInfo.vehicleNo;
            let vehicleUnitId = vehicleInfo.unitId;
            let vehicleTasks = taskInfoResult.filter(item => item.vehicleNo == vehicleNo);
            
            let workUnitIds = Array.from(new Set(vehicleTasks.map(item => item.unitId)));

            async function buildVehicleUnitWorkData() {
                if (workUnitIds.length > 0) {
                    for (let workUnitId of workUnitIds) {
                        let unitTasks = taskInfoResult.filter(item => item.vehicleNo == vehicleNo && item.unitId == workUnitId);
                        let leaveDays = [];
                        let hotoOutDays = [];
                        if (workUnitId == vehicleUnitId) {
                            leaveDays = leaveDaysResult.filter(item => item.vehicleNo == vehicleNo);
                            hotoOutDays = hotoDaysResult.filter(item => item.vehicleNo == vehicleNo);
                        }
                        let vehicleWorkTimeInfo = await calcVehicleMonthWorkTime(vehicleNo, selectedMonth, unitTasks, leaveDays, hotoOutDays, monthRestDayStrs);
    
                        vehicleUnitWorkdaysList.push({
                            vehicleNo,
                            month: selectedMonth,
                            vehicleUnitId,
                            workUnitId: workUnitId,
                            taskNum: vehicleWorkTimeInfo.taskNum,
                            planWorkDays: vehicleWorkTimeInfo.planWorkDays, 
                            actualWorkDays: vehicleWorkTimeInfo.actualWorkDays,
                            eventDays: vehicleWorkTimeInfo.vehicleLeaveDays,
                            hotoOutDays: vehicleWorkTimeInfo.vehicleHotoOutDays
                        });
                    }
                }
                if (vehicleUnitWorkdaysList.length == 0) {
                    let leaveDays = leaveDaysResult.filter(item => item.vehicleNo == vehicleNo);
                    let hotoOutDays = hotoDaysResult.filter(item => item.vehicleNo == vehicleNo);
                    let vehicleWorkTimeInfo = await calcVehicleMonthWorkTime(vehicleNo, selectedMonth, [], leaveDays, hotoOutDays, monthRestDayStrs);
    
                    vehicleUnitWorkdaysList.push({
                        vehicleNo,
                        month: selectedMonth,
                        vehicleUnitId,
                        workUnitId: vehicleUnitId,
                        taskNum: 0,
                        planWorkDays: 0, 
                        actualWorkDays: 0,
                        eventDays: vehicleWorkTimeInfo ? vehicleWorkTimeInfo.vehicleLeaveDays : 0,
                        hotoOutDays: vehicleWorkTimeInfo ? vehicleWorkTimeInfo.vehicleHotoOutDays : 0
                    });
                }
            }

            await buildVehicleUnitWorkData();

            await VehicleMonthWorkdays.destroy({where: {vehicleNo, month: selectedMonth}});
            await VehicleMonthWorkdays.bulkCreate(vehicleUnitWorkdaysList);
        }
    } catch (error) {
        log.error(`(resourceMonthWorkdaysStatProcess.caclVehicle ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed.`);
        log.error(error);
    }
}

const calcDriverMonthWorkTime = async function(driverId, selectedMonth, driverMonthTaskList, leaveDaysResult, hotoOutDaysResult, monthRestDayStrs) {
    let result = {
        driverId: driverId,
        taskNum: driverMonthTaskList.length,
        planWorkDays: 0,
        actualWorkDays: 0,
        toLeaveDays: 0,
        toHotoOutDays: 0,
    };

    let monthStartTimeLong = Number(moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').format('YYYYMMDDHHmmss'));
    let monthEndTimeLong = Number(moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'months').add(-1, 'seconds').format('YYYYMMDDHHmmss'));
    let monthEndDayStr = moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'months').add(-1, 'seconds').format('YYYYMMDD');
    //leave days
    let toLeaveDays = 0;
    for (let temp of leaveDaysResult) {
        toLeaveDays += temp.leaveDays ? Number(temp.leaveDays).valueOf() : 0;
    }
    result.toLeaveDays = toLeaveDays;

    //hoto out days
    processHotoOutDate(hotoOutDaysResult, monthStartTimeLong, monthEndTimeLong);

    //split hoto days to every day list then exclude month rest days(weekend and holidays)
    let newHotoDaysList = splitHotoOutDate(hotoOutDaysResult, monthRestDayStrs, monthEndDayStr);

    //hoto data order by startDateTime asc
    newHotoDaysList = newHotoDaysList.sort(function(item1, item2) {
        if (moment(item1.startDateTime).isBefore(moment(item2.startDateTime))) {
            return -1;
        } 
        return 1;
    });

    //Merge Intersections days
    let hotoOutIntervalList = mergeHotoOutDate(newHotoDaysList);
    let hotoOutDays = calcHotoOutDays(hotoOutIntervalList);
    result.toHotoOutDays = hotoOutDays;

    if (driverMonthTaskList.length == 0) {
        return result;     
    }

    for (let task of driverMonthTaskList) {
        buildTaskPlanDate(task);
        buildTaskActualDate(task);
    }
    driverMonthTaskList = driverMonthTaskList.sort(function(item1, item2) {
        if (moment(item1.indentStartTime).isBefore(moment(item2.indentStartTime))) {
            return -1;
        } 
        return 1;
    });

    let driverMonthPlanWorktimeIntervalList = [];
    let driverMonthActualWorktimeIntervalList = [];
    function buildTaskPlanDate1(temp) {
        let tempStartTimeLong = Number(moment(temp.indentStartTime).format('YYYYMMDDHHmmss'));
        let tempEndTimeLong = Number(moment(temp.indentEndTime).format('YYYYMMDDHHmmss'));
        if (driverMonthPlanWorktimeIntervalList.length > 0) {
            let preLeave = driverMonthPlanWorktimeIntervalList[driverMonthPlanWorktimeIntervalList.length - 1];
            if (tempStartTimeLong < preLeave.endTime) {
                if (tempEndTimeLong > preLeave.endTime) {
                    preLeave.endTime = tempEndTimeLong;
                }
            } else {
                driverMonthPlanWorktimeIntervalList.push({
                    startTime: tempStartTimeLong,
                    endTime: tempEndTimeLong
                });
            }
        } else {
            driverMonthPlanWorktimeIntervalList.push({
                startTime: tempStartTimeLong,
                endTime: tempEndTimeLong
            });
        }
    }
    function buildTaskActualDate1(temp) {
        if (!temp.mobileStartTime || !temp.mobileEndTime) {
            return;
        }
       
        let tempStartTimeLong = Number(moment(temp.mobileStartTime).format('YYYYMMDDHHmmss'));
        let tempEndTimeLong = Number(moment(temp.mobileEndTime).format('YYYYMMDDHHmmss'));
        if (tempStartTimeLong > monthEndTimeLong || tempEndTimeLong < monthStartTimeLong) {
            return;
        }

        if (driverMonthActualWorktimeIntervalList.length > 0) {
            let preLeave = driverMonthActualWorktimeIntervalList[driverMonthActualWorktimeIntervalList.length - 1];
            if (tempStartTimeLong < preLeave.endTime) {
                if (tempEndTimeLong > preLeave.endTime) {
                    preLeave.endTime = tempEndTimeLong;
                }
            } else {
                driverMonthActualWorktimeIntervalList.push({
                    startTime: tempStartTimeLong,
                    endTime: tempEndTimeLong
                });
            }
        } else {
            driverMonthActualWorktimeIntervalList.push({
                startTime: tempStartTimeLong,
                endTime: tempEndTimeLong
            });
        }
    }
    for (let task of driverMonthTaskList) {
        // plan work time
        buildTaskPlanDate1(task);
        //actual work time
        buildTaskActualDate1(task);
    }

    //stat plan work times
    function statPlanWorkTimes() {
        let planWorkDays = 0;
        for (let timeInterval of driverMonthPlanWorktimeIntervalList) {
            let startTime = timeInterval.startTime;
            let endTime = timeInterval.endTime;
            if (startTime < monthStartTimeLong) {
                startTime = monthStartTimeLong;
            }
            if (endTime > monthEndTimeLong) {
                endTime = monthEndTimeLong;
            }
            let workDays = calcWorkTime(startTime, endTime);
            planWorkDays += workDays;
        }
        result.planWorkDays = planWorkDays;
    }
    statPlanWorkTimes();

    //stat actual work times
    function statActualWorkTimes() {
        let actualWorkDays = 0;
        for (let timeInterval of driverMonthActualWorktimeIntervalList) {
            let startTime = timeInterval.startTime;
            let endTime = timeInterval.endTime;
            if (startTime < monthStartTimeLong) {
                startTime = monthStartTimeLong;
            }
            if (endTime > monthEndTimeLong) {
                endTime = monthEndTimeLong;
            }
            let workDays = calcWorkTime(startTime, endTime);
            actualWorkDays += workDays;
        }
        result.actualWorkDays = actualWorkDays;
    }
    statActualWorkTimes();

    return result;
}

const calcVehicleMonthWorkTime = async function(vehicleNo, selectedMonth, vehicleMonthTaskList, leaveDaysResult, hotoOutDaysResult, monthRestDayStrs) {
    let result = {
        vehicleNo: vehicleNo,
        taskNum: vehicleMonthTaskList.length,
        planWorkDays: 0,
        actualWorkDays: 0,
        vehicleLeaveDays: 0,
        vehicleHotoOutDays: 0,
    };

    let monthStartTimeLong = Number(moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').format('YYYYMMDDHHmmss'));
    let monthEndTimeLong = Number(moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'months').add(-1, 'seconds').format('YYYYMMDDHHmmss'));
    let monthEndDayStr = moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'months').add(-1, 'seconds').format('YYYYMMDD')
    //leave days
    let vehicleLeaveDays = 0;
    for (let temp of leaveDaysResult) {
        vehicleLeaveDays += temp.leaveDays ? Number(temp.leaveDays).valueOf() : 0;
    }
    result.vehicleLeaveDays = vehicleLeaveDays;

    //hoto out days
    processHotoOutDate(hotoOutDaysResult, monthStartTimeLong, monthEndTimeLong);

    //split hoto days to every day list then exclude month rest days(weekend and holidays)
    let newHotoDaysList = splitHotoOutDate(hotoOutDaysResult, monthRestDayStrs, monthEndDayStr);

    //hoto data order by startDateTime asc
    newHotoDaysList = newHotoDaysList.sort(function(item1, item2) {
        if (moment(item1.startDateTime).isBefore(moment(item2.startDateTime))) {
            return -1;
        } 
        return 1;
    });

    //Merge Intersections days
    let hotoOutIntervalList = mergeHotoOutDate(newHotoDaysList);

    let hotoOutDays = calcHotoOutDays(hotoOutIntervalList);

    result.vehicleHotoOutDays = hotoOutDays;

    if (vehicleMonthTaskList.length == 0) {
        return result;     
    }
    for (let task of vehicleMonthTaskList) {
        buildTaskPlanDate(task);
        buildTaskActualDate(task);
    }
    vehicleMonthTaskList = vehicleMonthTaskList.sort(function(item1, item2) {
        if (moment(item1.indentStartTime).isBefore(moment(item2.indentStartTime))) {
            return -1;
        } 
        return 1;
    })
    let vehicleMonthPlanWorktimeIntervalList = [];
    let vehicleMonthActualWorktimeIntervalList = [];
    function buildTaskPlanDate1(temp) {
        let tempStartTimeLong = Number(moment(temp.indentStartTime).format('YYYYMMDDHHmmss'));
        let tempEndTimeLong = Number(moment(temp.indentEndTime).format('YYYYMMDDHHmmss'));
        if (vehicleMonthPlanWorktimeIntervalList.length > 0) {
            let preLeave = vehicleMonthPlanWorktimeIntervalList[vehicleMonthPlanWorktimeIntervalList.length - 1];
            if (tempStartTimeLong < preLeave.endTime) {
                if (tempEndTimeLong > preLeave.endTime) {
                    preLeave.endTime = tempEndTimeLong;
                }
            } else {
                vehicleMonthPlanWorktimeIntervalList.push({
                    startTime: tempStartTimeLong,
                    endTime: tempEndTimeLong
                });
            }
        } else {
            vehicleMonthPlanWorktimeIntervalList.push({
                startTime: tempStartTimeLong,
                endTime: tempEndTimeLong
            });
        }
    }
    function buildTaskActualDate1(temp) {
        if (!temp.mobileStartTime || !temp.mobileEndTime) {
            return;
        }
        let tempStartTimeLong = Number(moment(temp.mobileStartTime).format('YYYYMMDDHHmmss'));
        let tempEndTimeLong = Number(moment(temp.mobileEndTime).format('YYYYMMDDHHmmss'));

        if (tempStartTimeLong > monthEndTimeLong || tempEndTimeLong < monthStartTimeLong) {
            return;
        }

        if (vehicleMonthActualWorktimeIntervalList.length > 0) {
            let preLeave = vehicleMonthActualWorktimeIntervalList[vehicleMonthActualWorktimeIntervalList.length - 1];
            if (tempStartTimeLong < preLeave.endTime) {
                if (tempEndTimeLong > preLeave.endTime) {
                    preLeave.endTime = tempEndTimeLong;
                }
            } else {
                vehicleMonthActualWorktimeIntervalList.push({
                    startTime: tempStartTimeLong,
                    endTime: tempEndTimeLong
                });
            }
        } else {
            vehicleMonthActualWorktimeIntervalList.push({
                startTime: tempStartTimeLong,
                endTime: tempEndTimeLong
            });
        }
    }
    for (let temp of vehicleMonthTaskList) {
        // plan work time
        buildTaskPlanDate1(temp);
        //actual work time
        buildTaskActualDate1(temp);
    }

    //stat plan work times
    function statPlanWorkTimes() {
        let planWorkDays = 0;
        for (let timeInterval of vehicleMonthPlanWorktimeIntervalList) {
            let startTime = timeInterval.startTime;
            let endTime = timeInterval.endTime;
            if (startTime < monthStartTimeLong) {
                startTime = monthStartTimeLong;
            }
            if (endTime > monthEndTimeLong) {
                endTime = monthEndTimeLong;
            }
            let workDays = calcWorkTime(startTime, endTime);
            planWorkDays += workDays;
        }
        result.planWorkDays = planWorkDays;
    }
    statPlanWorkTimes();

    //stat actual work times
    function statActualWorkTimes() {
        let actualWorkDays = 0;
        for (let timeInterval of vehicleMonthActualWorktimeIntervalList) {
            let startTime = timeInterval.startTime;
            let endTime = timeInterval.endTime;
            if (startTime < monthStartTimeLong) {
                startTime = monthStartTimeLong;
            }
            if (endTime > monthEndTimeLong) {
                endTime = monthEndTimeLong;
            }
            let workDays = calcWorkTime(startTime, endTime);
            actualWorkDays += workDays;
        }
        result.actualWorkDays = actualWorkDays;
    }
    statActualWorkTimes();

    return result;
}

const calcWorkTime = function(startTime, endTime) {
    if (endTime < startTime) {
        return 0;
    }
    startTime = moment('' + startTime, 'YYYYMMDDHHmmss');
    endTime = moment('' + endTime, 'YYYYMMDDHHmmss');

    let startAm = Number(startTime.format('H')) >= 12 ? "pm" : 'am';
    let endAm = Number(endTime.format('H')) >= 12 ? "pm" : 'am';

    let diffDays = moment(endTime.format("YYYY-MM-DD")).diff(moment(startTime.format("YYYY-MM-DD")), 'days');
    let workDays = 0.5;
    if (diffDays == 0) {
        if (startAm != endAm) {
            workDays = 1;
        }
    } else {
        let startTimeWorkDays = (startAm == 'am' ? 1 : 0.5);
        let endTimeWorkDays = (endAm == 'am' ? 0.5 : 1);
        if (diffDays == 1) {
            workDays = startTimeWorkDays + endTimeWorkDays;
        } else {
            workDays = startTimeWorkDays + endTimeWorkDays + (diffDays - 1);
        }
    }

    return workDays;
}

function processHotoOutDate(hotoOutDaysResult, monthStartTimeLong, monthEndTimeLong) {
    for (let temp of hotoOutDaysResult) {
        if (Number(moment(temp.startDateTime).format('H')) < 12) {
            temp.startDateTime = moment(temp.startDateTime).format('YYYY-MM-DD') + ' 00:00:00';
        } else {
            temp.startDateTime = moment(temp.startDateTime).format('YYYY-MM-DD') + ' 12:00:00';
        }
        if (Number(moment(temp.endDateTime).format('H')) < 12) {
            temp.endDateTime = moment(temp.endDateTime).format('YYYY-MM-DD') + ' 11:59:59';
        } else {
            temp.endDateTime = moment(temp.endDateTime).format('YYYY-MM-DD') + ' 23:59:59';
        }

        let hotoStartTimeLong = moment(temp.startDateTime).format('YYYYMMDDHHmmss');
        if (monthStartTimeLong > hotoStartTimeLong) {
            temp.startDateTime = selectedMonth+'-01 00:00:00';
        }
        let hotoEndTimeLong = moment(temp.endDateTime).format('YYYYMMDDHHmmss');
        if (monthEndTimeLong < hotoEndTimeLong) {
            temp.endDateTime = moment(selectedMonth+'-01 00:00:00', 'YYYY-MM-DD HH:mm:ss').add(1, 'months').add(-1, 'seconds').format('YYYY-MM-DD HH:mm:ss');
        }
    }
}

function splitHotoOutDate(hotoOutDaysResult, monthRestDayStrs, monthEndDayStr) {
    let newHotoDaysList = [];
    for (let temp of hotoOutDaysResult) {
        let startDayStr = moment(temp.startDateTime).format('YYYYMMDD');
        let endDayStr = moment(temp.endDateTime).format('YYYYMMDD');
        if (endDayStr > monthEndDayStr) {
            endDayStr = monthEndDayStr
        }

        let diffDays = Number(endDayStr) - Number(startDayStr);
        let index = 0;
        while (index <= diffDays) {
            let hotoDayStr = moment(temp.startDateTime).add(index, 'days').format('YYYY-MM-DD');
            if (monthRestDayStrs.indexOf(hotoDayStr) != -1) {
                index++;
                continue;
            }

            let hotoDay = {startDateTime: hotoDayStr + ' 00:00:00', endDateTime: hotoDayStr + ' 23:59:59'};
            if (index == 0) {
                hotoDay.startDateTime = temp.startDateTime;
            }
            if (index >= (diffDays - 1)) {
                hotoDay.endDateTime = temp.endDateTime;
            }
            newHotoDaysList.push(hotoDay);
            index++;
        }
    }
    return newHotoDaysList;
}

function mergeHotoOutDate(newHotoDaysList) {
    let hotoOutIntervalList = [];
    for (let temp of newHotoDaysList) {
        let tempStartTimeLong = Number(moment(temp.startDateTime).format('YYYYMMDDHHmmss'));
        let tempEndTimeLong = Number(moment(temp.endDateTime).format('YYYYMMDDHHmmss'));

        if (hotoOutIntervalList.length > 0) {
            let preLeave = hotoOutIntervalList[hotoOutIntervalList.length - 1];
            if (tempStartTimeLong < preLeave.endTime) {
                if (tempEndTimeLong > preLeave.endTime) {
                    preLeave.endTime = tempEndTimeLong;
                }
            } else {
                hotoOutIntervalList.push({
                    startTime: tempStartTimeLong,
                    endTime: tempEndTimeLong
                });
            }
        } else {
            hotoOutIntervalList.push({
                startTime: tempStartTimeLong,
                endTime: tempEndTimeLong
            });
        }
    }
    return hotoOutIntervalList;
}

function calcHotoOutDays(hotoOutIntervalList) {
    let hotoOutDays = 0;
    for (let timeInterval of hotoOutIntervalList) {
        let startTime = timeInterval.startTime;
        let endTime = timeInterval.endTime;
        if (startTime < monthStartTimeLong) {
            startTime = monthStartTimeLong;
        }
        if (endTime > monthEndTimeLong) {
            endTime = monthEndTimeLong;
        }
        let tempHotoOutDays = calcWorkTime(startTime, endTime);
        hotoOutDays += tempHotoOutDays;
    }
    return hotoOutDays;
}

function buildTaskPlanDate(task) {
    if (Number(moment(task.indentStartTime).format('H')) < 12) {
        task.indentStartTime = moment(task.indentStartTime).format('YYYY-MM-DD') + ' 00:00:00';
    } else {
        task.indentStartTime = moment(task.indentStartTime).format('YYYY-MM-DD') + ' 12:00:00';
    }
    if (Number(moment(task.indentEndTime).format('H')) < 12) {
        task.indentEndTime = moment(task.indentEndTime).format('YYYY-MM-DD') + ' 11:59:59';
    } else {
        task.indentEndTime = moment(task.indentEndTime).format('YYYY-MM-DD') + ' 23:59:59';
    }
}

function buildTaskActualDate(task) {
    if (task.mobileStartTime && task.mobileEndTime) {
        if (Number(moment(task.mobileStartTime).format('H')) < 12) {
            task.mobileStartTime = moment(task.mobileStartTime).format('YYYY-MM-DD') + ' 00:00:00';
        } else {
            task.mobileStartTime = moment(task.mobileStartTime).format('YYYY-MM-DD') + ' 12:00:00';
        }
        if (Number(moment(task.mobileEndTime).format('H')) < 12) {
            task.mobileEndTime = moment(task.mobileEndTime).format('YYYY-MM-DD') + ' 11:59:59';
        } else {
            task.mobileEndTime = moment(task.mobileEndTime).format('YYYY-MM-DD') + ' 23:59:59';
        }
    }
}


