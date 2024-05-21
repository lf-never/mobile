const log = require('../log/winston').logger('calcDriverLicenseExchange Child Process');
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const conf = require('../conf/conf.js');

const { Driver } = require('../model/driver.js');
const { DriverLicenseExchangeApply } = require('../model/driverLicenseExchangeApply.js');
const { SOS } = require('../model/sos.js');
const { PermitType } = require('../model/permitType.js');

process.on('message', async processParams => {
    log.info(`calcDriverLicenseExchange Child Process, receive Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    await startCalc();
    log.info(`calcDriverLicenseExchange Child Process, completed Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `)
    process.send({ success: true })
})

const startCalc = async function() {
    try {
        let currentDay = moment().format("YYYY-MM-DD");
        let effectiveDrivers = await sequelizeObj.query(`
            SELECT
                d.driverId,d.driverName,d.nric,d.birthday,d.enlistmentDate,d.permitType,d.email
            FROM
                driver d
            WHERE d.operationallyReadyDate is NULL or d.operationallyReadyDate > NOW();
        `, { replacements: [], type: QueryTypes.SELECT })
        log.info(`${currentDay} has ${effectiveDrivers ? effectiveDrivers.length : 0} drivers need calc licenseExchange.` );
        if (effectiveDrivers && effectiveDrivers.length > 0) {
            for (let driverInfo of effectiveDrivers) {
                log.info(`driverLicenseExchangeSchedule start: driverId: ${driverInfo.driverId}, driverName: ${driverInfo.driverName}, permitType: ${driverInfo.permitType}`);
                await calcDriverLicenseInfo(driverInfo);
                await calcDriverCivilianLicenseInfo(driverInfo);
            }
        }
    } catch (error) {
        log.error(`(driverLicenseExchangeSchedule ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed,  ${error}`);
    }
}

const calcDriverLicenseInfo = async function(driverInfo) {
	let errorMsg = '';
	try {
        if (driverInfo) {
            let checkEnlistmentDateErrorMsg = await checkEnlistmentDate(driverInfo);
            let checkAgeErrorMsg = '';//await checkAge(driverInfo);
            let checkDemeritPointsResult = await checkDemeritPoints(driverInfo);
            let checkDemeritPointsErrorMsg = checkDemeritPointsResult.errorMsg;

            errorMsg = (checkEnlistmentDateErrorMsg ?? '') + (checkAgeErrorMsg ?? '') + (checkDemeritPointsErrorMsg ?? '')
            if (!errorMsg) {
                //{permitType: 'CL 3', allType: ['CL 3', 'CL 3B', 'CL 3BNX']}
                let driverPermits = [];
                let driverPermitTypeConfList = await sequelizeObj.query(`
                    SELECT
                        dm.permitType
                    FROM driver_permittype_detail dm
                    where dm.driverId=? ORDER BY dm.permitType asc
                `, { type: QueryTypes.SELECT, replacements: [ driverInfo.driverId ] });
                let permitTypes = driverPermitTypeConfList ? driverPermitTypeConfList.map(item => item.permitType) : [];
                if (permitTypes) {
                    for (let temp of permitTypes) {
                        let permitTypeConf = await PermitType.findOne({ where: { permitType : temp} });
                        if (permitTypeConf && permitTypeConf.parent) {
                            let parentPermitType = permitTypeConf.parent;
                            
                            let parentPermitTypeObj = driverPermits.find(item => item.permitType == parentPermitType);
                            if (parentPermitTypeObj) {
                                parentPermitTypeObj.allType.push(temp.toLowerCase());
                                continue;
                            }
                        }
                        driverPermits.push({permitType: temp, allType: [temp.toLowerCase()]});
                    }
                }
                permitTypes = driverPermits.map(item => item.permitType);

                for (let permitType of permitTypes) {
                    if (permitType.toLowerCase().startsWith('cl 2')) {
                        continue;
                    }
                    let applyRecord = await DriverLicenseExchangeApply.findOne({where: {driverId: driverInfo.driverId, permitType: permitType}});

                    if (!applyRecord || applyRecord.status == 'Pending Approval') {
                        let driverPermitObj = driverPermits.find(item => item.permitType == permitType);
                        let allType = [permitType.toLowerCase()];
                        if (driverPermitObj && driverPermitObj.allType && driverPermitObj.allType.length > 0) {
                            allType = driverPermitObj.allType;
                        } 
                        let checkTotalMileageResult =  await checkTotalMileage(driverInfo, permitType, allType);
                        let checkTotalMileageErrorMsg = checkTotalMileageResult.errorMsg;

                        errorMsg = checkTotalMileageErrorMsg;
                        if (!errorMsg) {
                            if (!applyRecord) {
                                //create driver permit exchange apply
                                await DriverLicenseExchangeApply.create({
                                    driverId: driverInfo.driverId,
                                    driverName: driverInfo.driverName,
                                    nric: driverInfo.nric, 
                                    permitType: permitType,
                                    permitTypeMileage: checkTotalMileageResult.mileageStr,
                                    enlistmentDate: driverInfo.enlistmentDate,
                                    birthday: driverInfo.birthday,
                                    emailConfirm: driverInfo.email,
                                    driverDemeritPoints: checkDemeritPointsResult.demeritPoints,
                                    permitTypeDemeritPoints: 0,
                                    applyDate: moment(),
                                    creator: 1
                                });
                            } else if (applyRecord.status == 'Pending Approval') {
                                await DriverLicenseExchangeApply.update({
                                    permitTypeMileage: checkTotalMileageResult.mileageStr,
                                    enlistmentDate: driverInfo.enlistmentDate,
                                    birthday: driverInfo.birthday,
                                    driverDemeritPoints: checkDemeritPointsResult.demeritPoints,
                                    permitTypeDemeritPoints: 0,
                                    applyDate: moment(),
                                    emailConfirm: driverInfo.email,
                                    updateAt: moment()
                                }, {where: {applyId: applyRecord.applyId}});
                            } else {
                                
                            }
                            log.info(`Driver[${driverInfo.driverId}] permit:${permitType} apply exchange permit!`);
                        } else {
                            log.info(`Driver[${driverInfo.driverId}] permit:${permitType} can't apply exchange permit: ${errorMsg}`);
                        }
                    }
                }
            } else {
                log.info(`Driver[${driverInfo.driverId}] can't conversion any license: ${errorMsg}`);
            }
        }
	} catch (error) {
		log.error(error);
		errorMsg = 'calcDriverLicenseInfo:' + (error && error.message ? error.message : 'System error!');
	}

	return errorMsg;
}

const calcDriverCivilianLicenseInfo = async function(driverInfo) {
	let errorMsg = '';
	try {
        if (driverInfo) {
            let checkDemeritPointsResult = await checkDemeritPoints(driverInfo);
            let checkDemeritPointsErrorMsg = checkDemeritPointsResult.errorMsg;

            errorMsg = checkDemeritPointsErrorMsg ?? ''
            if (!errorMsg) {
                let mileageArray = await getDriverMileageStatInfo(driverInfo.driverId);
                log.info(`calcDriverCivilianLicenseInfo driverId:${driverInfo.driverId}, mileage: ${ JSON.stringify(mileageArray)}`)
                let cl2MileageObj = mileageArray.find(item => item.permitType && item.permitType.toLowerCase() == 'cl 2');
                let cl2BMileageObj = mileageArray.find(item => item.permitType && item.permitType.toLowerCase() == 'cl 2b');
                if (!cl2MileageObj && !cl2BMileageObj) {
                    return;
                }
                let cl2Mileage = cl2MileageObj ? cl2MileageObj.totalMileage : 0;
                let cl2BMileage = cl2BMileageObj ? cl2BMileageObj.totalMileage : 0;

                //query driver effictive civilianLicense conf
                let effectiveIssueDateStr = moment().add(-1, 'year').format("YYYY-MM-DD");
                let driverEffectiveCivilianLicenseList = await sequelizeObj.query(`
                    SELECT
                        cl.driverId, cl.civilianLicence, cl.dateOfIssue, cl.status
                    FROM driver_civilian_licence cl
                    WHERE cl.driverId =? and cl.status='Approved' AND DATE_FORMAT(cl.dateOfIssue, '%Y-%m-%d') < ?
                `, { type: QueryTypes.SELECT, replacements: [ driverInfo.driverId, effectiveIssueDateStr ] });
                //need exchange civilian license
                let exchangeCivilianLicenses = [];
                if (cl2Mileage >= 4000) {
                    if (driverEffectiveCivilianLicenseList && driverEffectiveCivilianLicenseList.length > 0) {
                        for (let temp of driverEffectiveCivilianLicenseList) {
                            if (temp.civilianLicence && temp.civilianLicence.toLowerCase() == 'cl 2b') {
                                exchangeCivilianLicenses.push({permitType: 'CL 2A', mileageStr: 'CL 2:' + cl2Mileage + ";"});
                            } else if (temp.civilianLicence && temp.civilianLicence.toLowerCase() == 'cl 2a') {
                                exchangeCivilianLicenses.push({permitType: 'CL 2', mileageStr: 'CL 2:' + cl2Mileage + ";"});
                            }
                        }
                    } else {
                        exchangeCivilianLicenses.push({permitType: 'CL 2B', mileageStr: 'CL 2:' + cl2Mileage + ";"});
                    }
                }
                let cl2bTemp = exchangeCivilianLicenses.find(item => item.permitType == 'CL 2B');
                if (!cl2bTemp) {
                    if (cl2BMileage >= 4000 && (driverEffectiveCivilianLicenseList == null || driverEffectiveCivilianLicenseList.length == 0)) {
                        exchangeCivilianLicenses.push({permitType: 'CL 2B', mileageStr: 'CL 2B:' + cl2BMileage + ";"});
                    }
                }
                if (exchangeCivilianLicenses.length == 0) {
                    log.info(`Driver[${driverInfo.driverId}] calcDriverCivilianLicenseInfo: no civilian license can exchange, cl 2 mileage: ${cl2Mileage}, cl 2b mileage: ${cl2BMileage}`);
                }
                
                for (let civilianLicense of exchangeCivilianLicenses) {
                    let applyRecord = await DriverLicenseExchangeApply.findOne({where: {driverId: driverInfo.driverId, permitType: civilianLicense.permitType }});
                    if (!applyRecord || applyRecord.status == 'Pending Approval') {
                        if (!applyRecord) {
                            //create driver permit exchange apply
                            await DriverLicenseExchangeApply.create({
                                driverId: driverInfo.driverId,
                                driverName: driverInfo.driverName,
                                nric: driverInfo.nric, 
                                permitType: civilianLicense.permitType,
                                permitTypeMileage: civilianLicense.mileageStr,
                                enlistmentDate: driverInfo.enlistmentDate,
                                birthday: driverInfo.birthday,
                                emailConfirm: driverInfo.email,
                                driverDemeritPoints: checkDemeritPointsResult.demeritPoints,
                                permitTypeDemeritPoints: 0,
                                applyDate: moment(),
                                creator: 1
                            });
                        } else if (applyRecord.status == 'Pending Approval') {
                            await DriverLicenseExchangeApply.update({
                                permitTypeMileage: civilianLicense.mileageStr,
                                enlistmentDate: driverInfo.enlistmentDate,
                                birthday: driverInfo.birthday,
                                driverDemeritPoints: checkDemeritPointsResult.demeritPoints,
                                permitTypeDemeritPoints: 0,
                                applyDate: moment(),
                                emailConfirm: driverInfo.email,
                                updateAt: moment()
                            }, {where: {applyId: applyRecord.applyId}});
                        } else {
                            
                        }
                        log.info(`Driver[${driverInfo.driverId}] permit:${civilianLicense.permitType} apply exchange permit!`);
                    }
                }
            } else {
                log.info(`Driver[${driverInfo.driverId}] can't conversion any license: ${errorMsg}`);
            }
        }
	} catch (error) {
		log.error(error);
		errorMsg = 'calcDriverCivilianLicenseInfo:' + (error && error.message ? error.message : 'System error!');
	}
}

const checkEnlistmentDate = async function(driverInfo) {
	let errorMsg = '';
	try {
        //least need enlistment 20 months.
        let enlistmentDate = driverInfo.enlistmentDate;
        if (enlistmentDate) {
            let driverEnlistmentDateStr = moment(enlistmentDate).format("YYYY-MM-DD");
            let leastEnlistmentDateStr = moment().subtract(20, 'M').format("YYYY-MM-DD");
            if (driverEnlistmentDateStr > leastEnlistmentDateStr) {
                errorMsg = `Driver enlistmentDate is ${driverEnlistmentDateStr} less than 20 months;`;
            }
        } else {
            errorMsg = 'Driver EnlistmentDate is null!'
        }
	} catch (error) {
		log.error(error);
		errorMsg = 'calcDriverLicenseInfo.checkEnlistmentDate:' + (error && error.message ? error.message : 'System error!');
	}

	return errorMsg;
}
const checkAge = async function(driverInfo) {
	let errorMsg = '';
	try {
        //least need 21 age.
        let birthday = driverInfo.birthday;
        if (birthday) {
            let driverBirthdayDateStr = moment(birthday).format("YYYY-MM-DD");
            let leastBirthdayDateStr = moment().subtract(21, 'Y').format("YYYY-MM-DD");
            if (driverBirthdayDateStr > leastBirthdayDateStr) {
                errorMsg = `Driver birthday is ${driverBirthdayDateStr}, age less than 21;`;
            }
        } else {
            errorMsg = 'Driver birthday is null;'
        }
	} catch (error) {
		log.error(error);
		errorMsg = 'calcDriverLicenseInfo.checkAge:' + (error && error.message ? error.message : 'System error!');
	}

	return errorMsg;
}
const checkTotalMileage = async function(driverInfo, permitType, allPermitTypes) {
	let result = {errorMsg: "", mileageStr: "0km"};
	try {
        let driverPermitMileages = [];
        /*
        * cl 3 need: cl 3 mileage + cl 4 mileage >= 4000.
        * cl 4 need: driver total >= 4000 and cl 4 mileage >= 2000.
        * cl 2 civilian license cl 2B -> cl 2A -> cl 2
        * others need: permit type total mileage >= 4000.
        */
        let driverTaskPermitMileages = await sequelizeObj.query(`
            SELECT veh.permitType, sum(m.mileageTraveled) as taskMileage
            FROM mileage m
            LEFT JOIN vehicle veh ON m.vehicleNo = veh.vehicleNo
            WHERE m.driverId = ? and m.endMileage IS NOT NULL
            GROUP BY veh.permitType
        `, { replacements: [ driverInfo.driverId ], type: QueryTypes.SELECT });

        let driverBaseMileageStatList = await sequelizeObj.query(`
            SELECT
                dm.permitType, dm.baseMileage
            FROM driver_permittype_detail dm
            where dm.driverId=? ORDER BY dm.permitType asc
        `, { type: QueryTypes.SELECT, replacements: [ driverInfo.driverId ] });

        for (let driverBaseMileageStat of driverBaseMileageStatList) {
            let permitTypeBaseMileage = driverBaseMileageStat.baseMileage ? driverBaseMileageStat.baseMileage : 0;

            let driverPermitTypeTaskMileage = driverTaskPermitMileages.find(item => item.permitType == driverBaseMileageStat.permitType);
            let taskMileage = driverPermitTypeTaskMileage && driverPermitTypeTaskMileage.taskMileage ? driverPermitTypeTaskMileage.taskMileage : 0;

            let permitTypeTotalMileage = permitTypeBaseMileage + taskMileage;
            driverPermitMileages.push({permitType: driverBaseMileageStat.permitType, mileage: permitTypeTotalMileage});
        }
 
        if (driverPermitMileages && driverPermitMileages.length > 0) {
            if (permitType.toLowerCase() == 'cl 3' || permitType.toLowerCase() == 'cl 4') {
                let cl3Mileage = 0;
                let cl4Mileage = 0;
                let mileageStr = '';
                for (let permitMileage of driverPermitMileages) {
                    if (allPermitTypes.includes(permitMileage.permitType.toLowerCase())) {
                        if (permitType.toLowerCase() == 'cl 3') {
                            cl3Mileage += (permitMileage.mileage ? permitMileage.mileage : 0);
                        } else if (permitType.toLowerCase() == 'cl 4') {
                            cl4Mileage += (permitMileage.mileage ? permitMileage.mileage : 0);
                        }

                        mileageStr += permitMileage.permitType.toUpperCase() + ':' + (permitMileage.mileage ? permitMileage.mileage : 0) + ';';
                    }
                }
                result.mileageStr = 'CL 3:' + cl3Mileage + ';CL 4:' + cl4Mileage + ';';
                if (permitType.toLowerCase() == 'cl 3') {
                    if ((cl3Mileage + cl4Mileage) < 4000) {
                        result.errorMsg = `Driver permit[${permitType}] mileage is cl 3:${cl3Mileage}, cl 4: ${cl4Mileage}, less than 4000km!`
                    }
                }
                if (permitType.toLowerCase() == 'cl 4') {
                    if ((cl3Mileage + cl4Mileage) < 4000 || cl4Mileage < 2000) {
                        result.errorMsg = `Driver permit[${permitType}] mileage is cl 3:${cl3Mileage}, , cl 4: ${cl4Mileage}, total less than 4000km or cl4 less than 2000!`
                    }
                }
            } else {
                let perimtMileage = 0;
                let mileageStr = '';
                for (let permitMileage of driverPermitMileages) {
                    if (allPermitTypes.includes(permitMileage.permitType.toLowerCase())) {
                        perimtMileage += (permitMileage.mileage ? permitMileage.mileage : 0);
                        mileageStr += permitMileage.permitType.toUpperCase() + ':' + (permitMileage.mileage ? permitMileage.mileage : 0) + ';';
                    }
                }
                if (perimtMileage < 4000) {
                    result.errorMsg = `Driver permit[${permitType}] mileage is ${perimtMileage}, less than 4000km!`
                }
                result.mileageStr = mileageStr;
            }
        } else {
            result.errorMsg = 'Driver permit mileage is null!'
        }
	} catch (error) {
		log.error(error);
		result.errorMsg = 'calcDriverLicenseInfo.checkEnlistmentDate:' + (error && error.message ? error.message : 'System error!');
	}

	return result;
}
const checkDemeritPoints = async function(driverInfo) {
	let result = {errorMsg: "", demeritPoints: "0km"};
	try {
        //query one years driver demerit points from sos
        let currentDateStr = moment().format('YYYY-MM-DD');
        let oneYearsAgoDateStr = moment().subtract(1, 'year').format('YYYY-MM-DD');

        let driverDemeritPointsObj = await sequelizeObj.query(`
            SELECT sum(demeritPoint) as driverDemeritPoints
            FROM sos
            WHERE driverId = ${driverInfo.driverId} and demeritPoint > 0 and optAt IS NOT NULL and DATE_FORMAT(optAt, '%Y-%m-%d') >= '${oneYearsAgoDateStr}'
        `, { replacements: [], type: QueryTypes.SELECT });
        let driverDemeritPoints = 0;
        if (driverDemeritPointsObj && driverDemeritPointsObj.length > 0) {
            driverDemeritPoints = driverDemeritPointsObj[0].driverDemeritPoints;
        }
        result.demeritPoints = driverDemeritPoints;
        let maxValue = conf.DriverDemeritPoints_MAX_VALUE ?? 8;
        if (driverDemeritPoints > maxValue) {
            result.errorMsg = `DemeritPoints is ${driverDemeritPoints} between ${oneYearsAgoDateStr} and ${currentDateStr}, more than maxValue:${maxValue};`;
        }
	} catch (error) {
		log.error(error);
		result.errorMsg = 'calcDriverLicenseInfo.checkDemeritPoints:' + (error && error.message ? error.message : 'System error!');
	}

	return result;
}

const getDriverMileageStatInfo = async function (driverId) {
    try {
        let permitTypes = new Set();
        let statResult = [];
        // Real-time mileage statistics
		let driverPermitTaskMileageList = await sequelizeObj.query(` 
            SELECT veh.permitType, sum(m.mileageTraveled) as permitMileage
            FROM mileage m
            LEFT JOIN vehicle veh ON m.vehicleNo = veh.vehicleNo
            WHERE m.driverId = ${driverId} and m.endMileage IS NOT NULL 
            GROUP BY veh.permitType
        `, { 
            type: QueryTypes.SELECT, replacements: []
        });
            
        let driverMileageStatList = await sequelizeObj.query(`
            SELECT
                dm.permitType,
                dm.passDate,
                dm.baseMileage
            FROM driver_permittype_detail dm
            where dm.driverId=? AND dm.approveStatus='Approved' ORDER BY dm.permitType asc
        `, { type: QueryTypes.SELECT, replacements: [ driverId ] });
        for (let permitTypeMileage of driverMileageStatList) {
            permitTypes.add(permitTypeMileage.permitType);
        }
        for (let permitType of permitTypes) {
            let driverPermitTypeTaskMileage = driverPermitTaskMileageList.find(item => item.permitType == permitType);
            let driverPermitTypeBaseMileage = driverMileageStatList.find(item => item.permitType == permitType);

            let totalMileage = 0;
            if (driverPermitTypeTaskMileage) {
                totalMileage += driverPermitTypeTaskMileage.permitMileage ? driverPermitTypeTaskMileage.permitMileage : 0;
            }
            if (driverPermitTypeBaseMileage) {
                totalMileage += driverPermitTypeBaseMileage.baseMileage ? driverPermitTypeBaseMileage.baseMileage : 0;
            }

            let permitTypeConf = await PermitType.findOne({ where: { permitType : permitType} });
            if (permitTypeConf && permitTypeConf.parent) {
                let parentPermitType = permitTypeConf.parent;
                let parentMileageObj = statResult.find(item => item.permitType == parentPermitType);
                if (parentMileageObj) {
                    parentMileageObj.totalMileage += totalMileage;
                    continue;
                } else {
                    permitType = parentPermitType;
                    permitTypeConf = await PermitType.findOne({ where: { permitType : permitType} });
                }
            }

            statResult.push({permitType: permitType, totalMileage: totalMileage});
        }
        return statResult;
    } catch (err) {
        log.error(err);
        return [];
    }
}

