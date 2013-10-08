require("date-utils");
var _ = require("underscore");
var request = require("superagent");
var esclient = require("elasticsearchclient");
var queries = require("./queries");

var TYPES = ["courses", "documents", "schools", "students"];

// Initialize ES
var es = (function() {
  var opts = {
    host: "localhost",
    port: 9200
  };

  return new (esclient)(opts);
})();

var searchByAction = {
  courses: function(r) { 
    return {
      header: r._source.title+" - "+r._source.school.name,
      content: r._source.description.slice(0,200)+" ..."
    }
  },
  documents: function(r) { 
    return {
      header: r._source.title,
      content: r._source.content.slice(0,200)+" ...",
      owner: r._source.owner
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

es._filteredSearch = function(q, by, filters, callback) {
  var range_filters = ["courses.price", "courses.start_date"];
  var terms_filters = ["courses.school", "courses.categories"];

  var filter_queries = filters.map(function(f) {
    var filter = f[0];
    var query = JSON.parse(f[1]);

    // It's a range filter
    if(range_filters.indexOf(filter) > -1) {
      var ranges = query.map(function(r) {
        return JSON.parse(r);
      });

      filter = filter.split('.')[1];
      return queries[by].filters[filter](ranges);
    }
    // It's a terms filter
    if(terms_filters.indexOf(filter) > -1) {
      filter = filter.split('.')[1];
      return queries[by].filters[filter](query);
    }
  });

  filter_queries = filter_queries.map(function(or_filters) {
    return {
      "or": or_filters
    }
  });

  var match = queries[by].search(q);

  var query = {
    "query": {
      "filtered": {
        "query": match.query,
        "filter": {
          "and": filter_queries
        }
      }      
    },
    "facets": queries[by].facets
  };

  es.search("mwc_search_test", by, query, function(err, data) {
    var result = { "results": {}, "facets": {} };
    data = JSON.parse(data);
    result.results[by] = data.hits.hits.map(searchByAction[by]);
    result.facets[by] = data.facets;
    callback(result);
  });
};

es._multiSearch = function(q, searchBy, callback) {
  searchBy = searchBy ? searchBy.split(",") : [];

  var types = (function() {
    var _query = {};
    TYPES.forEach(function(type) {
      _query[type] = [
        { "index": "mwc_search_test", "type": type },
        queries[type].search(q, 10, true)
      ];
    });
    return _query;
  })();

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
      var data = { results: {}, facets: {} };

      var results = res.body.responses.map(function(result, i) {
        data.facets[searchBy[i]] = result.facets;
        return result.hits.hits;
      });

      searchBy.forEach(function(by, i) {
        data.results[by] = results[i].map(searchByAction[by]);
      });

      callback(data);
    });
};

es._autocomplete = function(q, searchBy, callback) {
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

module.exports = function(app) {

  function validateSearchBy(req, res, next) {
    if(!req.query.by) {
      next();
      return;
    }

    var bad = _.difference(
      req.query.by.split(","),
      TYPES
    );
    if(bad.length) {
      res.send(bad+" are not valid options", 400);
    } else {
      next();
    }
  }

  function filters(req, res, next) {
    var filters = [
      "courses.price", 
      "courses.start_date", 
      "courses.categories", 
      "courses.school"
    ];
    
    // Active filters (filters selected by user)
    req.filters = Object.keys(req.query).filter(function(p) {
      return filters.indexOf(p) > -1;
    })
    .map(function(f) {
      return [f, req.query[f]];
    });
    next();
  }

  function search(req, res, next) {
    var q = req.query.q;
    req.results = { results: {}, facets: {} };

    if(req.filters && req.filters.length) {
      es._filteredSearch(q, req.query.by, req.filters, function(data) {
        req.results = data;
        next();
      });
    } else {
      es._multiSearch(q, req.query.by, function(data) {
        req.results = data;
        next();
      });      
    }
  }

  // Render facets properly: only show relevant data
  function facets(req, res, next) {
    if(!req.results.facets) return next();

    function renderFacet(type, filter) {
      var facet_def = queries[type].facets[filter];
      var facet_result = req.results.facets[type][filter];

      // It's range facet
      if(facet_def.range) {
        var ranges = facet_def.range[filter];

        req.results.facets[type][filter] = facet_result.ranges.map(function(r, i) {
          var labeled = _.pick(r, "count");
          labeled.label = ranges[i].label;
          labeled.value = JSON.stringify([r.from, r.to]);
          return labeled;
        });

      // It's terms facet
      } else if(facet_def.terms) {
        req.results.facets[type][filter] = facet_result.terms;
      }      
    }

    Object.keys(req.results.facets).forEach(function(type, i) {
      for(var filter in req.results.facets[type]) {
        renderFacet(type, filter);
      }
    });

    next();
  }

  function locals(req, res, next) {
    req.locals = {};
    next();
  }

  // GET /
  app.get('/', locals, function(req, res) {
    res.render('index');
  });

  // GET /search/autocomplete
  app.get("/search/autocomplete", validateSearchBy, function(req, res) {
    es._autocomplete(req.query.q, req.query.by, function(data) {
      res.send(data);
    });
  });

  // GET /search
  app.get("/search", validateSearchBy, filters, search, facets, function(req, res) {
    res.send(req.results);
  });
};
