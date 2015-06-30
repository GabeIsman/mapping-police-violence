_ = require('underscore');
d3 = require('d3');

var ViolenceTileMap = require('./views/violencetilemap');
var map = new ViolenceTileMap({
  el: '#map',
  url: 'data/policeviolencemap.json'
});
