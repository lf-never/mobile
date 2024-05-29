/**
 * Client does not support authentication protocol requested by server
 * Please use 'mysql_native_password' instead of 'caching_sha2_password'
 */
module.exports.dbConf = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306,
    database: 'mobius-driver',
    timezone: 'GMT%2B8',
    multipleStatements: true,
    connectionLimit: 1000
};

module.exports.dbSystemConf = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306,
    database: 'tms2',
    timezone: 'GMT%2B8',
    multipleStatements: true,
    connectionLimit: 1000
};

module.exports.dbPositionConf = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306,
    database: 'mobius-driver-position',
    timezone: 'GMT%2B8',
    multipleStatements: true,
    connectionLimit: 100
};

module.exports.LatestAPKVersion = '3.2';
module.exports.LatestIOSVersion = '2.0';

module.exports.firebaseServer = 'http://localhost:10000'

module.exports.GPS_Missing_Time = 1; // min

module.exports.Stop_Upload_Position_Time = 30; // min

module.exports.mobileServerPort = 5100;

module.exports.Weather_Forecast_API = `https://api.data.gov.sg/v1/environment/2-hour-weather-forecast`;
module.exports.Weather_Forecast_Label = {
    "W1": 'Today is a good day!',
    "W2": 'Drive slowly and avoid heavy braking',
}

module.exports.Training_LimitDays = 10;
module.exports.mmpk_path = 'd://Singapore.mmpk';

module.exports.GPS_FILE_PATH = 'd://mobileGps';

// module.exports.URL_Of_3rd_List = {
//     GetTOIndents: `http://192.168.1.9:5001/mobileTO/getTOIndents`,
//     StartTask: `http://192.168.1.9:5001/mobileTO/startTask`,
//     EndTask: `http://192.168.1.9:5001/mobileTO/endTask`,
// }

module.exports.SgidClient = {
    SCOPES: process.env.SCOPES,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    HOSTNAME: process.env.HOSTNAME,
    REDIRECT_URL: process.env.REDIRECT_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    PUBLIC_KEY: process.env.PUBLIC_KEY,
}

module.exports.sosContactNumber = 6597568743;

module.exports.mobileGuidePageUrl = "https://mv.mobius.sg/guide";

// module.exports.mobileBaseUrl = "https://mv.mobius.sg:5100";
module.exports.mobileBaseUrl = "http://localhost:5100";

module.exports.reportLateReasonMinutes = 60;

module.exports.ekey_press_server_url = 'http://localhost:57181/';

module.exports.THIRD_PART_CHECKLIST_USERNAME = 'mobius_test';

module.exports.THIRD_PART_CHECKLIST_PASSWORD = 'P@ssw0rd2024';