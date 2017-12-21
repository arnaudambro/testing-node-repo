const mongoose = require('mongoose');
const Review = mongoose.model('Review');
const Store = mongoose.model('Store');

exports.addReview = async (req, res) => {
  req.body.author = req.user._id;
  req.body.store = req.params.storeId;
  const newReview = await (new Review(req.body)).save();
  req.flash('success', 'Your comment has well been registered ! 🙌🏿')
  res.redirect('back');
}


