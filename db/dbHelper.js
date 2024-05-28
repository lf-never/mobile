const log = require('../log/winston').logger('DB Init');

const { Track } = require('../model/event/track');
const { TrackHistory } = require('../model/event/trackHistory');

const { DevicePositionHistory } = require('../model/event/devicePositionHistory');
const { DeviceOffenceHistory } = require('../model/event/deviceOffenceHistory');
const { DriverPositionHistory } = require('../model/event/driverPositionHistory');
const { DriverOffenceHistory } = require('../model/event/driverOffenceHistory');

const { CompareResult } = require('../model/compareResult');

const { Device } = require('../model/device');
const { Driver } = require('../model/driver');

try {
	// log.info('(dbHelper):  Will init DB here!');
	// Device.sync({ alter: true });
	// DevicePositionHistory.sync({ alter: true });
	// DeviceOffenceHistory.sync({ alter: true });
	
	// Track.sync({ alter: true });
	// TrackHistory.sync({ alter: true });
	// CompareResult.sync({ alter: true });
	
    // Driver.sync({ alter: true });
	// DriverPositionHistory.sync({ alter: true });
	// DriverOffenceHistory.sync({ alter: true });
	
	// TODO: maybe init data into db here!
	// ...
} catch (error) {
	console.error(error)
}
