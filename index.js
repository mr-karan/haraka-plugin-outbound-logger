'use strict'

var fs = require("fs");
var path = require("path");
var pino = require('pino');
var cfg;

exports.register = function () {
  var plugin = this;

  plugin.load_outbound_logger_ini();

  plugin.register_hook('init_master', 'init_plugin');
  plugin.register_hook('init_child', 'init_plugin');

  plugin.register_hook('queue_outbound', 'set_header_to_note');

  // https://haraka.github.io/core/Outbound/#the-delivered-hook
  plugin.register_hook('delivered', 'handle_delivered');
  // https://haraka.github.io/core/Outbound/#the-deferred-hook
  plugin.register_hook('deferred', 'handle_deferred');
  // https://haraka.github.io/core/Outbound/#the-bounce-hook
  plugin.register_hook('bounce', 'handle_bounced');
};

//-------------------------------------------------------------------------------------------------------------------
//Plugin Hooks ------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------

//Init plugin
exports.init_plugin = function (next) {
  var context = this;

  // Initialise pino js logger and inject in the plugin context.
  var opts = {
    name: 'outbound_logger',
    level: 'debug',
    // uses the ISO time format.
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  }

  var streams = []

  // Configure a different destination.
  if (cfg.hasOwnProperty("stdout")) {
    if (cfg.stdout.enable === true) {
      streams.push({ stream: pino.destination(1) })
    } else {
      context.loginfo("stdout is disabled.");
    }
  }

  if (cfg.hasOwnProperty("file")) {
    if (cfg.file.enable === true) {
      if (cfg.file.log_dir === "" || cfg.file.log_dir === undefined) {
        context.logerror("file path is not defined.");
      } else {
        streams.push({ stream: pino.destination({ dest: path.join(cfg.file.log_dir, 'haraka_outbound.log'), append: true, sync: cfg.file.sync }) })
      }
    } else {
      context.loginfo("file logging is disabled.");
    }
  }

  // Initialise pino and set in context.
  context.pilog = pino(opts, pino.multistream(streams))

  context.loginfo("Plugin is Ready!");
  return next();
};

exports.set_header_to_note = function (next, connection) {
  // Setting the header to notes before sent, we will need it in 'delivered/bounce/deferred' hooks to get "custom_field" parameters.
  // NOTE: This is unused as of now, the plugin doesn't log custom fields. Future support may be added, if required.
  connection.transaction.notes.header = connection.transaction.header;

  return next();
};

exports.handle_delivered = function (next, hmail, params) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) {
    plugin.logwarn("No todo object found in delivered hook. (hmail.todo)")
    return next()
  };

  var meta = {};
  meta.type = "delivered"
  meta.job_id = todo.uuid;
  meta.queue_time = (new Date(todo.queue_time)).toISOString();

  // params is an array of host, ip, response, delay, port, mode, ok_recips, secured.
  meta.smtp_host = params[0] || "";
  meta.smtp_ip = params[1] || "";
  meta.smtp_response = params[2] || "";
  meta.smtp_delay = params[3] || "";
  meta.smtp_port = params[4] || "";

  // Remove < and > from the email address. (eg <hello@user.com>)
  meta.recipient = rcpt_to.original.slice(1, -1)
  meta.from = todo.mail_from.original.slice(1, -1);

  if (header && header.get("subject"))
    meta.subject = header.get_decoded('subject');
  else if (hmail.todo.notes.header.headers.subject)
    meta.subject = hmail.todo.notes.header.headers_decoded.subject[0];
  else
    meta.subject = "unknown";

  // Log the meta.
  plugin.pilog.info(meta)

  plugin.loginfo("Delivered Record Added.");
  return next();
};

exports.handle_deferred = function (next, hmail, params) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) {
    plugin.logwarn("No todo object found in deferred hook. (hmail.todo)")
    return next()
  };

  var meta = {};
  meta.type = "deferred"
  meta.job_id = todo.uuid;
  meta.queue_time = (new Date(todo.queue_time)).toISOString();

  // Remove < and > from the email address. (eg <hello@user.com>)
  meta.recipient = rcpt_to.original.slice(1, -1)
  meta.from = todo.mail_from.original.slice(1, -1);

  if (header && header.get("subject"))
    meta.subject = header.get_decoded('subject');
  else if (hmail.todo.notes.header.headers.subject)
    meta.subject = hmail.todo.notes.header.headers_decoded.subject[0];
  else
    meta.subject = "unknown";

  // Log the reasons for deferring.
  meta.dsn_status = rcpt_to.dsn_smtp_code || rcpt_to.dsn_status;
  meta.dsn_message = rcpt_to.dsn_smtp_response;
  meta.dsn_action = rcpt_to.dsn_action;

  if (rcpt_to.hasOwnProperty("reason"))
    meta.undelivered_reason = rcpt_to.reason;
  else if (rcpt_to.hasOwnProperty("dsn_msg"))
    meta.undelivered_reason = (rcpt_to.dsn_code + " - " + rcpt_to.dsn_msg);
  else if (rcpt_to.hasOwnProperty("dsn_smtp_response"))
    meta.undelivered_reason = rcpt_to.dsn_smtp_response;
  else
    meta.undelivered_reason = "unknown error"

  meta.smtp_delay = params.delay

  // Log the meta.
  plugin.pilog.info(meta)

  plugin.loginfo("Deferred Record Added.");
  return next();
};

exports.handle_bounced = function (next, hmail, error) {
  var plugin = this;
  var todo = hmail.todo;
  var header = hmail.notes.header;
  var rcpt_to = todo.rcpt_to[0];

  if (!todo) {
    plugin.logwarn("No todo object found in bounced hook. (hmail.todo)")
    return next()
  };


  var meta = {};
  meta.type = "bounced"
  meta.job_id = todo.uuid;
  meta.queue_time = (new Date(todo.queue_time)).toISOString();

  // Remove < and > from the email address. (eg <hello@user.com>)
  meta.recipient = rcpt_to.original.slice(1, -1)
  meta.from = todo.mail_from.original.slice(1, -1);

  if (header && header.get("subject"))
    meta.subject = header.get_decoded('subject');
  else if (hmail.todo.notes.header.headers.subject)
    meta.subject = hmail.todo.notes.header.headers_decoded.subject[0];
  else
    meta.subject = "unknown";

  // Log the reasons for deferring.
  meta.dsn_status = rcpt_to.dsn_smtp_code || rcpt_to.dsn_status;
  meta.dsn_message = rcpt_to.dsn_smtp_response;
  meta.dsn_action = rcpt_to.dsn_action;

  if (rcpt_to.hasOwnProperty("reason"))
    meta.undelivered_reason = rcpt_to.reason;
  else if (rcpt_to.hasOwnProperty("dsn_msg"))
    meta.undelivered_reason = (rcpt_to.dsn_code + " - " + rcpt_to.dsn_msg);
  else if (rcpt_to.hasOwnProperty("dsn_smtp_response"))
    meta.undelivered_reason = rcpt_to.dsn_smtp_response;
  else
    meta.undelivered_reason = "unknown error"

  // Log the meta.
  plugin.pilog.info(meta)

  plugin.loginfo("Bounced Record Added.");

  if (cfg.main.stop_at_bounce === true) {
    // Prevent the sending of bounce mail to originating sender.
    return next(OK);
  }

  return next();
};

exports.shutdown = function () {
  plugin.loginfo("Shutting down.");
};

//-------------------------------------------------------------------------------------------------------------------
//Plugin Functions --------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------

//Load configuration file
exports.load_outbound_logger_ini = function () {
  var plugin = this;

  plugin.loginfo("Config is loaded from 'outbound_logger.ini'.");
  cfg = plugin.config.get("outbound_logger.ini", {
    booleans: [
      '+stop_at_bounce',         // plugins.cfg.main.stop_at_bounce=true
      '-stdout.enable',          // plugins.cfg.stdout.enable=false
      '-file.enable',            // plugins.cfg.file.enable=false
      '+file.sync',              // plugins.cfg.file.sync=true
    ]
  },
    function () {
      plugin.register();
    });
};
