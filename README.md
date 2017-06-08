# glom

Tranformation chain utilizing an accumulating mixin (called a glom) input parameter.

## Example

If one was to describe the atomic actions required to create a new account using a chain of asynchronous functions, your Glom would look like this:

```javascript
// A chain of business rules for account creation
new Glom([
  validateUserInput,
  isEmailUnique,
  createUser,
  [createDefaultPermissions, deleteUser, createError, returnJson]  // Sidechain in case of failure
  notifyAdmin,
  registerNewUserStats,
  returnJson
]).run({
  email: 'bob@bob.com',
  password: 'woooo'
}, console.log, console.error);
```

## Additional Usage

```javascript
var Glom = require('glom');

function incrementData (value, next, error) {
    done({
        value: value + 1
    });

}

function setDataSnapshot (value, next, error) {
    this.snapshots.set('value', value);
    done();
}

function doubleData (value, next, error) {
    if (value > 5) {
        error('Data is too big.');
    } else {
        done({
            value: value * 2
        });
    }
}

function printData (value, next, error) {
    console.log(value);
    done();
}

function revertToSnapshot (messages, next, error) {
    done({
        value: this.snapshots.get('value')
    });
}

Glom({
    value: 3
}, [
    incrementData,
    getDataSnapshot,
    [doubleData, revertToSnapshot],
    printData
], function glomDone (glom) {
    console.log('Glom complete with final transformation:');
    console.dir(glom);
}, console.error);
```

Notice that each method in a Glom has its own parameters, allowing any simple, testable, and potentially isomorphic method to be used by Glom, provided the last two parameters are callbacks named `next` and  `error`.  Please see the [tests](tests/GlomTest.js) for more use cases.
