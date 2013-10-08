// This module is the _only_ in charge of writing in ES DSL
var Utils = {
  Date: {
    startOfWeek: function(date) {
      var d = new Date(date.getTime()); 
      ["Hours", "Minutes", "Seconds", "Milliseconds"].forEach(function(t) {
        d["setUTC"+t](0);
      });
      d.addDays(-d.getUTCDay());
      return d;
    },
    endOfWeek: function(date) {
      var d = new Date(date.getTime());
      [["Hours", 23], ["Minutes", 59], ["Seconds", 59]].forEach(function(t) {
        d["setUTC"+t[0]](t[1]);
      });
      d.addDays(6-d.getUTCDay());
      return d;
    },
    nextWeek: function(date) {
      var d = new Date(date.getTime()); 
      d.addDays(7);
      return d;
    }
  }
};

var e;
module.exports = e = {
  // Courses
  "courses": {
    "search": function(q, size, facets) { 
      return {
        "query": { 
          "multi_match": {
            "fields": ["title^2", "description"],
            "type": "phrase_prefix",
            "query": q
          } 
        }, 
        "size" : size,
        "facets": facets ? e.courses.facets : {}
      }
    },

    "filters": {
      "start_date": function(dates) {
        return dates.map(function(d) {
          return {
            "range": {
              "start_date": {
                // 'to', 'from' deprecated as of 0.90.4
                "from": d[0]||0,
                "to": d[1]||0
              }
            }
          };
        });
      },

      "categories": function(categories) {
        return categories.map(function(cat) {
          return {
            "term": { "categories": cat.replace(/__and__/, "&") }
          };
        });
      },

      "price": function(prices) {
        return prices.map(function(price) {
          return {
            "numeric_range": {
              "price": {
                // 'to', 'from' deprecated as of 0.90.4
                "from": price[0]||0,
                "to": price[1]||0
              }
            }
          };
        });
      },

      "school": function(schools) {
        return schools.map(function(school) {
          return {
            "term": { "schools.name": school }
          }
        });
      }
    },

    // Facets for courses: start_date, categories, prices, schools
    "facets": {
      "start_date": (function() {
        var date = (new Date()).addDays(-7);
        lastWeekFrom = Utils.Date.startOfWeek(date);
        lastWeekTo = Utils.Date.endOfWeek(lastWeekFrom);
        thisWeekTo = Utils.Date.nextWeek(lastWeekTo);
        thisWeekFrom = Utils.Date.startOfWeek(thisWeekTo);
        nextWeekFrom = Utils.Date.nextWeek(thisWeekFrom);
        nextWeekTo = Utils.Date.endOfWeek(nextWeekFrom);
        within2WeeksTo = Utils.Date.nextWeek(nextWeekTo);
        within2WeeksFrom = Utils.Date.startOfWeek(within2WeeksTo);
        within3WeeksFrom = Utils.Date.nextWeek(within2WeeksFrom);
        within3WeeksTo = Utils.Date.endOfWeek(within3WeeksFrom);

        return {
          "range": {
            "start_date": [
              // Last week
              { "label": "Last week", "from": lastWeekFrom, "to": lastWeekTo },
              // This week
              { "label": "This week", "from": thisWeekFrom, "to": thisWeekTo },
              // Next week
              { "label": "Next week", "from": nextWeekFrom, "to": nextWeekTo },
              // Within 2 weeks
              { "label": "Within 2 weeks", "from": within2WeeksFrom, "to": within2WeeksTo },
              // Within 3 weeks
              { "label": "within 3 weeks", "from": within3WeeksFrom, "to": within3WeeksTo }
            ],
            "size": 50
          }
        };
      })(), // start date
      "price": {
        "range": {
          "price": [
            { "label": "Free", "to": 0 },
            { "label": "Up to $200", "from": 0, "to": 199 },
            { "label": "$200 - $300", "from": 200, "to": 299 },
            { "label": "$300 - $500", "from": 300, "to": 499 },
            { "label": "$500 - $800", "from": 500, "to": 799 },
            { "label": "$800 - $1400", "from": 800, "to": 1399 },
            { "label": "$1400+", "from": 1400 }
          ],
          "size": 50
        },
      }, // price
      "categories": {
        "terms": {
          "field": "categories",
          "size": 50
        }
      }, // categories
      "school": {
        "terms": {
          "field": "school.name",
          "size": 50
        }
      } // school
    }, // facets
  }, // courses

  // Documents
  "documents": {
    "search": function(q, size) {
      return { "query": { 
          "multi_match" : {
            "fields": ["title^2", "content"],
            "type": "phrase_prefix",
            "query": q
          } 
        },
        "size" : size
      };
    }
  },

  // Schools
  "schools": {
    "search": function(q, size) {
      return { "query": { 
          "match_phrase_prefix" : {
            "name": {
              "type": "phrase_prefix",
              "query": q
            } 
          }
        },
        "size" : size
      };
    }
  },

  // Students
  "students": {
    "search": function(q, size) {
      return { "query": { 
          "match_phrase_prefix" : {
            "name": {
              "type": "phrase_prefix",
              "query": q
            } 
          }
        },
        "size" : size
      };
    }
  }
};