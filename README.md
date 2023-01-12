# haraka-plugin-outbound-logger

## What

Haraka SMTP plugin to log outbound SMTP traffic which maybe useful for debugging/audit purposes. Haraka provides a way to add external plugins by registering them and invoking various "hooks" during the complete lifecycle of the SMTP server handling an email message. This plugin listens for the `delivered`,`deferred` and `bounced` hook calling during [Outbound delivery](https://haraka.github.io/core/Outbound/) and logs useful metadata to a file or STDOUT in JSON.

This plugin uses [PinoJS](https://github.com/pinojs/pino) for a high performant JSON logger. 

### Install

```bash
npm install "https://github.com/mr-karan/haraka-plugin-outbound-logger.git#main" --save
```

To enable the plugin, add the name of the plugin (`outbound-logger`) inside `config/plugins` file.

### Configuration

Create a config file `outbound_logger.ini` inside the config directory. This file is read when `outbound-logger` plugin is being registered by Haraka.

```ini
;[stdout]
; Whether to enable logging to STDOUT. Defaults to false.
;enable = false

;[file]
; Whether to enable file logging. Defaults to false.
;enable = false
;Directory to store the log files. Ensure the process running Haraka has ownership on this directory.
;log_dir = /var/log/haraka_outbound/
;Enable synchronous logging to a file. Defaults to true. For better peformance where some messages may be lost in the event of a crash, set to false.
;sync = true

; Whether to stop invoking any plugin in the chain after a BOUNCE hook is called. Defaults to true. Set to false if you want to handle the bounce in another plugin.
;stop_at_bounce = true
```

The plugin supports logging to multiple output streams, so you can optionally enable both stdout/file logging.

## Sample Record Output

### Delivered

```json
{
    "level": "info",
    "time": "2023-01-11T11:13:35.987Z",
    "pid": 2576454,
    "hostname": "ip-192-168-40-144",
    "name": "outbound_logger",
    "type": "delivered",
    "job_id": "B3D5DE63-94AB-4825-B43F-2FB11E89261B.1.1",
    "queue_time": "2023-01-11T11:13:33.726Z",
    "smtp_host": "aspmx.l.google.com",
    "smtp_ip": "74.125.24.27",
    "smtp_response": "OK  1673435615 q65-20020a632a44000000b004acd87cc977si13197979pgq.659 - gsmtp",
    "smtp_delay": 2.26,
    "smtp_port": 25,
    "recipient": "user@example.com",
    "from": "test@smtp.example.net",
    "subject": "Test"
}
```

### Deferred

```json
{
    "level": "info",
    "time": "2023-01-11T11:26:44.377Z",
    "pid": 2580208,
    "hostname": "ip-192-168-40-144",
    "name": "outbound_logger",
    "type": "deferred",
    "job_id": "7B5DB89F-691C-49C1-88A1-3539E066692C.1.1",
    "queue_time": "2023-01-11T11:26:43.993Z",
    "recipient": "user@example.com",
    "from": "test@smtp.example.net",
    "subject": "Test",
    "dsn_status": "4.7.1",    
    "dsn_action": "delayed",
    "undelivered_reason": "4.7.1 <user@example.com>: Recipient address rejected: Temporary deferral, try again soon",
    "delay": "2.5"
}
```

### Bounced

```json
{
    "level": "info",
    "time": "2023-01-11T11:26:44.377Z",
    "pid": 2580208,
    "hostname": "ip-192-168-40-144",
    "name": "outbound_logger",
    "type": "bounced",
    "job_id": "D555E3AC-3977-4B8F-A2FF-5A53567595B9.1.1",
    "queue_time": "2023-01-11T11:26:43.993Z",
    "recipient": "user@example.com",
    "from": "test@smtp.example.net",
    "subject": "Test",
    "dsn_status": "5.1.2",
    "dsn_action": "failed",
    "undelivered_reason": "550 - Domain example.org sends and receives no email (NULL MX)"
}
```

## Notes

- Recommended way to use the plugin is to hook up with an external log collection agent (Fluentbit/Vector) and send the logs to a centralised log store (Elasticsearch/S3 etc).
