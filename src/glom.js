var async = require('async');
var Snapshot = require('./snapshot');

var COMMENTS_REGEX = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES_REGEX = /(?:^|,)\s*([^\s,=]+)/g;
var SPACE_AND_COMMAS_REGEX = /[\s,]/g;

var parameterCache = {};

/**
 * [getParameters description]
 * @param  {[type]} actionName [description]
 * @param  {[type]} action     [description]
 * @return {[type]}            [description]
 */
function populateParameters(signature, chainIndex, action, glom) {
  if(parameterCache[signature] === undefined) {
    parameterCache[signature] = {};
  }

  if (parameterCache[signature][chainIndex] === undefined) {
    // Analyze the function string and extract the parameter names (Works with ES6 as well)
    parameterCache[signature][chainIndex] = [];

    var fnStr = action.toString().replace(COMMENTS_REGEX, '');
    var argsList = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
    var validArgs = argsList.match(ARGUMENT_NAMES_REGEX);
    var parameter;
    if (validArgs !== null) {
      for (var i = 0; i < validArgs.length - 1; i++) {
        parameter = validArgs[i].replace(SPACE_AND_COMMAS_REGEX, '');
        if(parameter !== 'next' && parameter !== 'error') {
          parameterCache[signature][chainIndex].push(parameter);
        }
      }
    }
  }

  // Populate the result based on the intersection of the parameters and the glom
  var result = [];
  var len = parameterCache[signature][chainIndex].length;
  for (i = 0; i < len; i++) {
    result.push(glom[parameterCache[signature][chainIndex][i]]);
  }

  return result;
}

/**
 * Creates the initiation action
 * @param  {Object}   input [description]
 * @param  {Function} next  [description]
 */
function createInitialAction(input) {
  return function initialAction(next) {
    next(null, input);
  };
}

/**
 * [defaultError description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
function defaultError(e) {
  throw new Error(e);
}

/**
 * Glom
 * @param {Object}   glom [description]
 * @param {Array}    chain [description]
 * @param {Function} done  [description]
 * @param {Function} error  [description]
 */
function Glom(glom, chain, options) {
  var self = this;
  var signature = '';

  for(var i = 0, len = chain.length; i < len; i++) {
    signature += chain[i].toString();
  }

  if (options === undefined) {
    options = {
      debug: false
    };
  }

  /**
   * [log description]
   * @param  {[type]} category [description]
   * @param  {[type]} message  [description]
   * @return {[type]}          [description]
   */
  this.log = function log(category, message) {
    if(options.debug === true) {
      console.log('\x1b[0;37m[\x1b[32m' + new Date().toISOString() + '\x1b[0;37m] \x1b[1m\x1b[33m' + category + ' \x1b[0;37m:', message, '\x1b[0m');
    }
  };

  /**
   * Assembles an action
   * @param  {Function} action   [description]es
   * @param  {Snapshot} snapshot [description]
   * @param  {Array}    errors   [description]
   * @return {Function}          [description]
   */
  function assembleAction(action, chainIndex, errors) {
    var actionName = action.prototype.constructor.name;
    /**
     * Handles an action
     * @param  {Object}   glom [description]
     * @param  {Function} next [description]
     */
    return function actionHandler(glom, next) {
      var parameters = populateParameters(signature, chainIndex, action, glom);
      self.log(actionName + '::parameters', parameters);
      parameters.push(function actionDone(newGlom) {
        self.log(actionName, 'Complete');
        if ((!!newGlom) && (newGlom.constructor === Object)) {
          // newGlom is an object literal
          self.log(actionName + '::fusingStart', newGlom);
          // Apply new glom changes to the glom object
          for (var i in newGlom) {
            if (newGlom.hasOwnProperty(i)) {
              glom[i] = newGlom[i];
            }
          }
          self.log(actionName + '::fusingComplete', glom);
          // Move to the next action
          self.log(actionName, 'Exit');
          next(null, glom);
        } else {
          // No glom was returned
          self.log(actionName, 'Exit');
          next(null, glom);
        }
      });
      parameters.push(function actionError(errorMessage) {
        // An non-critical warning has occured
        self.log(actionName + '::error', errorMessage);
        errors.push(errorMessage);
        next({
          chainIndex: chainIndex,
          messages: errors
        });
      });

      self.log(actionName, 'Call');
      action.apply(self, parameters);
    };
  }

  /**
   * [run description]
   * @param  {Function} done [description]
   * @return {[type]}        [description]
   */
  this.run = function run(done, error) {
    this.log('Glom', 'Assembling...');
    var actions = [createInitialAction(glom)];
    var errorMessages = [];
    var errorHandlers = [];
    this.snapshot = new Snapshot();
    var self = this;

    if (error === undefined) {
      error = defaultError;
    }

    for (var i = 0, len = chain.length; i < len; i++) {
      (function lexicalWrapper(index) {
        if (chain[index] instanceof Array) {
          self.log('Glom', index + '.) Assembling Glom...');
          // Assemble the action with a Glom error chain
          actions.push(assembleAction(chain[index].slice(0, 1), index, errorMessages));
          errorHandlers.push(new Glom(glom, chain[index].slice(1), error, error));
        } else {
          self.log('Glom', index + '.) Assembling Action: ' + chain[index].prototype.constructor.name);
          // Assemble a normal action
          actions.push(assembleAction(chain[index], index, errorMessages));
          errorHandlers.push(error);
        }
      }(i));
    }

    this.log('Glom', 'Start');
    async.waterfall(actions, function glomComplete(errorObject) {
      self.log('Glom', 'Complete');
      if (errorObject) {
        self.log('Glom::Error', errorObject);
        var errorHandler = errorHandlers[errorObject.chainIndex];
        if (errorHandler instanceof Glom) {
          self.log('Glom', 'Error Callback as Glom');
          errorHandler.run(error, error);
        } else {
          self.log('Glom', 'Error Callback');
          errorHandler.call(this, errorMessages, glom);
        }
      } else {
        self.log('Glom', 'Exit');
        done(glom);
      }
    });
  };
}

module.exports = Glom;
