module.exports = (opts) => {
  opts = opts || {}

  return {
    status: opts.status || 'start',
    id: opts.id || '74cef3acf07a3b1171557d24a229dd67bdddd53a84e42c14295ebf72434e0676',
    from: (opts.from || 'ubuntu'),
    time: opts.time || Math.floor(Date.now() / 1000),
    timeNano: opts.time ? (opts.time * 1000000) : (Date.now() * 1000000)
  }
}
