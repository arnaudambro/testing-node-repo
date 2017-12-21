const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter s Store Name'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User', //'User' is defined in User.js at line : module.exports = mongoose.model('User', userSchema)
    required: 'You must supply an author'    
  }
}, {
  //because virtuals (like reviews) are not populated in the store automatically, we can force mongo to populate them
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


/*------------------------------------*\
    CREATE AN INDEX FOR SEARCH STORES BY NAME
    \*------------------------------------*/

    storeSchema.index({
      name: 'text',
      description: 'text'
    })

/*------------------------------------*\
    CREATE AN INDEX FOR SEARCH STORES BY LOCATION
    \*------------------------------------*/
    storeSchema.index({
      location: '2dsphere'
    })


/*------------------------------------*\
    SLUGIFY THE NAME TO BUILD A PROPER URL
    \*------------------------------------*/

    storeSchema.pre('save', async function(next) {
      if (!this.isModified('name')) {
    next(); //Skip this
    return; //Stop the function
  }
  this.slug = slug(this.name);
  //find if the slug is already existing
  const slugRegEx =new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storeWithSlug = await this.constructor.find({ slug: slugRegEx});
  if (storeWithSlug.length) {
    this.slug =`${this.slug}-${storeWithSlug.length + 1}`
  }
  next();
//TODO make more resilient so slug is unique
})

/*------------------------------------*\
    GET TAGS LIST TO SHOW IT IN THE TAG PAGE
    \*------------------------------------*/

  //we don't use a => function because we want 'this' to be bound to storeSchema
  storeSchema.statics.getTagsList = function() {
  //aggregate is the same kinf as findOne, findOneById...
  return this.aggregate([
    //$unwind, $group, $sort are called aggregate pipeline operators
    //$unwind : takes an array of elements (ex: tags from the store) and build a data for each element (ex: one store by tag)
    //$tags: refers to the 'tags' line 16
    { $unwind: '$tags'},
    //$group: takes all the documents available (ex: stores just created), and group them by _id (ex: $tags), so that we have as many document as _id's (ex: 5 different tags so 5 documents) with only one field: _id. 
    { $group: {
      _id: '$tags',
      //we add then a field we want, there it's the number of stores which have thesaid tag. $sum adds what we expressed (ex: 1) for each document with the tag 
      count: { $sum: 1 }
    }},
    //for $sort, -1 is descending, 1 is ascending
    { $sort: {count: -1 } }
    ]);
}

/*------------------------------------*\
    PUT REVIEWS IN THE STORESCHEMA
    \*------------------------------------*/

//ATTENTION ATTENTION ! la méthode 'virtual' n'appartient pas à MongDB, mais à mongoose, cést pas pareil. C'est comme si la méthode n'appartenait pas à UNIX mais à MacOS, c'est moins low-level. 

storeSchema.virtual('reviews', {  //'reviews' will be accessible from store.reviews if there are any
  ref: 'Review', //we link the Store model to the Review model, because the name of the reviews model is 'Review'
  localField: '_id', //this is the value of the 'store' field of the review, which corresponds to the field in Store model
  foreignField: 'store' //this is the field in Review model we want to match
})


/*------------------------------------*\
    GET TOP RATED STORES
    \*------------------------------------*/


    storeSchema.statics.getTopStoresFromDB = function() {
  //aggregate is link find but much more complex
  return this.aggregate([
    //Lookup the stores and populate their review
    //ATTENTION ATTENTION : ça ressemble beaucoup à virtual ci-dessus, sauf que $lookup est une méthode MongoDB, pas mongoose, donc c'est low-level.
    { $lookup: {
        from: 'reviews', //équivalent au 'ref' de 'virtual'. En fait, ce mot 'reviews n'existe nulle part dans notre modèle, c'est MongoDB qui l'a créé à partir de 'Review', en mettant un 'r' à la place du 'R' et en ajoutant un 's' à la fin
        localField: '_id',
        foreignField: 'store',
        as: 'reviews' //this is the field which will appear in the store
      }
    },
    //filter for only items that have 2 or more reviews
    {
      $match: { 'reviews.1': { $exists: true }} //the 'review.1' is a MongoDB way to access things that are index based. We check there that if review.1 doesn't exist, we ignore the store
    },
    {
      $project: {   //'$project' and 'projection' are big words to say 'add'. ATTENTION ATteNtioN !!!!!!!!!!!!!!!!!!!! with mongoDB 3.4, $addField is available, which is much better because it doesn't delete all the other fields : it adds the field on top of the existing ones
        averageRating: {     //so we add the new field called 'averageRating'
          $avg: '$reviews.rating' //set the value of the new field to be the average ($avg) of the reviews rating
        },      //then we take back the existing fields we need
        photo: '$$ROOT.photo', //$$ROOT is a variable to go and grab from the original document
        name: '$$ROOT.name',
        reviews: '$$ROOT.reviews',
        slug: '$$ROOT.slug',
      }
    },
    {
      $sort: {
        averageRating: -1
      }
    },
    {
      $limit: 10
    }
  ])
}

/*------------------------------------*\
    AUTOPOPULATE REVIEWS
\*------------------------------------*/

//Create the function
function autoPopulate(next) {
  this.populate('reviews');
  next();
}

//Before we call find or findOne on a review, we call autoPopulate
storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);



module.exports = mongoose.model('Store', storeSchema);
