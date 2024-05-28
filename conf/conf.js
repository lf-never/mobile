module.exports.dbConf = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306,
    database: 'mobius-driver-jmeter',
    connectionLimit: 500
};

module.exports.dbSystemConf = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306,
    database: 'tms2',
    timezone: 'GMT%2B8',
    multipleStatements: true,
    connectionLimit: 500
};
// activeMQ config
module.exports.activeMQConf = ['192.168.1.5', 61613, '', '', null, { retries: 1000, delay: 10 }];

module.exports.dataPath = "D://data"

module.exports.Calculate_TimeZone = 60; // min, need >= 60
module.exports.Calculate_Block = 50;

module.exports.RapicAcc = 13.7; // 13.7
module.exports.HardBraking = 10.5; // 10.5

module.exports.DriverORDExpiredHub = "hub1";

module.exports.DriverDemeritPoints_MAX_VALUE = 8;

module.exports.judgeMissingTime = 10 * 60 * 1000 // ms

module.exports.firebaseServer = 'http://192.168.1.9:10000'

module.exports.openProxy = false
module.exports.proxy = {
    protocol: 'http',
    host: '10.0.1.14',
    port: 3128
}