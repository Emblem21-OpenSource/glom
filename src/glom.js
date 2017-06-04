var async = require('async');
var Snapshot = require('./snapshot');

var COMMENTS_REGEX = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES_REGEX = /(?:^|,)\s*([^\s,=]+)/g;
var SPACE_AND_COMMAS_REGEX = /[\s,]/g;

var parameterCache = {};

var defaultGlomOptions = {
  debug: false,
  parallel: false
};

/**
 * [populateParameters description]
 * @param  {[type]} signature  [description]
 * @param  {[type]} chainIndex [description]
 * @param  {[type]} action     [description]
 * @param  {[type]} glom       [description]
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
 * [createInitialAction description]
 * @param  {[type]} input [description]
 * @return {[type]}       [description]
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
 * [log description]
 * @param  {[type]} category [description]
 * @param  {[type]} message  [description]
 * @param  {[type]} debug    [description]
 * @return {[type]}          [description]
 */
function log(category, message, debug) {
  if(debug === true) {
    console.log('\x1b[0;37m[\x1b[32m' + new Date().toISOString() + '\x1b[0;37m] \x1b[1m\x1b[33m' + category + ' \x1b[0;37m:', message, '\x1b[0m');
  }
}

/**
 * [assembleAction description]
 * @param  {[type]} action     [description]
 * @param  {[type]} chainIndex [description]
 * @param  {[type]} errors     [description]
 * @param  {[type]} options    [description]
 * @param  {[type]} signature  [description]
 * @param  {[type]} context    [description]
 * @return {[type]}            [description]
 */
function assembleAction(action, chainIndex, errors, options, signature, context) {
  var actionName = action.prototype.constructor.name;
  /**
   * Handles an action
   * @param  {Object}   glom [description]
   * @param  {Function} next [description]
   */
  return function actionHandler(glom, next) {
    var parameters;

    if(actionName === 'processParallelGlom') {
      parameters = [glom];
    } else {
      parameters = populateParameters(signature, chainIndex, action, glom);
    }

    log(actionName + '::parameters', parameters, options.debug);

    parameters.push(function actionDone(newGlom) {
      log(actionName, 'Complete', options.debug);
      if ((!!newGlom) && (newGlom.constructor === Object)) {
        // newGlom is an object literal
        log(actionName + '::fusingStart', newGlom, options.debug);
        // Apply new glom changes to the glom object
        for (var i in newGlom) {
          if (newGlom.hasOwnProperty(i)) {
            glom[i] = newGlom[i];
          }
        }
        log(actionName + '::fusingComplete', glom, options.debug);
        // Move to the next action
        log(actionName, 'Exit', options.debug);
        next(null, glom);
      } else {
        // No glom was returned
        log(actionName, 'Exit', options.debug);
        next(null, glom);
      }
    });

    parameters.push(function actionError(errorMessage) {
      // An non-critical warning has occured
      log(actionName + '::error', errorMessage, options.debug);
      errors.push(errorMessage);
      next({
        chainIndex: chainIndex,
        messages: errors
      });
    });

    log(actionName, 'Call', options.debug);
    action.apply(context, parameters);
  };
}

/**
 * [Glom description]
 * @param {[type]} chain                 [description]
 * @param {[type]} options               [description]
 * @param {[type]} startingErrorMessages [description]
 */
function Glom(chain, options, startingErrorMessages) {
  var signature = '';
  var asyncMethod;

  for(var i = 0, len = chain.length; i < len; i++) {
    signature += chain[i].toString();
  }

  if (options === undefined || options === null || Object.prototype.toString.call(options) !== '[object Object]') {
    options = defaultGlomOptions;
  }

  if (!(chain instanceof Array)) {
    chain = [];
  }

  if (!(startingErrorMessages instanceof Array)) {
    startingErrorMessages = [];
  }

  /**
   * [run description]
   * @param  {[type]}   glom  [description]
   * @param  {Function} done  [description]
   * @param  {[type]}   error [description]
   * @return {[type]}         [description]
   */
  this.run = function run(glom, done, error) {

    if (glom === undefined || glom === null ||  Object.prototype.toString.call(glom) !== '[object Object]') {
      glom = {};
    }

    log('Glom', 'Assembling...', options.debug);
    var actions = [createInitialAction(glom)];
    var errorMessages = startingErrorMessages;
    var errorHandlers = [];
    this.snapshot = new Snapshot();
    var self = this;

    if (error === undefined) {
      error = defaultError;
    }

    for (var i = 0, len = chain.length; i < len; i++) {
      (function lexicalWrapper(index) {
        if (chain[index] instanceof Array) {
          log('Glom', index + '.) Assembling Glom...', options.debug);
          // Assemble the action with a Glom error chain
          actions.push(assembleAction(chain[index][0], index, errorMessages, options, signature, this));
          errorHandlers.push(new Glom(chain[index].slice(1), options, errorMessages));
        } else {
          log('Glom', index + '.) Assembling Action: ' + chain[index].prototype.constructor.name, options.debug);
          // Assemble a normal action
          actions.push(assembleAction(chain[index], index, errorMessages, options, signature, this));
          errorHandlers.push(error);
        }
      }(i));
    }

    if(options.parallel === true) {
      asyncMethod = parallellWaterfall;
    } else {
      asyncMethod = async.waterfall;
    }

    log('Glom', 'Start', options.debug);
    asyncMethod(actions, function glomComplete(errorObject) {
      log('Glom', 'Complete', options.debug);
      if (errorObject) {
        log('Glom::error', errorObject, options.debug);
        var errorHandler = errorHandlers[errorObject.chainIndex];
        if (errorHandler instanceof Glom) {
          log('Glom', 'Error Callback as Glom', options.debug);
          errorHandler.run(glom, error, error);
        } else {
          log('Glom', 'Error Callback', options.debug);
          errorHandler.call(self, glom, errorMessages);
        }
      } else {
        log('Glom', 'Exit', options.debug);
        done.call(self, glom, errorMessages);
      }
    });
  };
}

function parallellWaterfall(actions, done) {
  var completedActions = 0;
  var totalActions = actions.length;
  var actionCount = actions.length - 1;
  var debug = false;

  // Kickstart the initial action of the parallel chain
  actions[0](function firstParallelAction(err, glom) {
    for (var i = 1; i < totalActions; i++) {
      log('Glom::parallel::start', '(' + i + '/' + actionCount + ')', debug);
      (function parallelLexicalWrapper(index) {
        setTimeout(function nextTickWrapper() {
          actions[index](glom, function nextParallelAction() {
            completedActions += 1;
            log('Glom::parallel::done', '(' + completedActions + '/' + actionCount + ')', debug);
            if(completedActions === totalActions) {
              log('Glom::parallel', 'Exit');
              done(glom);
            }
          });
        });
      }(i));
    }
  });
}

/**
 * [parallel description]
 * @param  {[type]} chain   [description]
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Glom.parallel = function assembleParallel(chain, options) {
  if (options === undefined || options === null || Object.prototype.toString.call(options) !== '[object Object]') {
    options = defaultGlomOptions;
  }

  log('Glom::parallel', 'Assembling...', options.debug);
  return function processParallelGlom(glom, next) {
    log('Glom::parallel::processing', glom, options.debug);
    new Glom(chain, {
      debug: options.debug,
      parallel: true
    }).run(glom, function parallelDone(glom) {
      next(null, glom);
    }, function parallelError(glom, messages) {
      next(messages, glom);
    });
  };
};

module.exports = Glom;
