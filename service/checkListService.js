require('../log/winston').initLogger();
const log = require('../log/winston').logger('Driver Service');
const utils = require('../util/utils');
const conf = require('../conf/conf');

const axios = require('axios');
const moment = require('moment');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')

const { OperationRecord } = require('../model/operationRecord');
const { CheckListQuestion } = require('../model/checkListQuestion');

const the3rdAccount = {
    "username": "mobius_test",
    "password": "P@ssw0rd2024"
}
const URL_List = {
    apiToken: 'https://ebos.labhostio.com/api/token/',
    getCheckList: 'https://ebos.labhostio.com/checklist/get_latest_checklist_by_sku_name/',
    viewCheckList: 'https://ebos.labhostio.com/checklist/get_questions_by_checklist_view/',
}
const SKU_NAME_LIST = [ 'MUV Amb', 'Ambulance Combat Ambulance (AOA)', 'F550 Combat Ambulance' ]

module.exports = {
    login3rd: async function (operator) {
        log.info(`Mobile user ${ operator.id } try login 3rd system.`)
        await OperationRecord.create({
            operatorId: operator.id,
            operatorType: 'mv',
            businessType: 'login ebos.labhostio.com',
            businessId: 'mobile',
            optType: '3rd login',
            beforeData: JSON.stringify(the3rdAccount),
            optTime: moment().format('YYYY-MM-DD HH:mm:ss')
        })
        let result = await axios.post(URL_List.apiToken, the3rdAccount).catch(error => {
            if (error.response) {
                return {
                    status: error.response.status,
                    data: error.response.data
                }
            } else if (error.request) {
                return {
                    data: error.request
                }
            } else {
                return {
                    data: error.message
                }
            }
        })
        if (result.status == 200) {
            log.info(`Mobile user ${ operator.id } login 3rd system success: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'login ebos.labhostio.com',
                businessId: 'mobile',
                optType: '3rd login',
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return result.data
        } else {
            log.info(`Mobile user ${ operator.id } login 3rd system failed: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'login ebos.labhostio.com',
                businessId: 'mobile',
                optType: '3rd login',
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return null
        }
    },
    getCheckList: async function (operator, skuName, token) {
        await OperationRecord.create({
            operatorId: operator.id,
            operatorType: 'mv',
            businessType: 'getCheckList',
            businessId: 'mobile',
            optType: 'getCheckList info by name',
            beforeData: skuName,
            optTime: moment().format('YYYY-MM-DD HH:mm:ss')
        })
        log.info(`Mobile user ${ operator.id } try getCheckList(skuName: ${ skuName })`)
        let result = await axios.post(URL_List.getCheckList, { 
            skuName: skuName 
        }, { 
            headers: { 
                'X-CSRFToken': 'UxKEwHnbxJ6GROzaO8S3r6rc3ENPZxjjucIPVxn1WMSf7gTcnpfKkXSthOnTmjjW',
                accept: 'application/json',
                'Content-Type': 'application/json',
            } 
        }).catch(error => {
            if (error.response) {
                return {
                    status: error.response.status,
                    data: error.response.data
                }
            } else if (error.request) {
                return {
                    data: error.request
                }
            } else {
                return {
                    data: error.message
                }
            }
        })
        if (result.data.status == 200 && result.data?.success) {
            log.info(`Mobile user ${ operator.id } getCheckList success: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'getCheckList',
                businessId: 'mobile',
                optType: 'getCheckList info by name',
                beforeData: skuName,
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return result.data.data
        } else {
            log.info(`Mobile user ${ operator.id } getCheckList failed: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'getCheckList',
                businessId: 'mobile',
                optType: 'getCheckList info by name',
                beforeData: skuName,
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return null
        }
    },
    viewCheckList: async function (operator, checkListId, token) {
        await OperationRecord.create({
            operatorId: operator.id,
            operatorType: 'mv',
            businessType: 'viewCheckList',
            businessId: 'mobile',
            optType: 'viewCheckList by checklist id',
            beforeData: JSON.stringify(checkListId),
            optTime: moment().format('YYYY-MM-DD HH:mm:ss')
        })
        log.info(`Mobile user ${ operator.id } try viewCheckList(checklistId: ${ checkListId })`)
        let result = await axios.post(URL_List.viewCheckList, { checklist_id: checkListId }).catch(error => {
            if (error.response) {
                return {
                    status: error.response.status,
                    data: error.response.data
                }
            } else if (error.request) {
                return {
                    data: error.request
                }
            } else {
                return {
                    data: error.message
                }
            }
        })
        if (result.data.status == 200 && result.data?.success) {
            log.info(`Mobile user ${ operator.id } viewCheckList success: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'viewCheckList',
                businessId: 'mobile',
                optType: 'viewCheckList by checklist id',
                beforeData: checkListId,
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return result.data.data
        } else {
            log.info(`Mobile user ${ operator.id } viewCheckList failed: ${ JSON.stringify(result.data) }`)
            await OperationRecord.create({
                operatorId: operator.id,
                operatorType: 'mv',
                businessType: 'viewCheckList',
                businessId: 'mobile',
                optType: 'viewCheckList by checklist id',
                beforeData: checkListId,
                afterData: JSON.stringify(result.data),
                optTime: moment().format('YYYY-MM-DD HH:mm:ss')
            })
            return null
        }
    },
    initCheckListQuestion: async function (operator) {
        // { 
        //     "refresh": "...", 
        //     "access": "..." 
        // }
        let token = await this.login3rd(operator);
        if (!token) return;
        for (let skuName of SKU_NAME_LIST) {
            // {
            //     "checklist_id": 15,
            //     "checklist_version": 2.11,
            //     "service_sku": "MUV Amb"
            // }
            let checkListInfo = await this.getCheckList(operator, skuName, token)
            // [
            //     {
            //       "id": 10,
            //       "text": "Check all wheel nuts are intact and for any physical damage",
            //       "system": "BEFORE OPS CHECK",
            //       "classification": "MIN",
            //       "type_of_check": "Physical checks",
            //       "system_remarks": "None",
            //       "checklist_type": "TRANSPORT OPERATOR BOS & ODD CHECKLIST"
            //     },
            //     {
            //       "id": 11,
            //       "text": "Check on damages to vehicle exterior and interior. Check vehicle bodywork for any cracks and damages.",
            //       "system": "NA",
            //       "classification": "MAJ",
            //       "type_of_check": "Physical checks",
            //       "system_remarks": "None",
            //       "checklist_type": "EDIT"
            //     }
            // ]
            if (!checkListInfo) continue; 
            let questionList = await this.viewCheckList(operator, checkListInfo.checklist_id, token)
            if (!questionList?.length) continue;
            let checkListQuestionList = []
            for (let question of questionList) {
                checkListQuestionList.push({
                    checkListId: checkListInfo.checklist_id,
                    version: checkListInfo.checklist_version,
                    checkListName: checkListInfo.service_sku,
                    questionId: question.id,
                    text: question.text,
                    system: question.system,
                    classification: question.classification,
                    typeOfCheck: question.type_of_check,
                    systemRemarks: question.system_remarks,
                    checkListType: question.checklist_type,
                })
            }
            if (questionList.length) {
                await CheckListQuestion.bulkCreate(questionList)
            }
        }
        
    },

}
