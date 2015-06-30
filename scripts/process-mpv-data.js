/**
 * Script to asynchronously process MPV data to get it into a form that can be
 * used by client scripts. The data is not small and geocoding is required, so 
 * key requirements are fault-tolerance and the ability to resume where it was
 * left off.
 */
var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var geocoder = require('./geocoder');

var items = [];
var queue;
var interval;
var file;
var options = {};


var isItemGeocoded = function(record) {
  return (record.lat && record.lng) || record.geocodeFailed || record.ungeocodable;
};


var geocodeFailed = function(record) {
  return record.geocodeFailed || record.ungeocodable;
};


var isItemComplete = function(record) {
  return isItemGeocoded(record) && record.location;
}


var isItemIncomplete = _.negate(isItemComplete);


var getRemainingItems = function(records) {
  return _.filter(records, isItemIncomplete);
};


var getLocation = function(record) {
  var location = record.address + ', ' + record.city + ', ' + record.state;
  if (!options.excludeZip) {
    location += ' ' + record.zip
  }
  return location;
};


var reportGeocodingItem = function(record) {
  console.log('Attempting geocode for ' + record.name + ' at ' + record.location);
};


var saveItem = function(record) {

};


var worker = function(task, callback) {
  task.location = getLocation(task);
  reportGeocodingItem(task);
  if (task.geocodeFailed) {
    delete task.geocodeFailed;
  }
  if (task.ungeocodable) {
    delete task.ungeocodable;
  }
  geocoder.geocodeString(task.location, function(err, geocode) {
    if (err) {
      console.log('Geocoding for ', task.name, ' failed: ', err);
      task.geocodeFailed = true;
    } else if (!(geocode && geocode.result && geocode.result.geometry)) {
      console.log('Geocoding for ', task.name, ' failed (probably permanently)');
      task.ungeocodable = true;
    } else {
      _.extend(task, geocode.result.geometry);
    }
    saveItem(task);
    callback();
  });
};


var reportProgress = function(records) {
  var complete = _.filter(records, isItemComplete);
  var failed = _.filter(complete, geocodeFailed);
  console.log('progress: ', complete.length / records.length,
              'failure rate: ', failed.length / complete.length);
};

var saveProgress = function() {
  fs.writeFileSync(file, JSON.stringify(items));
  reportProgress(items);
};


var drain = function() {
  console.log('All done!');
  saveProgress();
  clearInterval(interval);
};


var start = function(data, outfile, opts) {
  items = data;
  file = outfile;
  if (opts) {
    options = opts;
  }
  queue = async.queue(worker, 10);
  reportProgress(items);
  var tasks = options.retryFailed ? _.filter(items, geocodeFailed) : getRemainingItems();
  queue.push(tasks);
  interval = setInterval(function() {
    saveProgress(items);
  }, 5000);
  queue.drain = drain;
};

module.exports = start;
