var Glom = require('../src/glom.js');
var assert = require('assert');

// Passthru test
new Glom({
  bob: 5
}, [
  function passthru(bob, next) {
    next();
  }
]).run(function done(glom) {
  assert.equal(glom.bob, 5);
});

// Simple mutation test
new Glom({
  bob: 5
}, [
  function add(bob, next) {
    next({
      bob: bob + 4
    });
  }
]).run(function done(glom) {
  assert.equal(glom.bob, 9);
});

// Multi-step mutation
new Glom({
  bob: 5
}, [
  function add(bob, next) {
    next({
      bob: bob + 4
    });
  },
  function add(bob, next) {
    next({
      bob: bob + 4
    });
  }
]).run(function done(glom) {
  assert.equal(glom.bob, 13);
});

// Simple failure
new Glom({
  bob: 5
}, [
  function fail(bob, next, error) {
    if (bob === 1) {
      next();
    } else {
      error('This failed');
    }
  }
]).run(function done(glom) {
  assert.equal(glom.bob, 13);
});
