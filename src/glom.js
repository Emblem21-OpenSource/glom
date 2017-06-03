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
function populateParameters(action, glom) {
  var actionName = action.prototype.constructor.name;
  if (!parameterCache[actionName]) {
    // Analyze the function string and extract the parameter names (Works with ES6 as well)
    parameterCache[actionName] = [];

    var fnStr = action.toString().replace(COMMENTS_REGEX, '');
    var argsList = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
    var validArgs = argsList.match(ARGUMENT_NAMES_REGEX);
    var parameter;
    if (validArgs !== null) {
      for (var i = 0; i < validArgs.length - 1; i++) {
        parameter = validArgs[i].replace(SPACE_AND_COMMAS_REGEX, '');
        if(parameter !== 'next' && parameter !== 'error') {
          parameterCache[actionName].push(parameter);
        }
      }
    }
  }

  // Populate the result based on the intersection of the parameters and the glom
  var result = [];
  var len = parameterCache[actionName].length;
  for (i = 0; i < len; i++) {
    result.push(glom[parameterCache[actionName][i]]);
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
 * Assembles an action
 * @param  {Function} action   [description]es
 * @param  {Snapshot} snapshot [description]
 * @param  {Array}    errors   [description]
 * @return {Function}          [description]
 */
function assembleAction(action, chainIndex, errors) {

  /**
   * Handles an action
   * @param  {Object}   glom [description]
   * @param  {Function} next [description]
   */
  return function actionHandler(glom, next) {
    try {
      glom.log('ActionHandler', 'Start');
      var parameters = populateParameters(action, glom);
      glom.log('ActionHandler::parameters', parameters);
      parameters.push(function actionDone(newGlom) {
        glom.log('ActionDone', 'Action complete');
        if ((!!newGlom) && (newGlom.constructor === Object)) {
          // newGlom is an object literal
          glom.log('ActionDone::fusingStart', newGlom);
          // Apply new glom changes to the glom object
          for (var i in newGlom) {
            if (newGlom.hasOwnProperty(i)) {
              glom[i] = newGlom[i];
            }
          }
          glom.log('ActionDone::fusingComplete', glom);
          // Move to the next action
          glom.log('ActionDone', 'Complete');
          next(null, glom);
        } else {
          // No glom was returned
          glom.log('ActionDone', 'Complete');
          next(null, glom);
        }
      });
      parameters.push(function actionWarning(errorMessage) {
        // An non-critical warning has occured
        errors.push(errorMessage);
        next(glom);
      });

      glom.log('ActionHandler', 'Apply');
      action.apply(glom, parameters);
    } catch (e) {
      // A critical error has occured
      errors.push(e);
      next(null, {
        chainIndex: chainIndex,
        messages: errors
      });
    }
  };
}

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
  var actions;
  var errorMessages;
  var errorHandlers;

  if (options === undefined) {
    options = {
      debug: true
    };
  }

  this.log = function log(category, message) {
    if(options.debug === true) {
      console.log('\x1b[2m\x1b[37m[\x1b[32m\x1b[1m' + new Date().toISOString() + '\x1b[2m\x1b[37m] \x1b[1m\x1b[33m' + category + ' \x1b[34m: \x1b[37m' + message + '\x1b[0m');
    }
  };

  /**
   * [run description]
   * @param  {Function} done [description]
   * @return {[type]}        [description]
   */
  this.run = function run(done, error) {
    this.log('Run', 'Assembling...');
    actions = [createInitialAction(glom)];
    errorMessages = [];
    errorHandlers = [];
    this.snapshot = new Snapshot();
    var self = this;

    if (error === undefined) {
      error = defaultError;
    }

    for (var i = 0, len = chain.length; i < len; i++) {
      (function lexicalWrapper(index) {
        if (chain[index] instanceof Array) {
          self.log('lexicalWrapper', index + '.) Assembling Glom...');
          // Assemble the action with a Glom error chain
          actions.push(assembleAction(chain[index].slice(0, 1), index, errorMessages));
          errorHandlers.push(new Glom(glom, chain[index].slice(1), error, error));
        } else {
          self.log('lexicalWrapper', index + '.) Assembling Action: ' + chain[index].prototype.constructor.name);
          // Assemble a normal action
          actions.push(assembleAction(chain[index], index, errorMessages));
          errorHandlers.push(error);
        }
      }(i));
    }

    this.log('Run', 'Start');
    async.waterfall(actions, function glomComplete(errorObject) {
      self.log('Run', 'Complete');
      if (errorObject) {
        self.log('Run', 'Error');
        var errorHandler = errorHandlers[errorObject.chainIndex];
        if (errorHandler instanceof Glom) {
          self.log('Run', 'Error Callback as Glom');
          errorHandler.run(error, error);
        } else {
          self.log('Run', 'Error Callback');
          errorHandler(errorObject.messages);
        }
      } else {
        self.log('Run', 'Exit');
        done(glom);
      }
    });
  };
}

module.exports = Glom;
