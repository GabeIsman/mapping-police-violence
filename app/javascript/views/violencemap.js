var topojson = require('topojson');
var colorbrewer = require('../lib/colors/colorbrewer');
var controlPanelTemplate = require('../templates/control-panel.jade');


// The thresholds that define the segments to break colors on.
var THRESHOLDS = [0, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009];
// This colorscheme is just an array of colors. Can be substituted for any
// similar array (there are many options in the colorbrewer file, an open
// source set of colorschemes). The cardinality of the colorscheme should one
// less than that of the thresholds.
var COLORSCHEME = colorbrewer.Greys[THRESHOLDS.length - 1];


var PRISON_TYPES = ['Federal', 'State', 'Local', 'Halfway House', 'Military', 'Private', 'Other'];
var PRISON_COLORSCHEME = colorbrewer.Set2[PRISON_TYPES.length];


/**
 * @param {Object} options Hash should contain a selector that picks out an
 *     element that the map should be rendered into.
 */
var ViolenceMap = function(options) {
  if (!options || !options.el) {
    throw new Error('Must pass a selector when initializing a ViolenceMap.');
  }
  this.el = d3.select(options.el);

  if (!options.url) {
    throw new Error('Must pass a url when initializing an ViolenceMap');
  }

  d3.select(window).on('resize', _.bind(this.handleResize, this));
  this.handleResize();

  d3.json(options.url, _.bind(this.handleFetch, this));

  this.colorScale = d3.scale.quantile()
    .domain(THRESHOLDS)
    .range(d3.range(COLORSCHEME.length).map(_.bind(function(i) {
      return COLORSCHEME[i];
    }, this)));

  this.prisonColorScale = d3.scale.ordinal()
    .domain(PRISON_TYPES)
    .range(PRISON_COLORSCHEME);

  this.prisonScale = d3.scale.linear()
    .domain([0, 10000])
    .range([0.5, 15]);

  this.active = d3.select(null);
};


/**
 * Updates the size and path to reflect the new size. If the data is loaded, re-
 * renders the map.
 */
ViolenceMap.prototype.handleResize = function() {
  var boundingRect = this.el.node().getBoundingClientRect();
  this.width = boundingRect.width;
  this.height = boundingRect.height;

  // Use the albersUsa projection because it deals with the alaska monstrosity.
  this.projection = d3.geo.albersUsa()
    // Magic constants are magic. I arrived at these by fiddling. Seems to
    // maintain good scale across a broad range of dimensions.
    .scale(Math.min(this.height, this.width) * 1.4)
    .translate([this.width / 2, this.height / 2]);

  this.path = d3.geo.path()
    .projection(this.projection);

  // If we've loaded the data, then re-render the map.
  if (this.data) {
    this.renderMap();
  }
};


/**
 * Handles the response the data fetch.
 *
 * @param  {Object} err
 * @param  {Object} data
 */
ViolenceMap.prototype.handleFetch = function(err, data) {
  // If something bad happened abort and hide the widget.
  if (err) {
    console.log(err);
    this.el.style.display = 'none';
    return;
  }

  this.data = data;
  this.filterData();
  this.renderMap();
};


/**
 * Renders the map.
 */
ViolenceMap.prototype.renderMap = function() {
  var self = this;

  // Kill the loading text, or whatever was previously in the element we were
  // passed.
  this.el.html("");

  // Render the control panel first.
  this.renderControlPanel();

  var geodata = this.data['us.topo'];

  // Extract the states
  this.states =
    topojson.feature(geodata, geodata.objects.states);

  // Add the containing svg.
  this.svg = this.el.append("svg")
    .attr("width", this.width)
    .attr("height", this.height)
    .attr("class", "violencemap-us");

  this.group = this.svg.append("g");

  // Draw the outlines of all the states, fill them according to the
  // colorScale.
  this.group.selectAll("path")
    .data(this.states.features)
    .enter().append("path")
      .attr("class", "violencemap-state")
      .attr("d", this.path)
      // .attr("fill", function(d) { return self.colorScale(self.getImprisonmentRate(d.id)); })
      .on("click", getHandler(this.handleStateClicked, this));

  this.renderData();
};

ViolenceMap.prototype.renderData = function() {
  var self = this;

  this.group.selectAll(".killing")
    .data(this.data.killings)
    .enter().append("circle")
    .attr("cx", function(d) { return self.projection([d.lng, d.lat])[0]; })
    .attr("cy", function(d) { return self.projection([d.lng, d.lat])[1]; })
    .attr("r", "3px")
    .attr("fill", function(d) { return '#F33'; })
    .attr("stroke", function(d) { return '#F33'; })
    .attr("opacity", 0.7)
    // .attr("class", function(d) { return slugify(self.getPrisonType(d.type)); })
    .on("hover", function(d) {

    });
};

ViolenceMap.prototype.handleStateClicked = function(target, d) {
  if (this.active.node() === target) {
    return this.resetZoom();
  }
  this.active.classed('active', false);
  this.active = d3.select(target).classed('active', true);

  // Lifted from http://bl.ocks.org/mbostock/4699541
  var bounds = this.path.bounds(d);
  // Find the size of the area we are zooming too.
  var boundsWidth = bounds[1][0] - bounds[0][0];
  var boundsHeight = bounds[1][1] - bounds[0][1];
  // Find the center.
  var x = (bounds[0][0] + bounds[1][0]) / 2;
  var y = (bounds[0][1] + bounds[1][1]) / 2;
  // Find a scale that will fit the entire thing inside the containing element.
  var scale = 0.9 / Math.max(boundsWidth / this.width, boundsHeight / this.height);
  // Translate to the center (remember that the map starts translated to
  // [this.width / 2, this.height / 2]).
  var translate = [this.width / 2 - scale * x, this.height / 2 - scale * y];

  this.group.transition()
    .duration(750)
    // Scale stuff here
    .attr("transform", "translate(" + translate + ") scale(" + scale + ")");
};


ViolenceMap.prototype.resetZoom = function() {
  this.active.classed('active', false);
  this.active = d3.select(null);
  this.group.transition()
    .duration(750)
    .attr('transform', '');
};


/**
 * Constructs the legend and appends it to the map.
 */
ViolenceMap.prototype.renderControlPanel = function() {
  this.el.html(controlPanelTemplate());

  this.el.selectAll('.legend-control')
    .on('click', getHandler(this.handleLegendClick, this));
};


ViolenceMap.prototype.handleLegendClick = function(target, d) {
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


ViolenceMap.prototype.filterData = function() {
  this.data.killings = _.filter(this.data.killings, function(d) {
    var result = this.projection([d.lng, d.lat]);
    if (!result) {
      console.log('Warning filtering', d);
    }
    return !!result;
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
  debugger
  var domain = scale.invertExtent(value);
  return Math.ceil(domain[0] + 1) + " - " + Math.floor(domain[1]);
}


/**
 * Takes a function and a context and returns a function set up to serve as a
 * handler to a d3 event. The original handler will be called with the datum and
 * the node, while its context will be the context specified here.
 *
 * @param  {Function} handler The event handler (typically an object method)
 * @param  {Object} ctx The object the method belongs to
 */
function getHandler(handler, ctx) {
  handler = _.bind(handler, ctx);
  return function(d) {
    // 'this' here will be the d3 event target.
    return handler(this, d);
  }
};


function slugify(str) {
  return str.replace(' ', '-');
}

module.exports = ViolenceMap;



