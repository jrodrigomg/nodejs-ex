//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    morgan  = require('morgan');
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
    var dateFormat = require('dateformat');
Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))
// Configurar cabeceras y cors
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
});

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null) {
  var mongoHost, mongoPort, mongoDatabase, mongoPassword, mongoUser;
  // If using plane old env vars via service discovery
  if (process.env.DATABASE_SERVICE_NAME) {
    var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
    mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'];
    mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'];
    mongoDatabase = process.env[mongoServiceName + '_DATABASE'];
    mongoPassword = process.env[mongoServiceName + '_PASSWORD'];
    mongoUser = process.env[mongoServiceName + '_USER'];

  // If using env vars from secret from service binding  
  } else if (process.env.database_name) {
    mongoDatabase = process.env.database_name;
    mongoPassword = process.env.password;
    mongoUser = process.env.username;
    var mongoUriParts = process.env.uri && process.env.uri.split("//");
    if (mongoUriParts.length == 2) {
      mongoUriParts = mongoUriParts[1].split(":");
      if (mongoUriParts && mongoUriParts.length == 2) {
        mongoHost = mongoUriParts[0];
        mongoPort = mongoUriParts[1];
      }
    }
  }

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;
  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      if (err) {
        console.log('Error running count. Message:\n'+err);
      }
      res.render('index.html', { pageCountMessage : count, dbInfo: mongoURL });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

app.get('/data', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {

    /*Obtener valores de minimo y maximo para los  */
    var uv = req.param("uvi");
    var mq7 = req.param("gasmq7");
    var mq135 = req.param("gasmq135");
    console.log(uv,mq7,mq135);

    db.collection("lecturas").find({}).toArray(function(err, result) {
      if (err) throw err;
      var resultado = [];
      result.forEach(function(registro){
        var doPush = true;
        if(uv!==""){
          doPush = getUVPush(uv,registro);
        }
        if(mq7!=="" && doPush){
          doPush = getmq7Push(mq7,registro);
        }
        if(mq135!=="" && doPush){
          doPush = getmq135Push(mq135,registro);
        }
        if(doPush){
          resultado.push(registro);
        }
      });
      res.send(JSON.stringify(resultado));
    });
  } else {
    res.send('[]');
  }
});


function getmq135Push(uv,registro){
  if(uv==="000"){ //Ninguno
    doPush = false;
  }else if(uv==="001"){ //Solo malos
    if(registro.gasmq135 <0.6){
      doPush = false;
    }
  }else if(uv==="010"){ //Solo regulares
    if(registro.gasmq135 >=0.5 && registro.gasmq135 <0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="011"){//Buenos y regulares
    if(registro.gasmq135 >= 0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="100"){ //Solo buenos
    if(registro.gasmq135<0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="101"){ //Buenos y malos
    if(registro.gasmq135 <0.5 || registro.gasmq135 >= 0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="111"){//Incluir todos
    doPush = true;
  }
}

function getmq7Push(uv,registro){
  if(uv==="000"){ //Ninguno
    doPush = false;
  }else if(uv==="001"){ //Solo malos
    if(registro.gasmq7 <0.6){
      doPush = false;
    }
  }else if(uv==="010"){ //Solo regulares
    if(registro.gasmq7 >=0.5 && registro.gasmq7 <0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="011"){//Buenos y regulares
    if(registro.gasmq7 >= 0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="100"){ //Solo buenos
    if(registro.gasmq7<0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="101"){ //Buenos y malos
    if(registro.gasmq7 <0.5 || registro.gasmq7 >= 0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="111"){//Incluir todos
    doPush = true;
  }
}


function getUVPush(uv,registro){
  if(uv==="000"){ //Ninguno
    doPush = false;
  }else if(uv==="001"){ //Solo malos
    if(registro.iuv <0.6){
      doPush = false;
    }
  }else if(uv==="010"){ //Solo regulares
    if(registro.iuv >=0.5 && registro.iuv <0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="011"){//Buenos y regulares
    if(registro.iuv >= 0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="100"){ //Solo buenos
    if(registro.iuv<0.5){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="101"){ //Buenos y malos
    if(registro.iuv <0.5 || registro.iuv >= 0.6){
      doPush = true;
    }else{
      doPush = false;
    }
  }else if(uv==="111"){//Incluir todos
    doPush = true;
  }
}


app.post('/data', function(req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('lecturas');
    // Create a document with request IP and current time of request
    req.body.fechahora = dateFormat(new Date(), "yyyy-mm-dd h:MM:ss");
    col.insert(req.body);
    res.send('{"sucess":1}');
  }
  res.send('{"sucess":0}');
});


// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
