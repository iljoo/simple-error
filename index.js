'use strict';
var assert = require('assert');
var util = require('util');
var NON_JSON_PROPS = ['isError'];

var copyMethodsToPrototype = function (ctor, methods) {
  if (methods) {
    Object.keys(methods).forEach(function (m) {
      ctor.prototype[m] = methods[m];
    });
  }
};

var extractArgs = function(name, opts) {
  assert.ok(name, 'Error name is required');
  assert.ok(typeof(name) === 'string', 'Error name must be a string');

  return { name: name.trim(), opts: opts };
};

var SimpleError = module.exports = {};

SimpleError.isError = function (error) {
  return (error instanceof Error);
};

SimpleError.define = function (name, opts) {
  var args = extractArgs(name, opts);
  name = args.name;
  opts = args.opts;

  var code = 0,
    statusCode = 500,
    showStack = false,
    messageFormatString,
    excludedProps = [],
    ctor;

  if (opts) {
    code = opts.code || code;
    statusCode = opts.statusCode || statusCode;
    messageFormatString = opts.message;
    showStack = opts.showStack || showStack;
    excludedProps = NON_JSON_PROPS.concat(opts.exclude || []);
    if (opts.ctor && typeof opts.ctor === 'function') {
      ctor = opts.ctor;
    }
  }

  function Constructor() {
    var args = [].slice.call(arguments);

    Error.captureStackTrace(this, this.constructor);

    this.name = this.type = name;
    this.code = code;
    this.statusCode = statusCode;
    this.isError = true;

    if (ctor) {
      this.message = messageFormatString || 'Unknown';
      ctor.apply(this, args);
    } else {
      if (messageFormatString) {
        args.unshift(messageFormatString);
      }
      this.message = args.length ? util.format.apply(null, args) : 'Unknown';
    }
  }

  Constructor.prototype = Object.create(Error.prototype);

  Constructor.prototype.toJSON = function toJSON() {
    return JSON.stringify(this.friendly());
  };

  Constructor.prototype.friendly = function friendly() {
    var result = { success: false };

    var iterator = this;

    if (Constructor.super_ && Constructor.super_.prototype.friendly){
      iterator = Constructor.super_.prototype.friendly.apply(this);
    }

    Object.keys(iterator)
      .filter(function (prop) {
        return excludedProps.indexOf(prop) === -1;
      })
      .forEach(function (prop) {
        result[prop] = this[prop];
      }.bind(this));

    if (showStack) {
      result.stack = this.stack;
    }

    result.success = false;
    return result;
  };

  Constructor.wrap = function (error) {
    var err = new Constructor();

    Object.keys(error).forEach(function (prop) {
      if (prop !== 'name' && prop !== 'type') {
        err[prop] = error[prop];
      }
    });
    if (error.message) {
      err.message = error.message;
    }
    err.inner = error;

    return err;
  };

  Constructor.define = function (name, opts) {
    var args = extractArgs(name, opts);
    name = args.name;
    opts = args.opts || {};

    var Child = SimpleError.define(name, opts);
    var friendly = Child.prototype.friendly;
    util.inherits(Child, Constructor);
    copyMethodsToPrototype(Child, opts.methods);
    Child.prototype.friendly = friendly;

    return Child;
  };

  copyMethodsToPrototype(Constructor, (opts || {}).methods);

  return Constructor;
};
