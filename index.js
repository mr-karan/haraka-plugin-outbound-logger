'use strict'

// outbound_logger
//------------
// documentation via: `haraka -h outbound_logger`

var pino = require('pino');

var cfg;

exports.register = function () {
  var plugin = this;

  // Initialise pino js logger.
  var lgr = pino({
    name: 'outbound_logger',
    level: 'info',
  });

  plugin.log_cfg();

  plugin.register_hook('init_master', 'init_plugin');
  plugin.register_hook('init_child', 'init_plugin');

  plugin.register_hook('queue_outbound', 'set_header_to_note');
  plugin.register_hook('delivered', 'handle_delivered');
  plugin.register_hook('deferred', 'handle_deferred');
  plugin.register_hook('bounce', 'handle_bounce');
};

//-------------------------------------------------------------------------------------------------------------------
//Plugin Hooks ------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------

//Init plugin
exports.init_plugin = function (next) {
  var context = this;

  context.loginfo("Plugin is Ready!");

  return next();
};

exports.set_header_to_note = function (next, connection) {
  //Setting the header to notes before sent, we will need it in 'delivered/bounce/deferred' hooks to get "custom_FIELD" parameters
  connection.transaction.notes.header = connection.transaction.header;

  return next();
};

exports.handle_delivered = function (next, hmail, params) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) return next();

  log.info("hello world")
  console.log(header)
  console.log(rcpt_to)

  plugin.loginfo("Delivered Record Added.");

  return next();
};

exports.handle_deferred = function (next, hmail, params) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) return next();

  log.info("hello world")
  console.log(header)
  console.log(rcpt_to)

  plugin.loginfo("Deferred Record Added.");

  return next();
};

exports.handle_bounced = function (next, hmail, params) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) return next();

  log.info("hello world")
  console.log(header)
  console.log(rcpt_to)

  plugin.loginfo("Bounced Record Added.");

  return next();
};

exports.shutdown = function () {
  //clear the "archive_interval" interval if "archive_to" is specified in the config files
  if (cfg.main.hasOwnProperty("archiving")) {
    if (cfg.main.archiving === "true") {
      clearInterval(server.notes.archive_interval);
    }
  }
};

//-------------------------------------------------------------------------------------------------------------------
//Plugin Functions --------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------

//Load configuration file
exports.log_cfg = function () {
  var plugin = this;

  plugin.loginfo("Config is loaded from 'outbound_logger.ini'.");
  cfg = plugin.config.get("outbound_logger.ini", function () {
    plugin.register();
  });
};

