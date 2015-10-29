'use strict';

var util = require('util'),
  Session = require('../sessionInterface'),
  use = require('../use'),
  _neo4J = require('node-neo4j'),
  _ = require('lodash');

var Neo4JSessionStore = function (options) {
  options = options || {};

  Session.Store.call(this, options);

  var defaults = {
    host: 'localhost',
    port: 7474,
    user: 'neo4j',
    password: 'neo4j',
    ttl: 60 * 60 * 24 * 14 // 14 days
  };

  _.defaults(options, defaults);

  this.options = options;

};

var nullSafeCallback = function (callback) {
  if (callback) {
    callback();
  }
};

util.inherits(Neo4JSessionStore, Session.Store);

var tempStore = {};

_.extend(Neo4JSessionStore.prototype, {

  executeCypher: function (cypherQuery, params, callback) {
    _neo4J.cypherQuery(cypherQuery, params, false, callback);
  },


  connect: nullSafeCallback,

  disconnect: nullSafeCallback(),

  set: function (sid, sess, callback) {
    if (sess && sess.cookie && sess.cookie.expires) {
      sess.expires = new Date(sess.cookie.expires);
    } else {
      sess.expires = new Date(Date.now() + this.options.ttl * 1000);
    }

    tempStore[sid] = sess;

    nullSafeCallback(callback);
  },

  //touch: function (sid, sess, callback) {
  //  this.set(sid, sess, callback);
  //},

  get: function (sid, callback) {
    callback(null, tempStore[sid]);
  },

  destroy: function (sid, callback) {
    tempStore[sid] = undefined;
    nullSafeCallback(callback);
  },

  length: function (callback) {
    if (callback) {
      callback(null, _(tempStore).keys().length);
    }
  },

  all: function (callback) {
    if (callback) {
      callback(null, _(tempStore).values());
    }
  },

  clear: function (callback) {
    tempStore = {};
  }

});

module.exports = Neo4JSessionStore;
