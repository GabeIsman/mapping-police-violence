var topojson = require('topojson');
var colorbrewer = require('../lib/colors/colorbrewer');
var controlPanelTemplate = require('../templates/control-panel.jade');

/**
 * @param {Object} options Hash should contain a selector that picks out an
 *     element that the map should be rendered into.
 */
var ViolenceTileMap = function(options) {
  if (!options || !options.el) {
    throw new Error('Must pass a selector when initializing a ViolenceTileMap.');
  }
  this.el = d3.select(options.el);

  if (!options.url) {
    throw new Error('Must pass a url when initializing an ViolenceTileMap');
  }

  d3.json(options.url, _.bind(this.handleFetch, this));
  this.renderMap();
};


/**
 * Updates the size and path to reflect the new size. If the data is loaded, re-
 * renders the map.
 */
ViolenceTileMap.prototype.handleResize = function() {
  var boundingRect = this.el.node().getBoundingClientRect();
  this.width = boundingRect.width;
  this.height = boundingRect.height;
};


/**
 * Handles the response the data fetch.
 *
 * @param  {Object} err
 * @param  {Object} data
 */
ViolenceTileMap.prototype.handleFetch = function(err, data) {
  // If something bad happened abort and hide the widget.
  if (err) {
    console.log(err);
    this.el.style.display = 'none';
    return;
  }

  this.data = data;
  this.filterData();
  this.renderData();
};


/**
 * Renders the map.
 */
ViolenceTileMap.prototype.renderMap = function() {
  this.mapEl = this.el.append("div")
    .attr("id", "violence-tile-map-container");
  var layer = new L.StamenTileLayer("toner");
  this.map = new L.Map("violence-tile-map-container", {
      center: new L.LatLng(37.8282, -96.5795),
      zoom: 5
  });
  this.map.addLayer(layer);
};

ViolenceTileMap.prototype.renderData = function() {
  _.each(this.data.killings, function(d) {
    L.circle([d.lat, d.lng], 300, {
      color: '#F33',
      fillColor: '#F33',
      fillOpacity: 0.5,
    }).addTo(this.map);
  }, this);
};


/**
 * Constructs the legend and appends it to the map.
 */
ViolenceTileMap.prototype.renderControlPanel = function() {
  this.el.html(controlPanelTemplate());

  this.el.selectAll('.legend-control')
    .on('click', getHandler(this.handleLegendClick, this));
};


ViolenceTileMap.prototype.handleLegendClick = function(target, d) {
  var target = d3.select(target);
  var type = slugify(target.attr('type'));
  var prisons = d3.selectAll('.' + type);
  if (target.classed('active')) {
    target.classed('active', false);
    prisons.style('visibility', 'hidden');
  } else {
    target.classed('active', true);
    prisons.style('visibility', 'visible');
  }
};


ViolenceTileMap.prototype.filterData = function() {
  this.data.killings = _.filter(this.data.killings, function(d) {
    return d.lat && d.lng;
  }, this);
};


/**
 * Converts a color into the range of numbers that it represents.
 *
 * @param  {Object} scale The D3 scale on which to convert
 * @param  {Object} value An object in the range of the scale
 * @return {String}
 */
function getLabel(scale, value) {
  var domain = scale.invertExtent(value);
  return Math.ceil(domain[0] + 1) + " - " + Math.floor(domain[1]);
}

module.exports = ViolenceTileMap;



