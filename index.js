/**
 * Module dependencies.
 */

var redis = require('redis')
  , noop = function () {};

/**
 * Export `RedisStore`.
 */

module.exports = RedisStore;

/**
 * RedisStore constructor.
 *
 * @param {Object} options
 * @param {Bucket} bucket
 * @api public
 */

function RedisStore(options, bucket) {
  options = options || {};
  this.bucket = bucket || {};
  this.client = options.client || new redis.createClient(options.port, options.host, options);
  if (options.password) {
    this.client.auth(options.password, function auth(err){
      if (err) throw err;
    });
  }
  if (options.database) {
    this.client.select(options.database, function select(err){
      if (err) throw err;
    });
  }
  if (options.clear_cache_on_connect) {
    this.clear(function clear(err) {
      if (err) throw err;
    });
  }
}

/**
 * Get an entry.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.get = function get(key, fn) {
  fn = fn || noop;
  this.client.get(key, function getter(err, data){
    if (err) return fn(err);
    if (!data) return fn(null, null);
    data = data.toString();
    try {
      fn(null, JSON.parse(data));
    } catch (e) {
      fn(e);
    }
  });
};

/**
 * Set an entry.
 *
 * @param {String} key
 * @param {Mixed} val
 * @param {Number} ttl
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.set = RedisStore.prototype.put = function set(key, val, ttl, fn) {
  if ('function' === typeof ttl) {
    fn = ttl;
    ttl = null;
  }

  fn = fn || noop;

  try {
    var callback = function (err) {
      if (err) return fn(err);
      fn(null, val);
    }

    if (ttl) {
      this.client.setex(key, 60, JSON.stringify(val), callback);
    } else {
      this.client.set(key, JSON.stringify(val), callback);
    }
  } catch (e) {
    fn(e);
  }
};

/**
 * Delete an entry.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.del = function del(key, fn) {
  fn = fn || noop;
  this.client.del(key, fn);
};

/**
 * Clear all entries for this bucket.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.clear = function clear(key, fn) {
  var store = this;

  if ('function' === typeof key) {
    fn = key;
    key = null;
  }

  fn = fn || noop;
  
  if (key) {
    store.client.keys(key + '*', function keys(err, data) {
      if (err) return fn(err);
      var count = data.length;
      data.forEach(function each(key) {
        store.del(key, function del(err, data) {
          if (err) {
            count = 0;
            return fn(err);
          }
          if (--count == 0) {
            fn(null, null);
          }
        });
      });
    });
  } else {
    store.client.flushall(function (err, didSucceed) {
      if (err) return fn(err);
      fn(null, didSucceed);
    })
  }
};
