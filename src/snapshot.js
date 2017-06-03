/**
* [Snapshot description]
*/
function Snapshot () {
  var state = {};

  /**
   * [set description]
   * @param {String} key   [description]
   * @param {Mixd}   value [description]
   */
  this.set = function set (key, value) {
    state[key] = JSON.stringify(value);
  };

  /**
   * [get description]
   * @param {String} key   [description]
   */
  this.get = function set (key) {
    try {
      return JSON.parse(state[key]);
    } catch (e) {
      return undefined;
    }
  };
}

module.exports = Snapshot;
