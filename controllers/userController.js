const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify')


exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login Form'})
}

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Register'})
}

exports.validateRegister = (req, res, next) => {
  req.sanitizeBody('name')
  req.checkBody('name', 'You must supply a name!').notEmpty();
  req.checkBody('email', 'Your email is not valid!').isEmail();
  req.sanitizeBody('email').normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  })
  req.checkBody('password', 'Password can not be empty').notEmpty();
  req.checkBody('password-confirm', 'Confirm-password can not be empty').notEmpty();
  req.checkBody('password-confirm', 'Oups ! Your passwords do not match').equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    console.log(errors)
    req.flash('error', errors.map(err => err.msg))
    res.render('register', { title: 'Register', body: req.body, flashes: req.flash()})
    return //stop the function from running
  }
  next() //there were no error !
};

exports.register = async(req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name, });
  /*Because the method register (existing thanks to passportLocalMongoose plugin)
  doesn't return a Promise but a callback, we need to create a Promise from it.
  Promisify can do it, and we need to give it two arguments :
  1. The method to promisify
  2. Because the method (register) is not just a top-level function, but a method bound to
  an object (User), we need to explicitly bind the method to the object it's meant
  to be bount with. For that, we declare the object bound to as the second argument.*/
  const registerWithPromise = promisify(User.register, User);
  await registerWithPromise(user, req.body.password);
  next();
};


exports.account = (req, res) => {
  res.render('account', { title: 'Edit your profile'})
}

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  };
  const user = await User.findOneAndUpdate(
    { _id: req.user._id }, //query
    { $set: updates },    //update
    { new: true,          //options
      runValidators: true,
      context: 'query'
    }
  );
  req.flash('success', 'Profile updated ! 👌🏿')
    res.redirect('back');

};



