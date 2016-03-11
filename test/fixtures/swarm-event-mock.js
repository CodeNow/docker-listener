module.exports = function (opts) {
  opts = opts || {}
  var ip = opts.ip || '10.1.1.1'
  var hIp = ip.replace(/\./g, '-')
  var org = opts.org || '123123123'

  return {
    status: opts.status || 'start',
    id: opts.id || '74cef3acf07a3b1171557d24a229dd67bdddd53a84e42c14295ebf72434e0676',
    from: (opts.from || 'ubuntu') + ' node:ip-' + hIp + '.' + org,
    time: opts.time || (Date.now() / 1000).toFixed(0),
    timeNano: opts.time ? (opts.time * 1000000) : (Date.now() * 1000000),
    Type: '',
    node: {
      Name: 'ip-' + hIp + '.' + org,
      Id: 'U4AO:ZZAG:VJFC:PVDZ:LPUM:FNAC:UV7J:3KUH:UIYT:MKTM:TGA7:CPOI',
      Addr: ip + ':4242',
      Ip: ip
    }
  }
}
