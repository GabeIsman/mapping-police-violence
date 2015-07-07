var FilterIndicatorView = require('./filter-indicator');

var ControlPanelView = Backbone.View.extend({


  template: require('../templates/control-panel.jade'),


  events: {
    'change input': 'handleChange',
    'click .show-controls': 'toggleControls',
  },


  initialize: function(options) {
    this.model = new Backbone.Model();
    this.filterIndicator = new FilterIndicatorView({
      model: this.model
    });
    // This is really buggy because Bootstrap toggle buttons are such a fucking POS. Need to write custom buttons.
    // this.listenTo(this.filterIndicator, 'indicator:filter_removed', _.bind(this.handleFilterRemoved, this));
    this.render();
  },


  render: function() {
    this.$el.html(this.template());
    this.filterIndicator.setElement('.filter-indicator');
    this.filterIndicator.render();
  },


  handleChange: function(e) {
    _.defer(_.bind(this.update, this));
  },

  update: function(state) {
    // This is complicated because bootstrap toggle buttons are annoyingly async
    if (!state) {
      console.log('getting state');
      state = this.getState();
    }
    this.model.set(state);
    Backbone.trigger('controls:update', state);
  },

  getState: function() {
    return {
      view: this.$('input[name=view]:checked').val(),
      gender: this.$('input[name=gender]:checked').val(),
      race: this.$('input[name=race]:checked').val(),
      armed: this.$('input[name=armed]:checked').val()
    };
  },

  handleFilterRemoved: function(e) {
    this.$('input[name=' + e.filter + ']').button('reset');
    var state = this.getState();
    state[e.filter] = '';
    this.update(state);
  },

  toggleControls: function(e) {
    this.$('.control-panel').toggleClass('docked');
  },

});

module.exports = ControlPanelView;
