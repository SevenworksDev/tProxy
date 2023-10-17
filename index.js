const http = require('http');
const https = require('https');
const fs = require('fs');

// CONFIGURATION
const prefix = '/web';  // Set your prefix here
const localAddresses = [];  // Set your local addresses here
const blockedHostnames = ["https://sevenworks.eu.org/bad-site"];  // Set your blocked hostnames here
const ssl = false;  // Set SSL configuration here
const port = 6969;  // Set the desired port
const index_file = 'index.html'; // Set index file shown by the browser
// END OF CONFIGURATION

const proxy = new (require('./lib/index'))(prefix, {
  localAddress: localAddresses,
  blacklist: blockedHostnames
});

const atob = str => Buffer.from(str, 'base64').toString('utf-8');

const app = (req, res) => {
  if (req.url.startsWith(prefix)) {
    proxy.http(req, res);
    return;
  }

  req.pathname = req.url.split('#')[0].split('?')[0];
  req.query = {};
  req.url
    .split('#')[0]
    .split('?')
    .slice(1)
    .join('?')
    .split('&')
    .forEach(query => (req.query[query.split('=')[0]] = query.split('=').slice(1).join('=')));

  if (req.query.url && (req.pathname == '/prox' || req.pathname == '/prox/' || req.pathname == '/session' || req.pathname == '/session/')) {
    var url = atob(req.query.url);

    if (url.startsWith('https://') || url.startsWith('http://')) url = url;
    else if (url.startsWith('//')) url = 'http:' + url;
    else url = 'http://' + url;

    res.writeHead(301, { location: prefix + proxy.proxifyRequestURL(url) });
    res.end('');
    return;
  }

  const publicPath = __dirname + '/public' + req.pathname;

  const error = () => {
    res.statusCode = 404;
    res.end(fs.readFileSync(__dirname + '/lib/error.html', 'utf-8').replace('%ERR%', `Cannot ${req.method} ${req.pathname}`));
  };

  fs.lstat(publicPath, (err, stats) => {
    if (err) return error();

    if (stats.isDirectory()) {
      fs.existsSync(publicPath + index_file) ? fs.createReadStream(publicPath + index_file).pipe(res) : error();
    } else if (stats.isFile()) {
      !publicPath.endsWith('/') ? fs.createReadStream(publicPath).pipe(res) : error();
    } else {
      error();
    }
  });
};

const server = ssl
  ? https.createServer({ key: fs.readFileSync('./ssl/default.key'), cert: fs.readFileSync('./ssl/default.crt') }, app)
  : http.createServer(app);

proxy.ws(server);
server.listen(process.env.PORT || port, () => console.log(`${ssl ? 'https://' : 'http://'}0.0.0.0:${port}`));
