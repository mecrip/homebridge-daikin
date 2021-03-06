/*
{
    "bridge": {
    	...
    },

    "description": "...",

    "accessories": [
        {
            "accessory": "Daikin",
            "name": "Daikin Demo",
            "apiroute": "http://myurl.com"
        }
    ],

    "platforms":[]
}

*/

var Service, Characteristic;
var request = require("request");

module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-daikin", "Daikin", Daikin);
};


function Daikin(log, config) {
    this.log = log;
    this.bloccoTimeout=false;

    this.name = config.name;
    this.apiroute = config.apiroute || "apiroute";
    this.log(this.name, this.apiroute);

    this.model = config.model || "HTTP Model";
    this.firmwareRevision = "HTTP Version";

    //Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
    //Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.temperature = 19;
    // this.relativeHumidity = 0.70;
    // The value property of CurrentHeatingCoolingState must be one of the following:
    //Characteristic.CurrentHeatingCoolingState.OFF = 0;
    //Characteristic.CurrentHeatingCoolingState.HEAT = 1;
    //Characteristic.CurrentHeatingCoolingState.COOL = 2;
    this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
    this.targetTemperature = 21;
    // this.targetRelativeHumidity = 0.5;
    // this.heatingThresholdTemperature = 25;
    // this.coolingThresholdTemperature = 18;
    // The value property of TargetHeatingCoolingState must be one of the following:
    //Characteristic.TargetHeatingCoolingState.OFF = 0;
    //Characteristic.TargetHeatingCoolingState.HEAT = 1;
    //Characteristic.TargetHeatingCoolingState.COOL = 2;
    //Characteristic.TargetHeatingCoolingState.AUTO = 3;
    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    
    //true: auto, false: silent
    this.AutoFan=true;
    
    this.getCurrentHeatingCoolingState(function (){});	
    this.ThermostatService = new Service.Thermostat(this.name);
    this.FanAutoSwitchService = new Service.Switch(this.name,"FanAuto")
}

function convertDaikinToJSON(input) {
    // Daikin systems respond with HTTP response strings, not JSON objects. JSON is much easier to
    // parse, so we convert it with some RegExp here.
    var stageOne;
    var stageTwo;

    stageOne = replaceAll(input, "\=", "\":\"");
    stageTwo = replaceAll(stageOne, ",", "\",\"");


    return "{\"" + stageTwo + "\"}";
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\]\")/g, "\\$1");
    // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Using_Special_Characters
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    // From http://stackoverflow.com/a/1144788
}

Daikin.prototype = {

    httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
        request({
            url: url,
            body: body,
            method: method,
            auth: {
                user: username,
                pass: password,
                sendImmediately: sendimmediately
            }
        },
                function(error, response, body) {
            callback(error, response, body);
        });
    },
    //Start
    identify: function(callback) {
        this.log("Identify requested!");
        callback(null);
    },
    
    // Thermostat
	/*
	* return from get_control_info:
	* ret=OK,pow=0,mode=0,adv=,stemp=27.0,shum=0,dt1=27.0,dt2=M,dt3=26.0,dt4=25.0,dt5=25.0,dt7=27.0,dh1=0,dh2=50,dh3=0,dh4=0,dh5=0,dh7=0,dhh=50,b_mode=0,b_stemp=27.0,b_shum=0,alert=255,f_rate=A,f_dir=0,b_f_rate=A,b_f_dir=0,dfr1=A,dfr2=5,dfr3=A,dfr4=5,dfr5=5,dfr6=5,dfr7=A,dfrh=5,dfd1=0,dfd2=0,dfd3=0,dfd4=0,dfd5=0,dfd6=0,dfd7=0,dfdh=0
	*
	*/
    getCurrentHeatingCoolingState: function(callback) {
        this.log("getCurrentHeatingCoolingState from:", this.apiroute+"/aircon/get_control_info");
        request.get({
            url: this.apiroute+"/aircon/get_control_info"
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("getCurrentHeatingCoolingState: response success");
                var json = JSON.parse(convertDaikinToJSON(body)); //{"pow":"1","mode":3,"stemp":"21","shum":"34.10"}
                this.log("Heating state is %s,  pow is %s, fan is %s", json.mode, json.pow, json.f_rate);
                if (json.pow == "0"){					
                    // The Daikin is off
                    this.state = Characteristic.CurrentHeatingCoolingState.OFF;
                    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;					
                } else if (json.pow == "1") {
                    // The Daikin is on
                    switch(json.mode) {
						
                        // Commented cases exist for the Daikin, but not for HomeKit.
                        // Keeping for reference while I try come up with a way to include them
                        /*
                        case "2":
                        this.state = Characteristic.TargetHeatingCoolingState.DRY;
                        break;
                        */
                        case "3":
                            this.state = Characteristic.CurrentHeatingCoolingState.COOL;
                            this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
                            break;

                        case "4":
                            this.state = Characteristic.CurrentHeatingCoolingState.HEAT;
                            this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
                            break;
                            /*
						case "6":
						this.state = Characteristic.TargetHeatingCoolingState.FAN;
						break;
						*/
                        default:
                            this.state = Characteristic.CurrentHeatingCoolingState.AUTO;
                            this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
                            this.log("Auto (if 0, 1 or 5), or not handled case:", json.mode);
                            break;
                                    }
                }				
				if (json.f_rate=="A")
					this.AutoFan=true;
				else
					this.AutoFan=false;
				
                callback(null, this.state); // success
            } else {
                this.log("Error getting state: %s", err);
                callback(err);
            }
        }.bind(this));
    },
	
    getTargetHeatingCoolingState: function(callback) {
        this.log("getTargetHeatingCoolingState:", this.targetHeatingCoolingState);
        var error = null;
        callback(error, this.targetHeatingCoolingState);
    },
	
    setTargetHeatingCoolingState: function(value, callback) {
        var self = this;
        this.log("setTargetHeatingCoolingState from/to:" + this.targetHeatingCoolingState + "/" + value);
        this.targetHeatingCoolingState = value;

        this.log("setTargetHeatingCoolingState: bloccotimeout %s", this.bloccoTimeout);
        if (!this.bloccoTimeout){
            this.bloccoTimeout=true;
            setTimeout(function(){
                self.log("setTargetHeatingCoolingState: setting timeout to command");
                var cBack=self.setDaikinMode();
                callback(cBack);
            },5000);
        }else
            callback(null);
    },
	
    getCurrentTemperature: function(callback) {
        this.log("getCurrentTemperature from:", this.apiroute+"/aircon/get_sensor_info");
        request.get({
            url: this.apiroute+"/aircon/get_sensor_info"
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("response success");
                var json = JSON.parse(convertDaikinToJSON(body)); //{"ret":"OK","htemp":"24.0","hhum""-","otemp":"-","err":"0","cmpfreq":"0"}
                this.log("currently %s degrees", json.htemp);
                this.temperature = parseFloat(json.htemp);
                callback(null, this.temperature); // success
            } else {
                this.log("Error getting state: %s", err);
                callback(err);
            }
        }.bind(this));
    },
	
    getTargetTemperature: function(callback) {
        this.log("getTargetTemperature from:", this.apiroute+"/aircon/get_control_info");
        request.get({
            url: this.apiroute+"/aircon/get_control_info"
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("response success");
                var json = JSON.parse(convertDaikinToJSON(body)); //{"state":"OFF","stateCode":5,"temperature":"18.10","humidity":"34.10"}
                this.targetTemperature = parseFloat(json.stemp);
                this.log("Target temperature is %s", this.targetTemperature);
                callback(null, this.targetTemperature); // success
            } else {
                this.log("Error getting state: %s", err);
                callback(err);
            }
        }.bind(this));
    },
	
    setTargetTemperature: function(value, callback) {
        var self = this;
        this.log("setTargetTemperature to " + value);
        this.targetTemperature = value;
        this.log("setTargetTemperature: bloccotimeout %s", this.bloccoTimeout);

        if (!this.bloccoTimeout){
            this.bloccoTimeout=true;
            setTimeout(function () { 
                self.log("setTargetTemperature: setting timeout to command");
                var cBack=self.setDaikinMode();
                callback(cBack);
            } , 5000);
        }else
            callback(null);
    },
	
    getTemperatureDisplayUnits: function(callback) {
        this.log("getTemperatureDisplayUnits:", this.temperatureDisplayUnits);
        var error = null;
        callback(error, this.temperatureDisplayUnits);
    },
	
    setTemperatureDisplayUnits: function(value, callback) {
        this.log("setTemperatureDisplayUnits from %s to %s", this.temperatureDisplayUnits, value);
        this.temperatureDisplayUnits = value;
        var error = null;
        callback(error);
    },

    // Swith:  on= fan in auto, false= fan in silent
    getOn: function(callback) {
        this.log("getOn:", this.AutoFan);
        var error = null;
        callback(error, this.AutoFan);
    },
	
    setOn: function(value, callback) {
		var self = this;
        this.AutoFan=value;
        this.log("setOn - Set fan mode to auto: %s", this.AutoFan);
		
		if (!this.bloccoTimeout){
            this.bloccoTimeout=true;
            setTimeout(function () { 
                self.log("setOn: setting timeout to command");
                var cBack=self.setDaikinMode();
                callback(cBack);
            } , 5000);
        }else
            callback(null);
    },
    
    
    getName: function(callback) {
        this.log("getName :", this.name);
        var error = null;
        callback(error, this.name);
    },

    getServices: function() {

        // you can OPTIONALLY create an information service if you wish to override
        // the default values for things like serial number, model, etc.
        var informationService = new Service.AccessoryInformation();

        this.getModelInfo();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Daikin")
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision)
            .setCharacteristic(Characteristic.SerialNumber, "HTTP Serial Number");

        // Required Characteristics
        this.ThermostatService
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        this.ThermostatService
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', this.getTargetHeatingCoolingState.bind(this))
            .on('set', this.setTargetHeatingCoolingState.bind(this));

        this.ThermostatService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

        this.ThermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        this.ThermostatService
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this))
            .on('set', this.setTemperatureDisplayUnits.bind(this));

        this.ThermostatService
            .getCharacteristic(Characteristic.Name)
            .on('get', this.getName.bind(this));

        //switch
        this.FanAutoSwitchService
            .getCharacteristic(Characteristic.Name)
            .on('get', this.getName.bind(this));
        
        this.FanAutoSwitchService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));
        
        return [informationService, this.ThermostatService, this.FanAutoSwitchService];
    },

    setDaikinMode: function() {
        // The Daikin doesn't always respond when you only send one parameter, so this is a catchall to send everything at once
        var pow; // 0 or 1
        var mode; // 0, 1, 2, 3, 4, 6 or 7
        var stemp; // Int for degrees in Celcius
        var result;

        this.log("setDaikinMode: resetting bloccoTimeout %s",this.bloccoTimeout);
        this.bloccoTimeout=false;

        // This sets up the Power and Mode parameters
        switch(this.targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                pow = "?pow=0";
                mode = "&mode=0";
                break;

            case Characteristic.TargetHeatingCoolingState.HEAT: //"4"
                pow = "?pow=1";
                mode = "&mode=4";
                break;

            case Characteristic.TargetHeatingCoolingState.AUTO: //"0, 1, 5 or 7"
                pow = "?pow=1";
                mode = "&mode=0";
                break;

            case Characteristic.TargetHeatingCoolingState.COOL: //"3"
                pow = "?pow=1";
                mode = "&mode=3";
                break;

            default:
                pow = "?pow=0";
                mode = "&mode=0";
                this.log("Not handled case:", this.targetHeatingCoolingState);
                break;
		}
		
		var f_rate="&f_rate=3";
		if (this.AutoFan)
			f_rate="&f_rate=A";

        // This sets the Target Temperature parameter
        sTemp = "&stemp=" + this.targetTemperature;

        // Finally, we send the command
        this.log("setDaikinMode: setting pow to " + pow + ", mode to " + mode + ", stemp to " + sTemp + ", f_rate to " + f_rate);
        request.get({
            url: this.apiroute + "/aircon/set_control_info" + pow + mode + sTemp + "&shum=0" + f_rate
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("setDaikinMode: response success");
                result = null; // success
            } else {
                this.log("Error getting state: %s", err);
                result = err;
            }
            //this.log("setDaikinMoode: update stauts after callback");
            //this.getCurrentHeatingCoolingState(function(){});
        }.bind(this));
        return result;
    },

    getModelInfo: function() {
        // A parser for the model details will be coded here, returning the Firmware Revision, and if not set in the config
        // file, the Name and Model as well
        request.get({
            url: this.apiroute+"/aircon/get_model_info"
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("response success");
                var json = JSON.parse(convertDaikinToJSON(body)); //{"pow":"1","mode":3,"stemp":"21","shum":"34.10"}
                this.log("Your Model is: " + json.model);

                if (this.model == "HTTP Model" /*& json.model != "NOTSUPPORT"*/) {
                    this.model = json.model;
                    // this.log("Model: " + json.model + ", " + this.model);
                } // Doesn't yet override original value, working on that later

            } else {
                this.log("Error getting model info: %s", err);
            }
        }.bind(this));

        request.get({
            url: this.apiroute+"/common/basic_info"
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("response success");
                var json = JSON.parse(convertDaikinToJSON(body)); //{"pow":"1","mode":3,"stemp":"21","shum":"34.10"}

                if (this.name == "Default Daikin") {
                    // Need to convert a series of Hexadecimal values to ASCII characters here
                }

                this.firmwareRevision = replaceAll(json.ver, "_", ".");

                this.log("Set firmware version to " + this.firmwareRevision);

            } else {
                this.log("Error getting basic info: %s", err);
            }
        }.bind(this));
    },

    getControlInfo: function() {
        // A parser for the control details from the Daikin will be coded here. It will also record all info returned in
        // the get_control_info calls, so that the plugin behaves a little more like the Daikin app/remote controls,
        // such as remembering each mode's last temperature and reusing it when changing modes
    }
};
