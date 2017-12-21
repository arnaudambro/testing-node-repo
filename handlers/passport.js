const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use(User.createStrategy()); //createStrategy comes from that we used passportLocalMongoose

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())
