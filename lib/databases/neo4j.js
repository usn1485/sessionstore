'use strict';

var util = require('util'),
  Session = require('../sessionInterface'),
  use = require('../use'),
  nodeNeo4J = require('node-neo4j'),
  _ = require('lodash');

var SET_SESSION_CYPHER
  = "MERGE (session:ExpressSession { sessionId : {sessionId}}) ON CREATE SET session.createTime = timestamp() SET session.username = {username}, session.sessionExpiry = {sessionExpiry}, " +
  "session.serializedSession = {serializedSession}, session.status = 'ACTIVE' ";

var GET_SESSION_CYPHER
  = "MATCH (session:ExpressSession { sessionId : {sessionId}}) WHERE session.status <> 'TERMINATED' return session";

var DELTE_SESSION_CYPHER
  = 'MATCH (session:ExpressSession { sessionId : {sessionId}}) delete session';

var MARK_TERMINATED_SESSION_CYPHER
  = "MATCH (session:ExpressSession { sessionId : {sessionId}}) SET session.status = 'TERMINATED', session.terminateTime = timestamp()";

var Neo4JSessionStore = function (options) {
  options = options || {};

  Session.Store.call(this, options);

  var defaults = {
    neo4jUrl: 'http://neo4j:neo4j@localhost:7474',
    ttl: 60 * 60 * 24 * 1,  // 1 day
    deleteSessionNode: true,
    userNameProvider: undefined //callback to get username from session to attach to the neo4j node -> function(session) {}
  };

  _.defaults(options, defaults);

  this.options = options;

  if (this.options.deleteSessionNode) {
    this.options.CYPHER_TO_DESTROY_SESSION = DELTE_SESSION_CYPHER;
  } else {
    this.options.CYPHER_TO_DESTROY_SESSION = MARK_TERMINATED_SESSION_CYPHER;
  }

};

var nullSafeCallback = function (callback) {
  callback();
};


util.inherits(Neo4JSessionStore, Session.Store);

_.extend(Neo4JSessionStore.prototype, {

  connect: function (callback) {
    this._neo4J = new nodeNeo4J(this.options.neo4jUrl);
    var self = this;
    this.executeCypher = function (cypherQuery, params, callback) {
      self._neo4J.cypherQuery(cypherQuery, params, false, callback);
    };
    callback();
  },

  disconnect: function (callback) {
    callback();
  },

  set: function (sid, sess, callback) {
    if (!sid || !sess) {
      callback();
      return;
    }
    var sessionExpiry;
    if (sess.cookie && sess.cookie.expires && sess.cookie.expires instanceof Date) {
      sessionExpiry = sess.cookie.expires.getTime();
    } else {
      sessionExpiry = Date.now() + this.options.ttl * 1000;
    }
    var neo4JSessionNodeProps = {
      sessionId: sid,
      sessionExpiry: sessionExpiry,
      serializedSession: JSON.stringify(sess),
      username : this.options.userNameProvider ? this.options.userNameProvider(sess) : ''
    };
    this.executeCypher(SET_SESSION_CYPHER, neo4JSessionNodeProps, function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, sess);
      }
    });
  },

  get: function (sid, callback) {
    this.executeCypher(GET_SESSION_CYPHER, {sessionId: sid}, function (err, result) {
      if (err) {
        callback(err);
      } else {
        if (result && result.data && result.data.length == 1) {
          var neo4JSessionNode = result.data[0];
          if (Date.now() < neo4JSessionNode.sessionExpiry) {
            callback(null, JSON.parse(neo4JSessionNode.serializedSession));
          } else {
            callback();
          }
        } else {
          callback();
        }
      }
    });
  },

  destroy: function (sid, callback) {
    this.executeCypher(this.options.CYPHER_TO_DESTROY_SESSION, {sessionId: sid}, function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback();
      }
    });
  }

});

module.exports = Neo4JSessionStore;
