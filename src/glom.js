var async = require('async');
var Snapshot = require('./snapshot');

/**
 * 
 * @param  {Object}   input [description]
 * @param  {Function} next  [description]
 */
function createInitialAction (input, next) {
	return function initialAction () {
		next(input);
	}
}

/**
 * 
 * @param  {Function} action   [description]
 * @param  {Snapshot} snapshot [description]
 * @param  {Array}    errors   [description]
 * @return {Function}          [description]
 */
function assembleAction (action, snapshot, chainIndex, errors) {

	/**
	 * 
	 * @param  {Object}   glom [description]
	 * @param  {Function} next [description]
	 */
	return function actionHandler (glom, next) {
		try {
			action(glom, snapshot, function actionDone (newGlom) {
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
			}, function actionWarning (errorMessage) {
				// An non-critical warning has occured
				errors.push(errorMessage);
				next(glom);
			});
		} catch (e) {
			// A critical error has occured
			errors.push(e);
			next(null, {
				chainIndex: chainIndex,
				errors: errors
			});
		}
	};
}

function errorHandler () {

}

/**
 * 
 * @param {Object}   glom [description]
 * @param {Array}    chain [description]
 * @param {Function} done  [description]
 * @param {Function} error  [description]
 */
function Glom (glom, chain, done, error) {
	var actions = [createInitialAction(glom)];
	var snapshot = new Snapshot();
	var errorMessages = [];
	var errorHandlers = [];

	for (var i = 0, len = chain.length; i < len; i++) {
		(function lexicalWrapper (index) {
			if (chain[index] instanceof Array) {
				// Assemble the action with a Glom error chain
				var errorChain = [];
				for (var j = 1, jLen = chain[i].length; j < jLen; j++) {

				}
				// @TODO; Confirm this
				actions.push(assembleAction(chain[index].slice(0, 1), snapshot, index, errorMessages));
				errorHandlers.push(new Glom(glom, chain[index].slice(1), error, error));
			} else {
				// Assemble a normal action
				actions.push(assembleAction(chain[index], snapshot, index, errorMessages));
				errorHandlers.push(error);
			}
		}(i));
	}

	async.waterfall(actions, function glomComplete (errorObject) {
		if (errorMessages.length) {
			var errorHandler = errorHandlers[errorObject.chainIndex];
			if (errorHandler instanceof Glom) {
				// The 
			} else {
				errorHandlers[errorObject.chainIndex](errorMessages);
			}
		} else {
			done(glom);
		}
	})
}