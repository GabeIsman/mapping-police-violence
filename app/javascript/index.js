_ = require('underscore');
d3 = require('d3');
$ = jQuery = require('jquery');
Backbone = require('backbone');
require('bootstrap');

var Demographics = require('./views/control-panel');
var demographics = new Demographics({
  el: '#control-panel'
});

var ViolenceMap = require('./views/violencemap');
var map = new ViolenceMap({
  el: '#map',
  url: 'data/policeviolencemap.json'
});
