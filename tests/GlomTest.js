var Glom = require('../src/glom.js');

new Glom({
  bob: 5
}, [
  function add(bob, next) {
    next({
      bob: bob + 4
    });
  }
]).run(function done(glom) {
  console.log('Done!', glom);
});
