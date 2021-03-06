var test = require('tape');
var SimpleError = require('..');

var ApiError = SimpleError.define('ApiError', {
  code: 5005,
  statusCode: 500,
  message: 'api error',
  methods: {
    hello: function () {
      return 'elo: ' + this.message;
    }
  }
});

var NotFoundError = ApiError.define('NotFoundError', {
  code: 4004,
  statusCode: 404,
  message: 'not found',
  methods: {
    notFound: function () {
      return 'nowhere to be found';
    }
  }
});

var ErrorWithCtor = ApiError.define('ErrorWithCtor', {
  code: 0,
	message: '',
  ctor: function(message, opts) {
		if (message) {
			this.message = message;
		}
    if (opts) {
      if (opts.code) {
        this.code = opts.code;
      }
      if (opts.statusCode) {
        this.statusCode = opts.statusCode;
      }
    }
  }
});

var ApiErrorWithExclude = SimpleError.define('ApiErrorWithExclude', {
  code: 5005,
  statusCode: 505,
  message: 'api error',
  exclude: ['qs']
});

var ErrorWithExcludeProps = ApiErrorWithExclude.define('ErrorWithExcludeProps', {
  exclude: ['message', 'customInt']
});


var doesNotIncludeReservedProperties = function (t, err) {
  ['isError', 'exclude', 'showStack', 'ctor', 'methods'].forEach(function (prop) {
    t.notOk(err[prop], 'does not include ['+prop+']');
  });
};

test('api error', function (t) {
  var err = new ApiError();

  t.equal(err.code, 5005);
  t.equal(err.statusCode, 500);
  t.equal(err.message, 'api error');

  t.ok(err instanceof Error);
  t.ok(err instanceof ApiError);

  t.equal(err.hello(), 'elo: api error');

  t.end();
});

test('not found error', function (t) {
  var err = new NotFoundError();

  t.equal(err.code, 4004);
  t.equal(err.statusCode, 404);
  t.equal(err.message, 'not found');

  t.equal(NotFoundError._type, 'NotFoundError', 'constructor type should be equal');
  t.equal(NotFoundError._name, 'NotFoundError', 'constructor name should be equal');
  t.ok(err instanceof Error);
  t.ok(err instanceof ApiError);
  t.ok(err instanceof NotFoundError);

  t.equal(err.hello(), 'elo: not found');
  t.equal(err.notFound(), 'nowhere to be found');

  t.end();
});

test('should allow to define suberror with only name given', function (t) {
  var EmptyError = ApiError.define('EmptyError');
  var err = new EmptyError();
  t.equal(err.name, 'EmptyError');
  t.end();
});

test('should throw if no error name given', function (t) {
  t.throws(function () {
    ApiError.define({});
  }, Error);
  t.end();
});

test('should throw if given name is empty', function (t) {
  t.throws(function () {
    ApiError.define('', {});
  }, Error);
  t.end();
});

test('should override constructor args', function (t) {
	var error = new ErrorWithCtor(null, { statusCode: 200, code: 2014 });
	t.equal(error.code, 2014);
	t.equal(error.statusCode, 200);
	t.end();
});

test('should be possible to set message in conjunction with ctor', function (t) {
	var error = new ErrorWithCtor('my message', {statusCode: 200, code: 2014 });
	t.equal(error.message, 'my message');
	t.end();
});

test('should exclude props defined in parent', function (t) {
	var ParentError = SimpleError.define('ParentError', {
		exclude: ['foo', 'bar']
	});

	var ChildError = ParentError.define('ChildError', {
		ctor: function (foo, bar) {
			this.foo = foo;
			this.bar = bar;
		}
	});

	var friendly = new ChildError('foo', 'bar').friendly();
	['foo', 'bar'].forEach(function (prop) {
		t.notOk(friendly[prop]);
	});

  doesNotIncludeReservedProperties(t, friendly);

  t.equal(friendly.success, false, 'Success should be false');
	t.end();
});

test('excluded properties with inheritence', function (t) {
  var err = new ErrorWithExcludeProps();
  err.customMessage = 'message2';
  err.qs = '?foo=bar';
  err.customInt = 2;
  var friendly = err.friendly();
  t.notOk('qs' in friendly);
  t.notOk('message' in friendly);
  t.notOk('customInt' in friendly);
  t.equal(friendly.code, 5005);
  t.equal(friendly.statusCode, 505);
  t.equal(friendly.customMessage, 'message2');
  t.equal(friendly.success, false, 'Success should be false');

  doesNotIncludeReservedProperties(t, friendly);

  t.end();
});

test('excluded properties with inheritence in two layers', function (t) {
  var NewError = ErrorWithExcludeProps.define('NewError', {
    exclude: ['customString']
  });

  var err = new NewError();
  err.customString = 'Should be excluded';
  err.customString2 = 'Should be included';

  var friendly = err.friendly();
  t.equal(friendly.statusCode, 505);
  t.notOk('message' in friendly);
  t.notOk('customString' in friendly);
  t.equal(friendly.code, 5005);
  t.equal(friendly.success, false, 'Success should be false');
  t.equal(friendly.customString2, 'Should be included');
  t.ok(err instanceof Error);
  t.ok(err instanceof ApiErrorWithExclude);
  t.ok(err instanceof ErrorWithExcludeProps);
  t.ok(err instanceof NewError);

  doesNotIncludeReservedProperties(t, friendly);

  t.end();
});

test('code and statusCode should be inherited', function (t) {
  var ParentError = SimpleError.define('ParentError', {
    code: 1,
    statusCode: 400,
    message: 'Parent error'
  });

  var ChildError = ParentError.define('ChildError', {
    code: 2,
    statusCode: 404
  });

  var err = new ChildError();

  t.equal(err.code, 2);
  t.equal(err.statusCode, 404);
  t.equal(err.message, 'Parent error')

  t.end();
});

test('properties set on parent should be inherited', function (t) {
  var ParentError = SimpleError.define('ParentError', {
    code: 1,
    statusCode: 400,
    message: 'Parent error',
    description: 'hello'
  });

  var ChildError = ParentError.define('ChildError', {
    code: 2,
    statusCode: 404
  });

  var err = new ChildError();

  t.equal(err.code, 2);
  t.equal(err.statusCode, 404);
  t.equal(err.message, 'Parent error')
  t.equal(err.description, 'hello')

  t.end();
});
