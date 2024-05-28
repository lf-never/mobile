module.exports.dbConf = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    connectionLimit: 500
};

// activeMQ config
module.exports.activeMQConf = [process.env.ACTIVEMQ_HOST, process.env.ACTIVEMQ_PORT, '', '', null, { retries: 1000, delay: 10 }];

module.exports.dataPath = process.env.DATA_PATH

module.exports.Calculate_TimeZone = process.env.TIMEZONE; // min, need >= 60
module.exports.Calculate_Block = process.env.BLOCK;

module.exports.RapicAcc = process.env.RAPIC_ACC; // 13.7
module.exports.HardBraking = process.env.HARD_BRAKING; // 10.5

module.exports.DriverORDExpiredHub = process.env.ORDEXPIRED_HUB;

module.exports.DriverDemeritPoints_MAX_VALUE = process.env.DEMERITPOINTS_MAX_VALUE;

module.exports.judgeMissingTime = process.env.MISSINGTIME // ms

module.exports.firebaseServer = process.env.FIREBASE_SERVER

module.exports.proxy = {
    protocol: process.env.PROXY_PROTOCOL,
    host: process.env.PROXY_HOST,
    port: process.env.PROXY_PORT
}