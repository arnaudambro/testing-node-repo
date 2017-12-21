const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail.js');


exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed Login !',
  successRedirect: '/',
  successFlash: 'you are logged in'
})


exports.logout = (req, res) => {
  req.logout();  //this is a passport function
  req.flash('success', 'You are now logged out ! 👋🏽');
  res.redirect('/');
}

exports.isLoggedIn = (req, res, next) => {
  //check if somebody is authenticated
  if (req.isAuthenticated()) {
    next();
    return;
  } 

  req.flash('error', 'Oups ! You must be logged in to do that ! 🙏🏼');
  res.redirect('/login');
}

exports.forgot = async (req, res) => {
  //1. See if the user exists
  const user = await User.findOne( { email: req.body.email });
  if (!user) {
    //We lie to the user to protect the potential user from being checked if 
    //it has an account or not. That's politics.
    req.flash('error', 'A password reset has been mailed to you');
    return res.redirect('/login');
  }
  //2. See reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex'); //crypto thanks to Node.JS native feature
  user.resetPasswordExpires = Date.now() + 3600000; //1 hour from now
  await user.save();
  //3. Send them an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user: user,
    subject: 'Password reset',
    resetURL: resetURL,
    filename: 'password-reset'
  });
  req.flash('success', `You have been emailed a password reset link. `)
  //4. redirect to login page after the email has been sent
  res.redirect('/login');
}

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: {
      $gt: Date.now() //gt = greater than
    }
  });

  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired');
    return res.redirect('/login');
  }

  //if there is a user, let's have a reset form
  res.render('reset', { title: 'Reset your Password'} );
}

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    console.log('let\'s go !');
    next();
    return;
  }
  req.flash('error', 'Passwords did not match');
  res.redirect('back');
}


exports.update = async (req, res) => {
  console.log('lets do it')
  //Find the user and they are still within the one hour
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: {
      $gt: Date.now() //gt = greater than
    }
  })

  //If it is too late
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired');
    return res.redirect('/login');
  }

  //If it's still time to change the password
  //The setPassword method exists thanks to passportLocalMongoose in user.js
  //But it's a callback method, not a promise, so we need to promisify it
  const setPasswordPromisified = promisify(user.setPassword, user);
  
  //Then we set the new password...
  await setPasswordPromisified(req.body.password);

  //...and we reset the token and old password
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  //Then we tell the DB all we did before
  //The .save() method is the way we discuss with the DB
  const updatedUser = await user.save()

  //THen we login automatically, thanks to passport (and passportLocalMongoose ?)
  await req.login(updatedUser)

  req.flash('success', '💃 Nice ! New password save, you are now logged in !')
  res.redirect('/');

}
