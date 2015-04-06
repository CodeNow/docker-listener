docker-listener
===============

Publish Docker events into Redis


## Install & Run

To install:
```
  npm install
```


To run:
```
  npm start
```

Before running please check *ENV* variables in the `./configs` directory. Redis server is needed.


To run tests:

```
  npm test
  npm run test-watch
```

## Supported events

This module supports all standard docker events like 'create', 'destroy', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause', 'untag', 'delete'.
Two additional events are emiited:
  * `docker_daemon_down` event when docker daemon went down.
  * `docker_daemon_up` event when we were able to connect to the docker daemon.

All events are published to the following redis channels: `runnable:docker:${EVENT_TYPE}`. Default channel name prefix is `runnable:docker:`, but it can be changed though ENV variables.
Each payload will be in the JSON format.
Payload has all fields provided by Docker plus additional `ip` property.

## Integrations

Events are piped to datadog.
Errors are submitted to [Rollbar](https://rollbar.com/Runnable-2/docker-listener/).
