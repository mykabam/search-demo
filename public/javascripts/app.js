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
  $("#search").on("typeahead:selected", function(e, a) {
    console.log(e);
    console.log(a);
    console.log("here");
  });

  // Click on search button 
  $(".search-input .btn").click(function(e) {
    e.preventDefault();
    $(this).blur();

    var q = $("input#search").val();
    $.get("/search?q="+q+by(), function(data) {
      renderSearch(data);
    });
  });

  // Render search results
  function renderSearch(data) {
    $(".results .panel").addClass("hide");
    $(".list-group-item:not(.layout)").remove();

    for(var by in data) {
      var $panel = $("."+by+"-results");
      $panel.find(".panel-heading .badge").text(data[by].length);

      data[by].forEach(function(r) {
        var $item = $panel.find(".list-group-item.layout").clone();
        $item.removeClass("layout");
        $item.find("h5").text(r);
        $panel.find(".list-group").append($item);
      });

      $panel.removeClass("hide");
    }
  }

  // Fix styling
  setTimeout(function() {
    $(".twitter-typeahead").removeAttr("style");
    $(".tt-hint").hide();
  }, 200);

});