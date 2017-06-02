var async = require("async");
var Snapshot = require("./snapshot");

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
function populateParameters(actionName, action, glom) {
  if (!parameterCache[actionName]) {
    // Analyze the function string and extract the parameter names (Works with ES6 as well)
    parameterCache[actionName] = [];

    var fnStr = func.toString().replace(COMMENTS_REGEX, "");
    var argsList = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")"));
    var validArgs = argsList.match(ARGUMENT_NAMES_REGEX);

    if( validArgs !== null) {
      for ( var i = 0; i < validArgs.length; i++  ) {
        parameterCache[actionName].push( validArgs[i].replace(SPACE_AND_COMMAS_REGEX, ""));
      }
    }
  }

  // Populate the result based on the intersection of the parameters and the glom
  var result = [];
  for (i = 0, len = parameterCache[actionName].length; i < len; i++) {
    result.push(glom[parameterCache[actionName][i]]);
  }

  return result;
}

/**
 * Creates the initiation action
 * @param  {Object}   input [description]
 * @param  {Function} next  [description]
 */
function createInitialAction(input, next) {
  return function initialAction() {
    next(input);
  };
}

/**
 * Assembles an action
 * @param  {Function} action   [description]es
 * @param  {Snapshot} snapshot [description]
 * @param  {Array}    errors   [description]
 * @return {Function}          [description]
 */
function assembleAction(actionName, action, snapshot, chainIndex, errors) {

  /**
   * Handles an action
   * @param  {Object}   glom [description]
   * @param  {Function} next [description]
   */
  return function actionHandler(glom, next) {
    try {
      var parameters = populateParameters(actionName, action, glom);
      parameters.push(function actionDone(newGlom) {
        if ((!!newGlom) && (newGlom.constructor === Object)) {
          // newGlom is an object literal

          // Apply new glom changes to the glom object
          for (var i = 0, len = Object.keys(newGlom); i < len; i++) {
            glom[i] = newGlom[i];
          }

          // Move to the next action
          next(glom);
        } else {
          // No glom was returned
          next(glom);
        }
      });
      parameters.push(function actionWarning(errorMessage) {
        // An non-critical warning has occured
        errors.push(errorMessage);
        next(glom);
      });
      parameters.push(snapshot);

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

/**
 * Glom
 * @param {Object}   glom [description]
 * @param {Array}    chain [description]
 * @param {Function} done  [description]
 * @param {Function} error  [description]
 */
function Glom(glom, chain, done, error) {
  var actions = [createInitialAction(glom)];
  var snapshot = new Snapshot();
  var errorMessages = [];
  var errorHandlers = [];

  for (var i = 0, len = chain.length; i < len; i++) {
    (function lexicalWrapper(index) {
      if (chain[index] instanceof Array) {
        // Assemble the action with a Glom error chain
        actions.push(assembleAction(chain[index].slice(0, 1), snapshot, index, errorMessages));
        errorHandlers.push(new Glom(glom, chain[index].slice(1), error, error));
      } else {
        // Assemble a normal action
        actions.push(assembleAction(chain[index], snapshot, index, errorMessages));
        errorHandlers.push(error);
      }
    }(i));
  }

  /**
   * [run description]
   * @param  {Function} done [description]
   * @return {[type]}        [description]
   */
  this.run = function run(done) {
    async.waterfall(actions, function glomComplete(errorObject) {
      if (errorObject) {
        var errorHandler = errorHandlers[errorObject.chainIndex];
        if (errorHandler instanceof Glom) {
          errorHandler.run(error, error);
        } else {
          errorHandler(errorObject.messages);
        }
      } else {
        done(glom);
      }
    });
  };
}
