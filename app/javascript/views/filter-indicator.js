var FilterIndicatorView = Backbone.View.extend({


  template: require('../templates/active-filters.jade'),


  events: {
    'click .active-filter': 'handleClose',
  },


  initialize: function(options) {
    this.listenTo(this.model, 'change', this.render);
  },


  render: function() {
    var filters = {};
    _.each(this.model.attributes, function(value, key) {
      if (value) {
        filters[key] = value;
      }
    });
    console.log(filters);
    this.$el.html(this.template({ filters: filters }));
  },


  handleClose: function(e) {
    var filter = $(e.target).data('filter');
    this.trigger('indicator:filter_removed', { filter: filter });
  },
});

module.exports = FilterIndicatorView;
