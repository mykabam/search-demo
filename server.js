var http = require('http');
var express = require('express');
var stylus = require('stylus');
var app = module.exports = express();
var server = http.createServer(app);

// Configuration
function compile(str, path) {
  return stylus(str)
    .set('filename', path)
	  .set('compress', true);
}

app.configure(function() {
  this.set('views', __dirname + '/views');
  this.set('view engine', 'jade');
    
  // bodyParser without multipart
  this.use(express.json());
  this.use(express.urlencoded());
 
  this.use(express.logger());
  this.use(express.methodOverride());
  this.use(express.cookieParser('Eah4tfzGAKhr'));
  this.use(express.session());
  this.use(stylus.middleware({
    src: __dirname + '/views', 
    dest: __dirname + '/public', 
    compile: compile
  }));
  this.use(express.favicon(__dirname + '/public/favicon.ico', { maxAge: 2592000000 }));
  this.use(express.compress());
  this.use(express.static(__dirname + '/public'));

  this.use(this.router);
});

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res) {
	res.render('index');
});

require("./lib/search")(app);

// Only listen on $ node app.js
if (!module.parent) {
  var port = 6660;
  server.listen(port, function() {
    console.log("Express server listening on port %d", port); 
  });
}
