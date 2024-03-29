const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const reviewController = require('../controllers/reviewController');
const { catchErrors } = require('../handlers/errorHandlers');


router.get('/', catchErrors(storeController.getStores));
router.get('/stores', catchErrors(storeController.getStores));
router.get('/stores/page/:page', catchErrors(storeController.getStores));
router.get('/add', 
    authController.isLoggedIn,
    storeController.addStore
);

router.post('/add',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.createStore)
);

router.post('/add/:routerId',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.updateStore)
);

router.get('/stores/:id/edit', catchErrors(storeController.editStore));
router.get('/store/:slug', catchErrors(storeController.getStoreBySlug));

router.get('/tags/', catchErrors(storeController.getStoresByTag))
router.get('/tags/:tagId', catchErrors(storeController.getStoresByTag))

router.get('/login', userController.loginForm)
router.post('/login', authController.login) //thanks to passport, it's that easy
router.get('/register', userController.registerForm)

//1. Validate the registration data
//2. Register the user
//3. Log them in
router.post('/register',
  userController.validateRegister,
  userController.register,
  authController.login
);

router.get('/logout', authController.logout);

router.get('/account', authController.isLoggedIn, userController.account);
router.post('/account', catchErrors(userController.updateAccount));

//Forgot password: send a token
router.post('/account/forgot', catchErrors(authController.forgot));
//After clicked on the link sent : access to the reset password form
router.get('/account/reset/:token', catchErrors(authController.reset));
//Change the password
router.post('/account/reset/:token', 
  authController.confirmedPasswords, 
  catchErrors(authController.update)
);

router.get('/map', storeController.mapPage);
router.get('/hearts', 
  authController.isLoggedIn, 
  catchErrors(storeController.getHeartedStoresByUser)
  );
router.post('/reviews/:storeId', 
  authController.isLoggedIn,
  catchErrors(reviewController.addReview)
  );

router.get('/top', catchErrors(storeController.getTopStores));

/*
  API
*/

router.get('/api/v1/search', catchErrors(storeController.searchStores));
router.get('/api/v1/stores/near', catchErrors(storeController.mapStores));
router.post('/api/stores/:id/heart', catchErrors(storeController.heartStore));

module.exports = router;


