var Glom = require('../src/glom.js');
var assert = require('assert');

// Actions

function passthru(next) {
  next();
}

function add(bob, next) {
  next({
    bob: bob + 5
  });
}

function failCheck(bob, next, error) {
  if (bob === 1) {
    next();
  } else {
    error('This failed');
  }
}

function fail(next, error) {
  error('This failed');
}

function error() {
  assert.fail('This should not have been called');
}

// Gloms

// Passthru test
new Glom({
  bob: 5
}, [
  passthru
]).run(function done(glom) {
  assert.equal(glom.bob, 5);
}, error);

// Simple mutation test
new Glom({
  bob: 5
}, [
  add
]).run(function done(glom) {
  assert.equal(glom.bob, 10);
}, error);

// Multi-step mutation
new Glom({
  bob: 5
}, [
  add,
  add
]).run(function done(glom) {
  assert.equal(glom.bob, 15);
}, error);

// Simple failure
new Glom({
  bob: 5
}, [
  failCheck
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Multi-step failure
new Glom({
  bob: 5
}, [
  add,
  fail
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 10);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Sidechain failure
new Glom({
  bob: 5
}, [
  add,
  [fail, add]
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 15);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});


// Recursive cidechain failure
new Glom({
  bob: 5
}, [
  add,
  [fail, add, add, [fail, 
    add, add], 
    add]
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 30);
  assert.equal(messages.length, 2);
  assert.equal(messages[0], 'This failed');
  assert.equal(messages[1], 'This failed');
});
