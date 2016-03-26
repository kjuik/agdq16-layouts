'use strict';

var timerStartTime = new Date();
var timerStopTime = new Date();
var POLL_INTERVAL = 1000;

var util = require('util');
var Q = require('q');
var request = require('request');
var numeral = require('numeral');

var updateInterval;

module.exports = function(nodecg) {
	var jamTimer = nodecg.Replicant('jamTimer', {
		defaultValue: {
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
		}
	});

	//the UTC time the jam starts
	timerStartTime.setUTCFullYear(2016);
	//Month starts from zero. FFS!
	timerStartTime.setUTCMonth(2);
	timerStartTime.setUTCDate(25);
	//Remember our time -1 hour
	timerStartTime.setUTCHours(1);
	//the UTC time the jam ends
	timerStopTime.setUTCFullYear(2016);
	//Month starts from zero. FFS!
	timerStopTime.setUTCMonth(2);
	timerStopTime.setUTCDate(26);
	//Remember our time -1 hour
	timerStopTime.setUTCHours(0);
	timerStopTime.setUTCMinutes(36);

	var autoUpdateJamTimer = nodecg.Replicant('autoUpdateJamTimer', {
		defaultValue: true
	});
	autoUpdateJamTimer.on('change', function(oldVal, newVal) {
		if (newVal) {
			nodecg.log.info('Automatic updating of jam timer enabled');
			updateJamTimer();
		} else {
			nodecg.log.warn('Automatic updating of jam timer DISABLED');
			clearInterval(updateInterval);
		}
	});

	// Get initial data
	update();

	if (autoUpdateJamTimer.value) {
		// Get latest prize data every POLL_INTERVAL milliseconds
		nodecg.log.info('Polling jam timer every %d seconds...', POLL_INTERVAL / 1000);
		clearInterval(updateInterval);
		updateInterval = setInterval(update, POLL_INTERVAL);
	} else {
		nodecg.log.info('Automatic update of jam timer is disabled, will not poll until enabled');
	}

	// Dashboard can invoke manual updates
	nodecg.listenFor('updateJamTimer', updateJamTimer);

	function updateJamTimer() {
		clearInterval(updateInterval);
		updateInterval = setInterval(update, POLL_INTERVAL);
		update();
		/*    .then(function (updated) {
		        if (updated) {
		            nodecg.log.info('Donation jam timer successfully updated');
		        } else {
		            nodecg.log.info('Donation jam timer unchanged, not updated');
		        }

		        cb(null, updated);
		    }, function (error) {
		        cb(error);
		    });*/
	}

	function update() {
		var beforeJam = false;
		var afterJam = false;
		if (Date.now() > timerStartTime.valueOf()) {
			if (Date.now() < timerStopTime.valueOf()) {
				var timeLeft = timerStopTime.valueOf() - Date.now();
				//to seconds, to minutes, to hours, to days.
				var daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
				timeLeft -= daysLeft * 1000 * 60 * 60 * 24;
				//to seconds, to minutes, to hours.
				var hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
				timeLeft -= hoursLeft * 1000 * 60 * 60;
				//to seconds, to minutes.
				var minutesLeft = Math.floor(timeLeft / (1000 * 60));
				timeLeft -= minutesLeft * 1000 * 60;
				//to seconds, to minutes.
				var secondsLeft = Math.floor(timeLeft / (1000));
				timeLeft -= secondsLeft * 1000;

				jamTimer.value = {
					days: daysLeft,
					hours: hoursLeft,
					minutes: minutesLeft,
					seconds: secondsLeft,
				};
			}
			else {
				afterJam = true;
			}
		}
		else {
			beforeJam = true;
		}

		if (beforeJam) {
			var timeLeft = timerStopTime.valueOf() - timerStartTime.valueOf();
			//to seconds, to minutes, to hours, to days.
			var daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
			timeLeft -= daysLeft * 1000 * 60 * 60 * 24;
			//to seconds, to minutes, to hours.
			var hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
			timeLeft -= hoursLeft * 1000 * 60 * 60;
			//to seconds, to minutes.
			var minutesLeft = Math.floor(timeLeft / (1000 * 60));
			timeLeft -= minutesLeft * 1000 * 60;
			//to seconds, to minutes.
			var secondsLeft = Math.floor(timeLeft / (1000));
			timeLeft -= secondsLeft * 1000;

			jamTimer.value = {
				days: daysLeft,
				hours: hoursLeft,
				minutes: minutesLeft,
				seconds: secondsLeft,
			};
		}
		else if(afterJam){
			jamTimer.value = {
				days: 0,
				hours: 0,
				minutes: 0,
				seconds: 0,
			};
		}

		/*
		var deferred = Q.defer();
		request(DONATION_STATS_URL, function (error, response, body) {
		    if (!error && response.statusCode === 200) {
		        var stats;

		        try {
		            stats = JSON.parse(body);
		        } catch(e) {
		            nodecg.log.error('Could not parse jam timer, response not valid JSON:\n\t', body);
		            return;
		        }

		        var freshTotal = parseFloat(stats.agg.amount || 0);

		        if (freshTotal !== jamTimer.value.raw) {
		            jamTimer.value = {
		                raw: freshTotal,
		                formatted: numeral(freshTotal).format('$0,0')
		            };
		            deferred.resolve(true);
		        } else {
		            deferred.resolve(false);
		        }
		    } else {
		        var msg = 'Could not get jam timer, unknown error';
		        if (error) msg = util.format('Could not get jam timer:', error.message);
		        else if (response) msg = util.format('Could not get jam timer, response code %d',
		            response.statusCode);
		        nodecg.log.error(msg);
		        deferred.reject(msg);
		    }
		});
		return deferred.promise;*/
	}
};
