var topojson = require('topojson');
var colorbrewer = require('../lib/colors/colorbrewer');
// This isn't working
var filters = require('../templates/filters.jade');


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

  this.bindEvents();
  this.handleResize();

  this.controlState = {
    race: '',
    gender: '',
    state: '',
    armed: ''
  };

  d3.json(options.url, _.bind(this.handleFetch, this));

  this.zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 12])
    .on("zoom", getHandler(this.handleZoom, this));

  this.active = d3.select(null);
};


ViolenceMap.prototype.bindEvents = function() {
  d3.select(window).on('resize', _.debounce(_.bind(this.handleResize, this), 100));
  Backbone.on('controls:update', _.bind(this.handleUpdate, this));
};


ViolenceMap.prototype.handleUpdate = function(e) {
  if (e) {
    this.controlState = e;
  }
  this.filterData();
  this.renderData();
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
    this.renderData();
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
  this.renderMap();
  this.handleUpdate();
};


/**
 * Renders the map.
 */
ViolenceMap.prototype.renderMap = function() {
  var self = this;

  // Kill the loading text, or whatever was previously in the element we were
  // passed.
  this.el.html("");

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

  this.svg
    .call(this.zoom)
    .call(this.zoom.event)
    .on("click", stopped, true);

  // Draw the outlines of all the states, fill them according to the
  // colorScale.
  this.group.selectAll("path")
    .data(this.states.features)
    .enter().append("path")
      .attr("class", "violencemap-state")
      .attr("d", this.path)
      .attr("fill", '#4a4c4c')
      .on("click", getHandler(this.handleStateClicked, this));

  // $('.violencemap-us').append(filters());
};

ViolenceMap.prototype.renderData = function() {
  var self = this;

  var killings = this.group.selectAll(".killing")
    .data(this.filteredKillings, function(d) { return d.name; });

  killings.enter()
    .append("circle")
    .classed("killing", true)
    .attr("cx", function(d) { return self.projection([d.lng, d.lat])[0]; })
    .attr("cy", function(d) { return self.projection([d.lng, d.lat])[1]; })
    .attr("fill", function(d) { return '#F33'; })
    .attr("stroke", function(d) { return '#F33'; })
    .attr("r", "2px")
    .attr("opacity", 0.5);

  killings.exit()
    .remove();
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
    .call(this.zoom.translate(translate).scale(scale).event);

  // this.group.selectAll(".killing")
  //   .transition()
  //   .duration(750)
  //   .attr("r", "0.3px");
};


ViolenceMap.prototype.resetZoom = function() {
  this.active.classed('active', false);
  this.active = d3.select(null);
  this.group.transition()
    .duration(750)
    .call(this.zoom.translate([0, 0]).scale(1).event);


  // this.group.selectAll(".killing")
  //   .transition()
  //   .duration(750)
  //   .attr("r", "1px");
};


ViolenceMap.prototype.handleZoom = function() {
  this.group
    .style("stroke-width", 1.5 / d3.event.scale + "px")
    .attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}


ViolenceMap.prototype.filterData = function() {
  this.filteredKillings = _.filter(this.data.killings, function(d) {
    if (this.controlState.race && this.controlState.race != d.race.toLowerCase()) {
      return false;
    }
    if (this.controlState.state && this.controlState.state != d.state) {
      return false;
    }
    if (this.controlState.gender && this.controlState.gender != d.gender.toLowerCase()) {
      return false;
    }
    if (this.controlState.armed && this.controlState.armed != d.armed.toLowerCase()) {
      return false;
    }
    var result = this.projection([d.lng, d.lat]);
    if (!result) {
      // console.log('Warning filtering for lack of geocode', d);
    }
    return !!result;
  }, this);

  console.log('filtered list contains ', this.filteredKillings.length);
};


function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
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



