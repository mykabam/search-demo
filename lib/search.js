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
       "fields": ["description", "title^2", "name^2"],
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

module.exports = function(app) {
  app.get("/search", function(req, res) {
    search(req.query.q, function(data) {
      console.log(data);
      res.send(data);
    });
  });
  
  var search = function(q, callback) {
    var query = multiMatchPhrasePrefix(q);
    es.search("mwc_search_test", query, function(err, data) {
      callback(JSON.parse(data).hits.hits.map(function(doc) {
        return doc._source.title||doc._source.name;
      }));
    });
  };
};
