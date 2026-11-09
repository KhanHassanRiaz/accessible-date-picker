(function () {
  var monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  var field = document.querySelector("[data-calendar-field]");
  var calendar = document.querySelector("[data-calendar]");
  if (!field || !calendar) return;

  var title = calendar.querySelector(".calendar-title");
  var grid = calendar.querySelector(".calendar-grid");
  var view = new Date(2026, 2, 1);

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function render() {
    var year = view.getFullYear();
    var month = view.getMonth();
    title.textContent = monthNames[month] + " " + year;
    grid.replaceChildren();
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (name) {
      var cell = document.createElement("span");
      cell.className = "weekday";
      cell.textContent = name;
      grid.append(cell);
    });
    var firstWeekday = new Date(year, month, 1).getDay();
    for (var blank = 0; blank < firstWeekday; blank += 1) {
      var empty = document.createElement("span");
      empty.className = "blank";
      grid.append(empty);
    }
    var days = new Date(year, month + 1, 0).getDate();
    for (var day = 1; day <= days; day += 1) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "day";
      button.textContent = String(day);
      button.setAttribute("data-date", year + "-" + pad(month + 1) + "-" + pad(day));
      button.addEventListener("click", function (event) {
        var iso = event.currentTarget.getAttribute("data-date");
        var parts = iso.split("-");
        field.value = parts[2] + "/" + parts[1] + "/" + parts[0];
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        calendar.hidden = true;
        field.focus();
      });
      grid.append(button);
    }
  }

  function show() {
    calendar.hidden = false;
    render();
  }

  function hide() {
    calendar.hidden = true;
  }

  field.addEventListener("focus", show);
  field.addEventListener("click", show);
  field.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hide();
  });

  calendar.querySelector(".calendar-prev").addEventListener("click", function () {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    render();
  });
  calendar.querySelector(".calendar-next").addEventListener("click", function () {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    render();
  });
  document.addEventListener("click", function (event) {
    if (event.target === field || calendar.contains(event.target)) return;
    hide();
  });

  render();
})();
