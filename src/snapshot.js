/**
 * [Snapshot description]
 */
function Snapshot () {
  this.state = {};
}

/**
 * [set description]
 * @param {String} key   [description]
 * @param {Mixd}   value [description]
 */
Snapshot.prototype.set = function set (key, value) {
  this.state[key] = JSON.stringify(value);
};

/**
 * [get description]
 * @param {String} key   [description]
 */
Snapshot.prototype.get = function set (key) {
  try {
    return JSON.parse(this.state[key]);
  } catch (e) {
    return undefined;
  }
};