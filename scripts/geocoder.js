var http = require('http');
var async = require('async');
var keys = require('../keys.json');
var _ = require('lodash');

var counter = 0;

var geocodeString = function(locString, cb) { 
  key = keys['opencage'];
  http.get('http://api.opencagedata.com/geocode/v1/json?q=' + locString + '&key=' + key, function(res) {
    var data = '';
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      data = JSON.parse(data);
      var first = _.first(data.results);
      var result = {
        query: locString,
        result: first
      };
      counter += 1;
      cb(null, result);
    });
    res.on('error', function(err) {
      cb(err);
    });
  }).on('error', function(err) {
    cb(err);
  });
};


var geocodeLocations = function(records, cb) {
  async.mapLimit(records, 10, function(record, done) {
    geocodeString(record.location, done);
  }, function(error, results) {
    if (error) {
      console.log(error);
      throw error;
    } else {
      cb(results);
    }
  });
};


var geocodeTheCountedData = function(records, cb) {
  _.each(records, function(record) {
    _.extend(record, {
      location: [record.streetaddress, record.city, record.state].join(', ')
    })
  });
  geocodeLocations(records, function(results) {
    _.each(results, function(geocode, index) {
      record = records[index];
      if (geocode && geocode.result && geocode.result.geometry) {
        _.extend(record, geocode.result.geometry);
      } else {
        console.log('NO RESULT FOR ', record, ' GOT RESPONSE ', geocode);
      }
      console.log(record);
    });
    cb(records);
  });
};

module.exports = {
  geocodeString: geocodeString,
  geocodeLocations: geocodeLocations
};
