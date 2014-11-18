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
```

## Supported events

This module supports all standard docker events like 'create', 'destroy', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause', 'untag', 'delete' and one additional `docker_deamon_down` even when docker damon was down.

All events are published to the following redis channels: `runnable:docker:${EVENT_TYPE}`. Each payload will be in the JSON format.
Payload has all fields provided by Docker plus additional `ip` property.