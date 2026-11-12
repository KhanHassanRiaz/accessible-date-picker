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
  var weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var field = document.querySelector(".date-row input[type='text']");
  var button = document.querySelector(".ajax__calendar_button");
  var calendar = document.querySelector(".ajax__calendar");
  if (!field || !button || !calendar) return;

  var title = calendar.querySelector(".ajax__calendar_title");
  var prev = calendar.querySelector(".ajax__calendar_prev");
  var next = calendar.querySelector(".ajax__calendar_next");
  var daysView = calendar.querySelector(".ajax__calendar_days");
  var monthsView = calendar.querySelector(".ajax__calendar_months");
  var yearsView = calendar.querySelector(".ajax__calendar_years");
  var todayButton = calendar.querySelector(".ajax__calendar_today");

  var params = new URLSearchParams(window.location.search);
  var min = parseIsoDay(params.get("min")) || new Date(1900, 0, 1);
  var max = parseIsoDay(params.get("max")) || new Date(2099, 11, 31);
  var mode = "days";
  var selectedDate = parseFieldValue(field.value);
  var visibleDate = selectedDate ? cloneDate(selectedDate) : new Date(2026, 0, 25);

  function cloneDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDay(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function parseIsoDay(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function parseFieldValue(value) {
    var match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;
    return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  }

  function inRange(date) {
    return date >= min && date <= max;
  }

  function longDate(date) {
    return (
      weekdayNames[date.getDay()] +
      ", " +
      monthNames[date.getMonth()] +
      " " +
      date.getDate() +
      ", " +
      date.getFullYear()
    );
  }

  function writeDate(date) {
    selectedDate = cloneDate(date);
    visibleDate = cloneDate(date);
    field.value = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    hide();
  }

  function viewTop(active) {
    return active ? "0px" : "139px";
  }

  function renderDays() {
    var year = visibleDate.getFullYear();
    var month = visibleDate.getMonth();
    daysView.replaceChildren();

    var table = document.createElement("table");
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (name) {
      var cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = name;
      headRow.append(cell);
    });
    head.append(headRow);
    table.append(head);

    var body = document.createElement("tbody");
    var start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    for (var week = 0; week < 6; week += 1) {
      var row = document.createElement("tr");
      for (var weekday = 0; weekday < 7; weekday += 1) {
        var date = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + week * 7 + weekday,
        );
        var td = document.createElement("td");
        var cell = document.createElement("div");
        cell.className = "ajax__calendar_day";
        cell.textContent = String(date.getDate());
        cell.title = longDate(date);
        td.append(cell);

        if (date.getMonth() !== month) td.classList.add("ajax__calendar_other");
        else if (!inRange(date)) td.classList.add("ajax__calendar_invalid");
        else if (selectedDate && sameDay(date, selectedDate))
          td.classList.add("ajax__calendar_active");

        if (inRange(date) && date.getMonth() === month) {
          td.addEventListener("click", function (event) {
            event.preventDefault();
            var chosen = event.currentTarget.querySelector(".ajax__calendar_day");
            var chosenDate = parseLongDate(chosen && chosen.title);
            if (chosenDate && inRange(chosenDate)) writeDate(chosenDate);
          });
        }
        row.append(td);
      }
      body.append(row);
    }
    table.append(body);
    daysView.append(table);
  }

  function parseLongDate(value) {
    if (!value) return null;
    var match = new RegExp("(" + monthNames.join("|") + ")\\s+(\\d{1,2}),\\s*(\\d{4})").exec(value);
    if (!match) return null;
    return new Date(Number(match[3]), monthNames.indexOf(match[1]), Number(match[2]));
  }

  function renderMonths() {
    monthsView.replaceChildren();

    var table = document.createElement("table");
    var body = document.createElement("tbody");
    for (var rowIndex = 0; rowIndex < 4; rowIndex += 1) {
      var row = document.createElement("tr");
      for (var column = 0; column < 3; column += 1) {
        var month = rowIndex * 3 + column;
        var td = document.createElement("td");
        var cell = document.createElement("div");
        cell.className = "ajax__calendar_month";
        cell.textContent = monthNames[month];
        cell.setAttribute("data-month", String(month + 1));
        td.append(cell);
        td.addEventListener("click", function (event) {
          event.preventDefault();
          var chosen = Number(
            event.currentTarget.querySelector(".ajax__calendar_month").dataset.month,
          );
          visibleDate = new Date(visibleDate.getFullYear(), chosen - 1, 1);
          mode = "days";
          render();
        });
        row.append(td);
      }
      body.append(row);
    }
    table.append(body);
    monthsView.append(table);
  }

  function renderYears() {
    var first = Math.floor(visibleDate.getFullYear() / 10) * 10;
    yearsView.replaceChildren();

    var table = document.createElement("table");
    var body = document.createElement("tbody");
    for (var rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      var row = document.createElement("tr");
      for (var column = 0; column < 5; column += 1) {
        var year = first + rowIndex * 5 + column;
        var td = document.createElement("td");
        var cell = document.createElement("div");
        cell.className = "ajax__calendar_year";
        cell.textContent = String(year);
        cell.setAttribute("data-year", String(year));
        td.append(cell);
        td.addEventListener("click", function (event) {
          event.preventDefault();
          var chosen = Number(
            event.currentTarget.querySelector(".ajax__calendar_year").dataset.year,
          );
          visibleDate = new Date(chosen, visibleDate.getMonth(), 1);
          mode = "months";
          render();
        });
        row.append(td);
      }
      body.append(row);
    }
    table.append(body);
    yearsView.append(table);
  }

  function render() {
    renderDays();
    renderMonths();
    renderYears();
    var year = visibleDate.getFullYear();
    if (mode === "days") {
      title.textContent = monthNames[visibleDate.getMonth()] + " " + year;
    } else if (mode === "months") {
      title.textContent = String(year);
    } else {
      var first = Math.floor(year / 10) * 10;
      title.textContent = first + "-" + (first + 9);
    }
    daysView.style.top = viewTop(mode === "days");
    monthsView.style.top = viewTop(mode === "months");
    yearsView.style.top = viewTop(mode === "years");
  }

  function show() {
    if (selectedDate) visibleDate = cloneDate(selectedDate);
    mode = "days";
    render();
    calendar.hidden = false;
  }

  function hide() {
    calendar.hidden = true;
  }

  button.addEventListener("click", function (event) {
    event.preventDefault();
    if (calendar.hidden) show();
    else hide();
  });
  field.addEventListener("click", function (event) {
    event.preventDefault();
  });

  title.addEventListener("click", function (event) {
    event.preventDefault();
    if (mode === "days") mode = "months";
    else if (mode === "months") mode = "years";
    render();
  });

  prev.addEventListener("click", function (event) {
    event.preventDefault();
    if (mode === "days")
      visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
    else if (mode === "months") visibleDate = new Date(visibleDate.getFullYear() - 1, 0, 1);
    else visibleDate = new Date(visibleDate.getFullYear() - 10, 0, 1);
    render();
  });

  next.addEventListener("click", function (event) {
    event.preventDefault();
    if (mode === "days")
      visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
    else if (mode === "months") visibleDate = new Date(visibleDate.getFullYear() + 1, 0, 1);
    else visibleDate = new Date(visibleDate.getFullYear() + 10, 0, 1);
    render();
  });

  if (todayButton) {
    todayButton.addEventListener("click", function (event) {
      event.preventDefault();
      var today = new Date();
      if (inRange(today)) {
        visibleDate = cloneDate(today);
        mode = "days";
        render();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hide();
  });
  document.addEventListener("click", function (event) {
    if (calendar.hidden) return;
    var path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.indexOf(calendar) !== -1 || path.indexOf(field) !== -1 || path.indexOf(button) !== -1)
      return;
    hide();
  });

  render();
  console.log("fixture calendar ready on " + isoDay(visibleDate));
})();
