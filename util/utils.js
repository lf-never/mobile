const log = require('../log/winston').logger('utils');
const moment = require('moment');
const jsonfile = require('jsonfile')

module.exports.validateNRIC = function (nric) {
    if(typeof nric === "undefined" || nric === '' || nric === 'NULL' || null === nric) return false;
    let weights = [2,7,6,5,4,3,2];
    let alphabet = ["A","B","C","D","E","F","G","H","I","Z","J"];
    let strNric = nric.split('');
    if (typeof nric !== "string") return false;
    if(strNric.length !== 9) return false;
    if(strNric[0] !== "S" && strNric[0] !== "T" && strNric[0] !== "F" && strNric[0] !== "G") return false;
    let weightVal = weights[0]*strNric[1]+weights[1]*strNric[2]+weights[2]*strNric[3]+weights[3]*strNric[4]
        +weights[4]*strNric[5]+weights[5]*strNric[6]+weights[6]*strNric[7];
    let offset = (strNric[0] === "T" || strNric[0] === "G") ? 4:0;
    let val = 11 - (offset + weightVal)%11;
    return strNric[8] === alphabet[val - 1];
};

module.exports.pointDistance = function (lat, lng, x, y) {
    let dx = lng - x;
    let dy = lat - y;
    return dx*dx + dy*dy;
};

module.exports.wait = async function (time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
};

module.exports.isTimeOverlap = function (startTime1, endTime1, startTime2, endTime2) {
    if (startTime1 >= endTime2 || startTime2 >= endTime1) {
        return false;
    } else {
        return true;
    }
}

module.exports.getSingaporePublicHolidaysInFile = async function () {
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
    } catch (ex) {
        log.error(ex)
        return []
    }
}

/**
 * get month rest days
 * @param {*} monthStr eg:2023-12
 * @returns [......,'2023-12-07', '2023-12-08', '2023-12-11',.......]
 */
module.exports.getMonthRestdays = async function(monthStr) {
    let restdays = [];
    if (!monthStr) {
        return restdays;
    }
    let monthStartDay = moment(monthStr+'-01', 'YYYY-MM-DD').format('YYYY-MM-DD');
    let monthEndDay=moment(monthStr+'-01', 'YYYY-MM-DD').add(1, 'months').add(-1, 'days').format('YYYY-MM-DD');

    let holidayList = await this.getSingaporePublicHolidaysInFile();
    let currentDate = moment(monthStartDay);
    while (currentDate.isSameOrBefore(moment(monthEndDay))) {
        if(currentDate.format('E') == 6 || currentDate.format('E') == 7 || holidayList.indexOf(moment(currentDate).format('YYYY-MM-DD')) != -1) {
            restdays.push(currentDate.format('YYYY-MM-DD'));
        }
        currentDate = currentDate.add(1, 'day');
    }
    return restdays;
}

