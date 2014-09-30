'use strict';

/*jshint node:true */

var assert = require('assert');
var util = require('util');
var NON_JSON_PROPS = ['isError', 'exclude', 'showStack'];

var copyMethodsToPrototype = function (ctor, methods) {
  if (methods) {
    Object.keys(methods).forEach(function (m) {
      ctor.prototype[m] = methods[m];
    });
  }
};

var ErrorConstructor = function(Constructor, name, opts, args) {
  this.name = this.type = name;
  this.code = opts.code || 0;
  this.statusCode = opts.statusCode || 500;
  this.isError = true;
  this.showStack = opts.showStack || false;

  copyMethodsToPrototype(Constructor, opts.methods);

  if (opts.ctor) {
    this.message = opts.message || 'Unknown';
    opts.ctor.apply(this, args);
  } else {
    if (opts.message) {
      args.unshift(opts.message);
    }
    this.message = args.length ? util.format.apply(null, args) : 'Unknown';
  }
  if (this.ctor) this.ctor.apply(this, arguments);

  Error.captureStackTrace(this, this.constructor);
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
  var args = extractArgs(name, opts || {});
  name = args.name;
  opts = args.opts;

  function BaseError() {
    ErrorConstructor.call(this, BaseError, name, opts, [].slice.call(arguments));
    this.exclude = NON_JSON_PROPS.concat(opts.exclude || []);
  }

  BaseError.prototype = Object.create(Error.prototype);
  BaseError.prototype.constructor = BaseError;

  BaseError.prototype.toJSON = function toJSON() {
    return JSON.stringify(this.friendly());
  };

  BaseError.prototype.friendly = function friendly() {
    var result = { success: false };
    var self = this;

    Object.keys(self)
      .filter(function (prop) {
        return self.exclude.indexOf(prop) === -1;
      })
      .forEach(function (prop) {
        result[prop] = self[prop];
      });

    if (self.showStack) {
      result.stack = self.stack;
    }

    return result;
  };

  BaseError.wrap = function (error) {
    var err = new BaseError();

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

  BaseError.define = function (name, opts) {
    var args = extractArgs(name, opts);
    name = args.name;
    opts = args.opts || {};
    var parent = this;

    function ChildError(){
      var args = [].slice.call(arguments);

      parent.apply(this, arguments);
      ErrorConstructor.call(this, BaseError, name, opts, args);

      this.exclude = this.exclude.concat(opts.exclude || []);
    }

    ChildError.prototype = Object.create(parent.prototype);
    ChildError.prototype.constructor = ChildError;
    ChildError.define = BaseError.define;

    return ChildError;
  };

  return BaseError;
};
