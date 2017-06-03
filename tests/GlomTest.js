var Glom = require('../src/glom.js');
var assert = require('assert');

function passthru(next) {
  next();
}

function add(bob, next) {
  next({
    bob: bob + 4
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
  assert.equal(glom.bob, 9);
}, error);

// Multi-step mutation
new Glom({
  bob: 5
}, [
  add,
  add
]).run(function done(glom) {
  assert.equal(glom.bob, 13);
}, error);

// Simple failure
new Glom({
  bob: 5
}, [
  failCheck
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(messages) {
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
}, function error(messages) {
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Conditional failure
new Glom({
  bob: 5
}, [
  add,
  [fail, add]
]).run(function done() {
  assert.fail('This should not have been called');
}, function error(messages, glom) {
  console.log(glom);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});