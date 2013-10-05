var _ = require("underscore");
var request = require("superagent");
var esclient = require('elasticsearchclient');

// Initialize ES
var es = (function() {
  var opts = {
    host: 'localhost',
    port: 9200
  };

  return new (esclient)(opts);
})();

var multiMatchPhrasePrefix = function(query) {
  return {
    "size": "100",
    "query": {
      "multi_match": {
       "fields": ["description", "title^2", "name^2", "content"],
       "type": "phrase_prefix",
       "query": query
      }
    },
    "facets": {
      "blah": {
        "terms": {
          "field": "school.name",
          "size": "400"
        }
      }
    }
  }
};

var edgeNGramAnalyzed = function() {
  return {
    "size": "100",
    "query": {

    }
  }
};

var multiSearch = function(q, searchBy, callback) {
  var types = {
    "courses": [
      { "index": "mwc_search_test", "type": "courses" },
      { "query":
        {
          "multi_match": {
            "fields": ["title^2", "description"],
            "type": "phrase_prefix",
            "query": q
          }
        },
        "size" : 10
      }
    ],
    "documents": [
      { "index": "mwc_search_test", "type": "documents" },
      { "query": {
          "multi_match" : {
            "fields": ["title^2", "content"],
            "type": "phrase_prefix",
            "query": q
          }
        },
        "size" : 10
      }
    ],
    "students": [
      { "index": "mwc_search_test", "type": "students" },
      { "query": {
          "match_phrase_prefix" : {
            "name": {
              "type": "phrase_prefix",
              "query": q
            }
          }
        },
        "size" : 10
      }
    ],
    "schools": [
      { "index": "mwc_search_test", "type": "schools" },
      { "query": {
          "match_phrase_prefix" : {
            "name": {
              "type": "phrase_prefix",
              "query": q
            }
          }
        },
        "size" : 10
      }
    ]
  };

  var searchByAction = {
    courses: function(r) {
      return {
        header: r._source.title,
        content: r._source.description.slice(0,200)+" ..."
      }
    },
    documents: function(r) {
      return {
        header: r._source.title,
        content: r._source.content.slice(0,200)+" ..."
      }
    },
    schools: function(r) {
      return {
        header: r._source.name
      }
    },
    students: function(r) {
      return {
        header: r._source.name
      }
    }
  };

  var query = [];
  if(!searchBy.length) searchBy = Object.keys(types);
  searchBy.sort();

  searchBy.forEach(function(by) {
    query = query.concat(types[by]);
  });

  query = query.map(function(q) { return JSON.stringify(q) });
  query = query.join("\n")+"\n";

  request
    .post("http://localhost:9200/mwc_search_test/_msearch")
    .send(query)
    .set('Accept', 'application/json')
    .end(function(err, res) {
      var results = res.body.responses.map(function(h) {
        return h.hits.hits;
      });

      var data = {};

      searchBy.forEach(function(by, i) {
        data[by] = results[i].map(searchByAction[by]);
      });

      callback(data);
    });
};

var autocomplete = function(q, searchBy, callback) {
  var query = multiMatchPhrasePrefix(q);

  function autocompleteCallback(err, data) {
    callback(JSON.parse(data).hits.hits.map(function(doc) {
      return doc._source.title||doc._source.name;
    }));
  }

  searchBy ?
    es.search("mwc_search_test", searchBy, query, autocompleteCallback) :
    es.search("mwc_search_test", query, autocompleteCallback);
};

var search = function(q, searchBy, callback) {
  var by = searchBy ? searchBy.split(",") : [];
  multiSearch(q, by, function(data) {
    callback(data);
  });
};

module.exports = function(app) {
  function validateSearchBy(req, res, next) {
    if(!req.query.by) {
      next();
      return;
    }

    var bad = _.difference(
      req.query.by.split(","),
      ["courses", "documents", "schools", "students"]
    );
    if(bad.length) {
      res.send(bad+" are not valid options", 400);
    } else {
      next();
    }
  }

  app.get("/search/autocomplete", validateSearchBy, function(req, res) {
    autocomplete(req.query.q, req.query.by, function(data) {
      if (req.query.callback) {
        res.send(req.query.callback + '(' + JSON.stringify(data) + ');');
      } else {
        res.send(data);
      }
    });
  });

  app.get("/search", validateSearchBy, function(req, res) {
    search(req.query.q, req.query.by, function(data) {
      if (req.query.callback) {
        res.send(req.query.callback + '(' + JSON.stringify(data) + ');');
      } else {
        res.send(data);
      }
    });
  });
};
