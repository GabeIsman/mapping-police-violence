_ = require('underscore');
d3 = require('d3');

var ViolenceMap = require('./views/violencemap');
var map = new ViolenceMap({
  el: '#map',
  url: 'data/policeviolencemap.json'
});
