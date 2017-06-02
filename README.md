# glom

Tranformation chain utilizing an accumulating mixin (called a glom) input parameter.

## Usage

```javascript
var Glom = require('glom');

function incrementData (value, done, error) {
    done({
        value: value + 1
    });

}

function setDataSnapshot (value, done, error, snapshots) {
    snapshots.set('value', value);
    done();
}

function doubleData (value, done, error) {
    if (value > 5) {
        error('Data is too big.');
    } else {
        done({
            value: value * 2
        });
    }
}

function printData (value, done, error) {
    console.log(value);
    done();
}

function revertToSnapshot (messages, done, snapshots) {
    done({
        value: snapshots.get('value')
    });
}

Glom({
    value: 3
}, [
    incrementData,
    getDataSnapshot,
    [doubleData, revertToSnapshot],
    printData
], function glomDone (glom, errors) {
    if (errors) {
        console.error(errors);
    }
    console.log('Glom complete with final transformation:');
    console.dir(glom);
});
```