jQuery(function($) {
  $("#search").typeahead({
    name: "Search",
    remote: "/search?q=%QUERY",
    limit: 20
  });

  // Fix styling
  setTimeout(function() {
    $(".twitter-typeahead").removeAttr("style");
    $(".tt-hint").hide();
  }, 200);

});