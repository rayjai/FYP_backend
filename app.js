var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

var jwt = require('jsonwebtoken');
var passport = require('passport');
var BearStrategy = require('passport-http-bearer').Strategy;
passport.use(new BearStrategy(
  function(token, done) {
    jwt.verify(token, process.env.TOKEN_SECRET, function(err, decoded) {
      if (err) { return done(err); }
      return done(null, decoded, { scope: 'all' });
    });
  }
));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname,  'uploads')));

app.use('/', indexRouter);
app.use('/api/users', passport.authenticate('bearer',{session:false}), usersRouter);
//lab9

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


process.env.TOKEN_SECRET = 'secret';

module.exports = app;
