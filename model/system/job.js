const { DataTypes } = require('sequelize');
const dbConf = require('../../db/dbConf_system');

module.exports.Job = dbConf.sequelizeSystemObj.define('job', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    requestId: {
        type: DataTypes.STRING(11),
    },
    tripNo: {
        type: DataTypes.STRING(25),
    },
    instanceId: {
        type: DataTypes.STRING(100),
    },
    contractPartNo: {
        type: DataTypes.STRING(100),
    },
    serviceProviderId: {
        type: DataTypes.STRING(4),
    },
    driver: {
        type: DataTypes.BOOLEAN,
    },
    status: {
        type: DataTypes.STRING(60),
    },
    pickupDestination: {
        type: DataTypes.STRING(200),
    },
    pickupNotes: {
        type: DataTypes.STRING(200),
    },
    dropoffDestination: {
        type: DataTypes.STRING(200),
    },
    dropoffNotes: {
        type: DataTypes.STRING(200),
    },
    vehicleType: {
        type: DataTypes.STRING(200),
    },
    noOfVehicle: {
        type: DataTypes.STRING(10),
    },
    noOfDriver: {
        type: DataTypes.STRING(10),
    },
    poc: {
        type: DataTypes.STRING(200),
    },
    pocNumber: {
        type: DataTypes.STRING(12),
    },
    repeats: {
        type: DataTypes.STRING(10),
    },
    executionDate: {
        type: DataTypes.STRING(10),
    },
    executionTime: {
        type: DataTypes.STRING(10),
    },
    periodStartDate: {
        type: DataTypes.STRING(20),
    },
    periodEndDate: {
        type: DataTypes.STRING(20),
    },
    startsOn: {
        type: DataTypes.STRING(20),
    },
    endsOn: {
        type: DataTypes.STRING(20),
    },
    repeatsOn: {
        type: DataTypes.STRING(20),
    },
    duration: {
        type: DataTypes.STRING(5),
    },
    endorse: {
        type: DataTypes.BOOLEAN,
    },
    approve: {
        type: DataTypes.BOOLEAN,
    },
    isImport: {
        type: DataTypes.BOOLEAN,
    },
    completeCount: {
        type: DataTypes.INTEGER,
    },
    tripRemarks: {
        type: DataTypes.STRING(1100),
    },
    // serviceMode: {
    //     type: DataTypes.STRING(100),
    // },
    // serviceType: {
    //     type: DataTypes.STRING(100),
    // },
    // purposeType: {
    //     type: DataTypes.STRING(100),
    // },
    // groupId: {
    //     type: DataTypes.BIGINT,
    // },
    createdBy: {
        type: DataTypes.BIGINT,
    },
    serviceModeId: {
        type: DataTypes.BIGINT,
    },
    serviceTypeId: {
        type: DataTypes.BIGINT,
    },
    reEdit: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
});


module.exports.JobHistory = dbConf.sequelizeSystemObj.define('job_history', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    jobId: {
        type: DataTypes.BIGINT,
    },
    requestId: {
        type: DataTypes.STRING(11),
    },
    tripNo: {
        type: DataTypes.STRING(25),
    },
    instanceId: {
        type: DataTypes.STRING(100),
    },
    contractPartNo: {
        type: DataTypes.STRING(100),
    },
    serviceProviderId: {
        type: DataTypes.STRING(4),
    },
    driver: {
        type: DataTypes.BOOLEAN,
    },
    status: {
        type: DataTypes.STRING(60),
    },
    pickupDestination: {
        type: DataTypes.STRING(200),
    },
    pickupNotes: {
        type: DataTypes.STRING(200),
    },
    dropoffDestination: {
        type: DataTypes.STRING(200),
    },
    dropoffNotes: {
        type: DataTypes.STRING(200),
    },
    vehicleType: {
        type: DataTypes.STRING(200),
    },
    noOfVehicle: {
        type: DataTypes.STRING(10),
    },
    noOfDriver: {
        type: DataTypes.STRING(10),
    },
    poc: {
        type: DataTypes.STRING(200),
    },
    pocNumber: {
        type: DataTypes.STRING(12),
    },
    repeats: {
        type: DataTypes.STRING(10),
    },
    executionDate: {
        type: DataTypes.STRING(10),
    },
    executionTime: {
        type: DataTypes.STRING(10),
    },
    periodStartDate: {
        type: DataTypes.STRING(20),
    },
    periodEndDate: {
        type: DataTypes.STRING(20),
    },
    startsOn: {
        type: DataTypes.STRING(20),
    },
    endsOn: {
        type: DataTypes.STRING(20),
    },
    repeatsOn: {
        type: DataTypes.STRING(20),
    },
    duration: {
        type: DataTypes.STRING(5),
    },
    endorse: {
        type: DataTypes.BOOLEAN,
    },
    approve: {
        type: DataTypes.BOOLEAN,
    },
    isImport: {
        type: DataTypes.BOOLEAN,
    },
    completeCount: {
        type: DataTypes.INTEGER,
    },
    tripRemarks: {
        type: DataTypes.STRING(1100),
    },
    // serviceMode: {
    //     type: DataTypes.STRING(100),
    // },
    // serviceType: {
    //     type: DataTypes.STRING(100),
    // },
    // purposeType: {
    //     type: DataTypes.STRING(100),
    // },
    // groupId: {
    //     type: DataTypes.BIGINT,
    // },
    createdBy: {
        type: DataTypes.BIGINT,
    },
    serviceModeId: {
        type: DataTypes.BIGINT,
    },
    serviceTypeId: {
        type: DataTypes.BIGINT,
    },
    reEdit: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
});

module.exports.OperationHistory = dbConf.sequelizeSystemObj.define('operation_history', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    requestId: {
        type: DataTypes.STRING(11),
    },
    tripId: {
        type: DataTypes.BIGINT,
    },
    taskId: {
        type: DataTypes.BIGINT,
    },
    operatorId: {
        type: DataTypes.BIGINT,
    },
    status: {
        type: DataTypes.STRING(100),
    },
    action: {
        type: DataTypes.STRING(50),
    },
    remark: {
        type: DataTypes.STRING(1100),
    },
}, {
    timestamps: true,
    updatedAt: false,
});