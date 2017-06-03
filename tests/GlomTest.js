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
new Glom([
  passthru
]).run({
  bob: 5
}, function done(glom) {
  assert.equal(glom.bob, 5);
}, error);


// Passthru test
new Glom([
  passthru
]).run({
  bob: 5
}, function done(glom) {
  assert.equal(glom.bob, 5);
}, error);

// Simple mutation test
new Glom([
  add
]).run({
  bob: 5
}, function done(glom) {
  assert.equal(glom.bob, 10);
}, error);

// Multi-step mutation
new Glom([
  add,
  add
]).run({
  bob: 5
}, function done(glom) {
  assert.equal(glom.bob, 15);
}, error);

// Simple failure
new Glom([
  failCheck
]).run({
  bob: 5
}, function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Multi-step failure
new Glom([
  add,
  fail
]).run({
  bob: 5
}, function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 10);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Sidechain failure
new Glom([
  add,
  [fail, add]
]).run({
  bob: 5
}, function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 15);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'This failed');
});

// Recursive sidechain failure
new Glom([
  add,
  [fail, 
    add, 
    add, 
    [fail, 
      add, 
      add
    ], 
    add]
]).run({
  bob: 5
}, function done() {
  assert.fail('This should not have been called');
}, function error(glom, messages) {
  assert.equal(glom.bob, 30);
  assert.equal(messages.length, 2);
  assert.equal(messages[0], 'This failed');
  assert.equal(messages[1], 'This failed');
});

// Sidechain failure isn't triggered
new Glom([
  add,
  [add,
    add,
    add,
    add
  ],
  add
]).run({
  bob: 5
}, function done(glom) {
  assert.equal(glom.bob, 20);
}, function error() {
  assert.fail('This should not have been called');
});

