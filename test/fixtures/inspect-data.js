module.exports = {
  'Id': 'fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802',
  'Created': '2016-08-23T21:43:41.921631763Z',
  'Path': '/bin/sh',
  'Args': [
    '-c',
    'gosu redis redis-server'
  ],
  'State': {
    'Status': 'running',
    'Running': true,
    'Paused': false,
    'Restarting': false,
    'OOMKilled': false,
    'Dead': false,
    'Pid': 21879,
    'ExitCode': 0,
    'Error': '',
    'StartedAt': '2016-08-24T19:55:45.755508303Z',
    'FinishedAt': '2016-08-24T19:55:42.537960861Z'
  },
  'Image': 'sha256:6f359d21b6893c6a2bba29a33b73ae5892c47962ee47374438a28c2615e3cc04',
  'ResolvConfPath': '/docker/containers/fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802/resolv.conf',
  'HostnamePath': '/docker/containers/fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802/hostname',
  'HostsPath': '/docker/containers/fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802/hosts',
  'LogPath': '/docker/containers/fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802/fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802-json.log',
  'Name': '/fervent_sammet9',
  'RestartCount': 0,
  'Driver': 'aufs',
  'MountLabel': '',
  'ProcessLabel': '',
  'AppArmorProfile': '',
  'ExecIDs': null,
  'HostConfig': {
    'Binds': null,
    'ContainerIDFile': '',
    'LogConfig': {
      'Type': 'json-file'
    },
    'NetworkMode': 'default',
    'PortBindings': null,
    'RestartPolicy': {
      'Name': '',
      'MaximumRetryCount': 0
    },
    'AutoRemove': false,
    'VolumeDriver': '',
    'VolumesFrom': null,
    'CapAdd': null,
    'CapDrop': [
      'MKNOD',
      'FSETID'
    ],
    'Dns': null,
    'DnsOptions': null,
    'DnsSearch': null,
    'ExtraHosts': null,
    'GroupAdd': null,
    'IpcMode': '',
    'Cgroup': '',
    'Links': null,
    'OomScoreAdj': 0,
    'PidMode': '',
    'Privileged': false,
    'PublishAllPorts': true,
    'ReadonlyRootfs': false,
    'SecurityOpt': null,
    'UTSMode': '',
    'UsernsMode': '',
    'ShmSize': 67108864,
    'Runtime': 'runc',
    'ConsoleSize': [
      0,
      0
    ],
    'Isolation': '',
    'CpuShares': 0,
    'Memory': 2048000000,
    'CgroupParent': '',
    'BlkioWeight': 0,
    'BlkioWeightDevice': null,
    'BlkioDeviceReadBps': null,
    'BlkioDeviceWriteBps': null,
    'BlkioDeviceReadIOps': null,
    'BlkioDeviceWriteIOps': null,
    'CpuPeriod': 0,
    'CpuQuota': 0,
    'CpusetCpus': '',
    'CpusetMems': '',
    'Devices': null,
    'DiskQuota': 0,
    'KernelMemory': 0,
    'MemoryReservation': 128000000,
    'MemorySwap': -1,
    'MemorySwappiness': -1,
    'OomKillDisable': false,
    'PidsLimit': 0,
    'Ulimits': null,
    'CpuCount': 0,
    'CpuPercent': 0,
    'IOMaximumIOps': 0,
    'IOMaximumBandwidth': 0
  },
  'GraphDriver': {
    'Name': 'aufs',
    'Data': null
  },
  'Mounts': [],
  'Config': {
    'Hostname': 'fa94842f2ee1',
    'Domainname': '',
    'User': '',
    'AttachStdin': false,
    'AttachStdout': false,
    'AttachStderr': false,
    'Tty': false,
    'OpenStdin': false,
    'StdinOnce': false,
    'Env': [
      'RUNNABLE_CONTAINER_ID=18wjg4',
      'REDIS_VERSION=3.2.1'
    ],
    'Cmd': [
      '/bin/sh',
      '-c',
      'gosu redis redis-server'
    ],
    'Image': 'localhost/2335750/57bcc389f970c7140062ab24:57bcc389a124de130050a02c',
    'Volumes': null,
    'WorkingDir': '/data',
    'Entrypoint': null,
    'OnBuild': null,
    'Labels': {
      'com-docker-swarm-constraints': '[\'org==2335750\',\'node==~ip-10-4-132-87.2335750\']',
      'type': 'user-container'
    }
  },
  'NetworkSettings': {
    'Bridge': '',
    'SandboxID': 'a024885c9117efedd6b6733c81b38e9a611ef34c929439088e741c3c83baa27e',
    'HairpinMode': false,
    'LinkLocalIPv6Address': '',
    'LinkLocalIPv6PrefixLen': 0,
    'Ports': {
      '6379/tcp': [
        {
          'HostIp': '0.0.0.0',
          'HostPort': '64821'
        }
      ]
    },
    'SandboxKey': '/var/run/docker/netns/a024885c9117',
    'SecondaryIPAddresses': null,
    'SecondaryIPv6Addresses': null,
    'EndpointID': '9266807d3ab8b70dbae31793a0f60fdc82d7fa372eb005ae55747a01621996bb',
    'Gateway': '172.17.42.1',
    'GlobalIPv6Address': '',
    'GlobalIPv6PrefixLen': 0,
    'IPAddress': '172.17.0.3',
    'IPPrefixLen': 16,
    'IPv6Gateway': '',
    'MacAddress': '02:42:ac:11:00:03',
    'Networks': {
      'bridge': {
        'IPAMConfig': null,
        'Links': null,
        'Aliases': null,
        'NetworkID': 'eecdae39457ece7ead31682395dd319ebab16d12bde0ab9874fe3cc74d7ed558',
        'EndpointID': '9266807d3ab8b70dbae31793a0f60fdc82d7fa372eb005ae55747a01621996bb',
        'Gateway': '172.17.42.1',
        'IPAddress': '172.17.0.3',
        'IPPrefixLen': 16,
        'IPv6Gateway': '',
        'GlobalIPv6Address': '',
        'GlobalIPv6PrefixLen': 0,
        'MacAddress': '02:42:ac:11:00:03'
      }
    }
  }
}
