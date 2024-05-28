const { DataTypes } = require('sequelize');
const dbConf = require('../sequelize/dbConf');

module.exports.MobileOffenceHistory = dbConf.sequelizeObj.define('mobileOffenceHistory', {
    id: {
        type: DataTypes.INTEGER, 
        primaryKey: true,
    },
	userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    vehicleNo: {
        type: DataTypes.STRING(45),
        allowNull: false,
    },
    lat: {
        type: DataTypes.FLOAT(13, 10),
		defaultValue: 0
    },
    lng: {
        type: DataTypes.FLOAT(13, 10),
		defaultValue: 0
    },
	speed: {
        type: DataTypes.FLOAT,
		defaultValue: 0
    },
    rpm: {
        type: DataTypes.FLOAT,
		defaultValue: 0
    },
    createdAt: {
        type: DataTypes.DATE,
		defaultValue: DataTypes.NOW
    }
  }, {
      // other options
      tableName: 'mobile_offence_history',
      timestamps: false,
      indexes: [
          {
              name: 'index_of_userId_createdAt',
              fields: ['userId', 'createdAt']
          }
      ],
    }
);
