'use strict';

var fs = require('fs');
var path = require('path');
var rp = require('request-promise');
var clone = require('clone');
var Q = require('q');
var equals = require('deep-equal');

var POLL_INTERVAL = 60 * 1000;

var serverURL = 'https://gamesdonequick.com/tracker/search';

module.exports = function (nodecg) {
    var checklist = require('./checklist')(nodecg);
    var scheduleRep = nodecg.Replicant('schedule', {defaultValue: [], persistent: false});
    var currentRun = nodecg.Replicant('currentRun', {defaultValue: {}});

    // Get initial data
    update();

    // Get latest schedule data every POLL_INTERVAL milliseconds
    nodecg.log.info('Polling schedule every %d seconds...', POLL_INTERVAL / 1000);
    var updateInterval = setInterval(update.bind(this), POLL_INTERVAL);

    // Dashboard can invoke manual updates
    nodecg.listenFor('updateSchedule', function(data, cb) {
        nodecg.log.info('Manual schedule update button pressed, invoking update...');
        clearInterval(updateInterval);
        updateInterval = setInterval(update.bind(this), POLL_INTERVAL);
        update()
            .then(function (updated) {
                if (updated) {
                    nodecg.log.info('Schedule successfully updated');
                } else {
                    nodecg.log.info('Schedule unchanged, not updated');
                }

                cb(null, updated);
            }, function (error) {
                cb(error);
            });
    });

    nodecg.listenFor('nextRun', function(cb) {
        var nextIndex = currentRun.value.nextRun.order - 1;
        _setCurrentRun(scheduleRep.value[nextIndex]);
        checklist.reset();

        if (typeof cb === 'function') {
            cb();
        }
    });

    nodecg.listenFor('previousRun', function(cb) {
        var prevIndex = currentRun.value.order - 2;
        _setCurrentRun(scheduleRep.value[prevIndex]);
        checklist.reset();

        if (typeof cb === 'function') {
            cb();
        }
    });

    nodecg.listenFor('setCurrentRunByOrder', function(order, cb) {
        _setCurrentRun(scheduleRep.value[order - 1]);

        if (typeof cb === 'function') {
            cb();
        }
    });

    function update() {
        var deferred = Q.defer();

        //Removed RunnerPromise
        var schedulePromise = rp({
            uri: serverURL,
            qs: {
                type: 'run',
                event: 17
            },
            json: true
        });

        //Removed RunnerJSON, and all info using it.
        //Also removed a lot of download fields
        return Q.spread([schedulePromise], function(scheduleJSON) {
            /* jshint -W106 */
            var formattedSchedule = scheduleJSON.map(function(event) {
              //Kasper: Fucked around with this. I think It always loads from drive.
                var boxartUrl = path.resolve(__dirname, '../graphics/img/boxart/default.jpg';
                var boxartName = new Buffer(event.fields.display_name).toString('base64');
                var boxartPath = path.resolve(__dirname, '../graphics/img/boxart/', boxartName +'.jpg');

                if (fs.existsSync(boxartPath)) {
                    boxartUrl = path.resolve(__dirname, '../graphics/img/boxart/', boxartName +'.jpg');
                }

                return {
                    name: event.fields.display_name || 'Unknown',
                    commentators: event.fields.commentators || 'Unknown',
                    roles:"Unknown",

                    console: event.fields.console || 'Unknown',
                    category: event.fields.category || 'Any%',
                    startTime: Date.parse(event.fields.starttime) || null,
                    order: event.fields.order,
                    runners: event.fields.runners,
                    boxart: {
                        url: boxartUrl
                    },
                    type: 'run'
                };
            });
            /* jshint +W106 */

            // If nothing has changed, return.
            if (equals(formattedSchedule, scheduleRep.value)) {
                deferred.resolve(false);
                return;
            }

            scheduleRep.value = formattedSchedule;

            // If no currentRun is set or if the order of the current run is greater than
            // the length of the schedule, set current run to the first run.
            if (typeof(currentRun.value.order) === 'undefined'
                || currentRun.value.order > scheduleRep.value.length) {

                _setCurrentRun(scheduleRep.value[0]);
            }

        }).catch(function(err) {
            nodecg.log.error('[schedule] Failed to update:', err.stack);
        });
    }

    function _setCurrentRun(run) {
        var cr = clone(run);

        // `order` is always `index+1`. So, if there is another run in the schedule after this one, add it as `nextRun`.
        if (scheduleRep.value[cr.order]) {
            cr.nextRun = scheduleRep.value[cr.order];
        }

        currentRun.value = cr;
    }
};
