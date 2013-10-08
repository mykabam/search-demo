jQuery(function($) {

  var search_by = [];

  // Init events and stuff
  getSearchBy();
  $(".search-by .btn-primary").one("click", onDisableSearchBy);
  $(".search-by .btn-default").one("click", onEnableSearchBy);

  function getSearchBy() {
    var options = $(".search-by .btn-primary").toArray();
    search_by = options.length == 4 ?
      [] :
      options.map(function(el) {
        return $(el).text().trim().toLowerCase();
      });
  };

  // Click to disable a search-by option
  function onDisableSearchBy(e) {
    e.preventDefault();
    $(this).blur();

    if(search_by.length === 1) {
      $(this).one("click", onDisableSearchBy);
      alert("You have to keep at least one search-by option");
      return;
    }

    $(this).one("click", onEnableSearchBy);
    $(this).removeClass("btn-primary");
    $(this).addClass("btn-default");
    getSearchBy();
  }

  // Click to enable a search-by option
  function onEnableSearchBy(e) {
    e.preventDefault();
    $(this).blur();

    $(this).removeClass("btn-default");
    $(this).addClass("btn-primary");
    $(this).one("click", onDisableSearchBy);
    getSearchBy();
  }

  // Typeahead for autocomplete
  var by = function() {
    return (
      search_by.length ?
        "&by="+search_by.join(",") :
        ""
    );
  };

  $("#search").typeahead({
    name: "Search",
    remote: "/search/autocomplete?q=%QUERY"+by(),
    limit: 20
  });

  // When an option is selected
  $("#search").on("typeahead:selected", function(e) {
  });

  // Click on search button 
  $(".search-input .btn").click(function(e) {
    e.preventDefault();
    $(this).blur();

    var q = $("input#search").val();
    $.get("/search?q="+q+by(), function(data) {
      renderSearch(data.results);
      renderFacets(data);
    });
  });

  // Press Enter to search
  $(".search-input").keypress(function (e) {
    // e.preventDefault();
    if (e.which == 13) {
      $(".search-input .btn").click();
    }
  });

  function filteredSearch(doctype) {
    var checked = [];
    var filters = {};
    $(".facet-item input[type=checkbox]:checked").each(function() {
      var type = $(this).attr("doctype");
      var filter = $(this).attr("filter");
      var type_filter = type+"."+filter;
      var val = $(this).val();
      // Keep track of the checked filters
      checked.push(val);
      
      filters[type_filter] ? 
        filters[type_filter].push(val) : 
        eval("filters['"+type_filter+"'] = ['"+val+"']");
    });

    var query = (function() {
      return Object.keys(filters).map(function(f) {
        return f+"="+JSON.stringify(filters[f]).replace(/\&/, "__and__");
      }).join("&");
    })();

    query = encodeURI(query);

    var q = $("input#search").val();
    var url = "/search?q="+q+"&by="+doctype+"&"+query;

    $.get(url, function(data) {
      renderSearch(data.results);
      renderFacets(data);
      // Recover state of checked filters
      checked.forEach(function(check) {
        $("input[value='"+check+"']").attr("checked", true);
      });
    });
  }

  // Render search results
  function renderSearch(results) {
    $(".results .panel").addClass("hide");
    $(".list-group-item:not(.layout)").remove();

    for(var by in results) {
      if(!results[by].length) { continue; }
      
      var $panel = $("."+by+"-results");
      $panel.find(".panel-heading .badge").text(results[by].length);

      results[by].forEach(function(r) {
        var $item = $panel.find(".list-group-item.layout").clone();
        $item.removeClass("layout");
        $item.find("h5").text(r.header);
        $item.find(".list-group-item-text").text(r.content||"");
        $item.find(".filters .start_date_value").text(r.start_date);
        $item.find(".filters .price_value").text("$"+r.price);
        $item.find(".filters .categories_value").text(r.categories);
        $panel.find(".list-group").append($item);
      });

      $panel.removeClass("hide");
    }
  }

  function renderFacets(data) {
    var facets = data.facets;

    $(".facet-item:not(.layout)").remove();

    for(var type in facets) {
      var $panel = $(".panel."+type+"_facets");
      $panel.addClass("hide");

      if(!data.results[type].length) { break; }

      $panel.removeClass("hide");

      for(var filter in facets[type]) {  
        facets[type][filter].forEach(function(item) {
          var $ul = $panel.find("ul."+filter);
          var $item = $ul.find("li.layout").clone();
          $item.removeClass("layout");
          $item.find(".f_label").text(item.label||item.term);
          $item.find(".count").text("("+item.count+")");
          $item.find("input[type=checkbox]")
            .attr("value", (function() {
              return item.value||item.term;
            })())
            .attr("doctype", type)
            .attr("filter", filter);
          $ul.append($item);
        });
      }
    }

    $("input[type=checkbox]").on("change", function(e) {
      filteredSearch($(this).attr("doctype"));
    });
  }

  // Fix styling
  setTimeout(function() {
    $(".twitter-typeahead").removeAttr("style");
    $(".tt-hint").hide();
  }, 200);

});