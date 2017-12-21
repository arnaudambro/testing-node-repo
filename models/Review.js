const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const reviewSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User', //'User' is defined in User.js at line : module.exports = mongoose.model('User', userSchema)
    required: 'You must supply an author'    
  },
  store: {
    type: mongoose.Schema.ObjectId,
    ref: 'Store', //'User' is defined in User.js at line : module.exports = mongoose.model('User', userSchema)
    required: 'You must supply a store' 
  },
  created: {
    type: Date,
    default: Date.now
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  contentReview: {
    type: String,
    trim: true,
    required: 'Your review must have text'
  }
});


/*------------------------------------*\
    AUTOPOPULATE AUTHOR
\*------------------------------------*/

//Create the function
function autoPopulate(next) {
  this.populate('author');
  next();
}

//Before we call find or findOne on a review, we call autoPopulate
reviewSchema.pre('find', autoPopulate);
reviewSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Review', reviewSchema);
