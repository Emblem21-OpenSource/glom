# glom

Tranformation chain utilizing an accumulating mixin (called a glom) input parameter.

## Usage

```javascript
var Glom = require('glom');

function incrementData (glom, snapshots, done, error) {
    done({
        data: glom.data + 1
    });

}

function setDataSnapshot (glom, snapshots, done, error) {
    snapshots.set('data', glom.data);
    done();
}

function doubleData (glom, snapshots, done, error) {
    if (glom.data > 5) {
        error('Data is too big.');
    } else {
        done({
            data: glom.data * 2
        });
    }
}

function printData (glom, snapshots, done, error) {
    console.log(glom.data);
    done();
}

function revertToSnapshot (glom, snapshots, done, error) {
    done({
        data: snapshots.get('data')
    });
}

Glom({
    data: 3
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
})
```