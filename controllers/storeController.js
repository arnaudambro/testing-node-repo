const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const Review = mongoose.model('Review');

const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');


const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: 'That filetype isn\'t allowed' }, false);
    }
  }
}

exports.homePage = (req, res) => {
  res.render('index');
}

exports.addStore = (req, res) => {
  res.render('editStore', { title: ' Add Store' });
}

exports.upload = multer(multerOptions).single('photo')

exports.resize = async (req, res, next) => {
  //check if there is no new file to resize
  if (!req.file) {
    next(); //skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  //now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  //once we have written the photo to our filesystem, keep going !
  next();
}

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully Created ${store.name}. Care to leave a fucking review ?`)
  res.redirect(`/store/${store.slug}`)
}

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limitParam = 4;
  const skipParam = limitParam * (page - 1);

  //1. Query the database for a list of all stores
  const storesPromise = Store
    .find()
    .skip(skipParam)
    .limit(limitParam)
    .sort({ created: 1 });

  const countPromise = Store.count(); 

  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limitParam);

  if (!stores.length && skipParam) { //if there is no store to show at that page AND ???????? I don't get the `skip`
    req.flash('info', `You asked for page ${page}. But that doesn't exist, I put you in page ${pages}.`)
    res.redirect(`/stores/page/${pages}`)
  }

  res.render('stores',  {title: 'Stores', stores: stores, count, page, pages });
}

const confirmOwner = (store, user) => {
  //Because we don't check two strings, but one ObjectId (author) with a string (_id)
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it!')
  }
}

exports.editStore = async (req, res) => {
  //1. Find the store given the id
  const store = await Store.findOne({ _id: req.params.id })
  //2. confirm they are the owner of the store
  confirmOwner(store, req.user);
  //3. Render out the edit form so the user can update their store
  res.render('editStore', { title: `Edit ${store.name}`, store: store});
}

exports.updateStore = async (req, res) => {
  //Because of a bug, the type is not passed to the updated store, we need to pass it back manually.
  req.body.location.type = 'Point';
  //find and update the store
  const store = await Store.findOneAndUpdate(
    {_id: req.params.routerId },
    req.body,
    {
      new: true, //return the new store instead of the old one
      runValidators: true //run through 'required' validators in model/Store.js
    }
  ).exec();
  //Redirect then the store and tell them it worked
  req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}"> View Store -> </a>`)
  res.redirect(`/stores/${store._id}/edit`)
}

exports.getStoreBySlug = async (req, res, next) => {
  
  //Query the database for the store we look for
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');

  if (!store) return next();

  res.render('store', { title: `Welcome to ${store.name}`, store: store });
}

exports.getStoresByTag = async (req, res, next) => {
  
  //The getStoresByTag method is called via 2 routes : /tags/ and /tags/:tagId. Therefore, we need to say : if the route is /tags/, show all the stores with at least one tag. If the route is /tags/tagId, show the store which contains the tag.

  const tag = req.params.tagId; 
  const tagQuery = tag || { $exists: true }; //meaning if there is no tagId in the URL, show all the stores for which there exist at least one tag. 


  //CHALLENGE: make multiple queries inside one method
  //Instead of await one by one, we do all the queries at the same time, by creating promises...
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });

  //...which we call all together at the same time and await for all at the same time
  const [tagResolvedPromise, storeResolvedPromise] = await Promise.all([tagsPromise, storesPromise]);

  res.render(
    'tags',   //the name of the view to look for (tags.pug) 
    {         //all the data we give to the view
      tags: tagResolvedPromise,
      title: 'Tags',
      tag: tag,
      stores: storeResolvedPromise
    }
  );
}

exports.searchStores = async (req, res) => {
  const stores = await Store.find(
    //find stores that match...
    {
      $text: { $search: req.query.q }
    },
    //..add then a note depending on how often the objects got the word we are looking for..
    {
      score: { $meta: 'textScore' }
    }
  )
    //..then sort the data by this note
    .sort({
      score: { $meta: 'textScore' }
    })
    // and limit ti only 5 results
    .limit(5);

  res.json(stores);
};

exports.mapStores = async(req, res) => {
  //query is the url after '?'
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat)
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 //in mm
      }
    }

  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
}

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
}

exports.heartStore = async (req, res) => {
  //we can use toString() on an object thanks to mongoDB who overwrote the toString() method to ba able to do so
  const hearts = req.user.hearts.map(obj => obj.toString());
  //le but de l'opérator est : on vérifie d'abord que user.hearts contient le store liké ou pas. Si oui, alors il faut retirer le store de l'array user.hearts : on utilise $pull qui fait exactement ça. Si non, il faut insérer le store dans lá rray user.hearts, en s'assurant que ce qu'on insère sera unique dans l'array user.hearts : c'est ce que fait $addToSEt par rapport à $push qui se branle de l'unicité.
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User
    .findByIdAndUpdate(req.user._id,
      {[operator]: { hearts: req.params.id }}, //putting an object key in [] allows to compute the key. operator will be replaced by $pull or $addToSet
      { new: true }
    );
    res.json(user);
}

exports.getHeartedStoresByUser = async (req, res) => {
  // const user = User.findOne({ _id: req.user._id });
  // const storesId = req.user.hearts.map(obj => ObjectId(obj));


  const stores = await Store.find({ _id: { $in: req.user.hearts } });

  res.render('stores', {title: 'Hearted Stores', stores});
}

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStoresFromDB(); //we could put Store.find and a complex stuff inside but it's not the purpose of a controller, it's the purpose of a model
  // res.json(stores)
  res.render('topStores', { stores, title: '🌟 Top Stores!' });
}
