/* ==========================================
   Personal Finance Tracker - Script
   Data is saved in the browser's localStorage,
   so it stays there even after refreshing the page.
   ========================================== */

// List of categories for income and expense
var incomeCategories = ["Salary", "Freelance", "Investment", "Other"];
var expenseCategories = ["Food", "Transport", "Housing", "Utilities", "Entertainment", "Shopping", "Health", "Other"];

// Colors used for the category bar chart
var categoryColors = {
  Food: "#e67e22",
  Transport: "#f1c40f",
  Housing: "#e74c3c",
  Utilities: "#c0392b",
  Entertainment: "#9b59b6",
  Shopping: "#3498db",
  Health: "#1abc9c",
  Other: "#95a5a6"
};

// This array holds all transactions.
// Each transaction looks like:
// { id: 123, type: "income"/"expense", amount: 500, category: "Food", date: "2026-07-01", description: "Lunch" }
var transactions = [];

// Keeps track of which transaction is being edited (null = adding a new one)
var editingId = null;

// Weekly budget tracking
var weeklyBudget = 0;

// Month filter (null = no filter)
var monthFilter = null;

// Run this when the page loads
window.onload = function () {
  loadTransactions();
  loadWeeklyBudget();
  fillCategoryDropdown();
  setTodayAsDefaultDate();
  setDefaultMonthFilter();
  setDefaultMonthBreakdownFilter();
  renderEverything();
  attachEventListeners();
};

/* ==========================================
   LOADING AND SAVING DATA
   ========================================== */

function loadTransactions() {
  var saved = localStorage.getItem("transactions");

  if (saved) {
    transactions = JSON.parse(saved);
  } else {
    // Start with empty array - no default data
    transactions = [];
  }
}

function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function loadWeeklyBudget() {
  var saved = localStorage.getItem("weeklyBudget");
  weeklyBudget = saved ? parseFloat(saved) : 0;
  updateBudgetDisplay();
}

function saveWeeklyBudget() {
  localStorage.setItem("weeklyBudget", weeklyBudget.toString());
}

function setDefaultMonthFilter() {
  var today = new Date().toISOString().slice(0, 7);
  document.getElementById("monthFilter").value = today;
}

function setDefaultMonthBreakdownFilter() {
  var today = new Date().toISOString().slice(0, 7);
  document.getElementById("monthBreakdownFilter").value = today;
  renderMonthlyBreakdown();
}

function getDateDaysAgo(days) {
  var d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/* ==========================================
   FORM SETUP
   ========================================== */

function fillCategoryDropdown() {
  var selectedType = getSelectedType();
  var categoryList = selectedType === "income" ? incomeCategories : expenseCategories;
  var dropdown = document.getElementById("category");

  dropdown.innerHTML = "";
  for (var i = 0; i < categoryList.length; i++) {
    var option = document.createElement("option");
    option.value = categoryList[i];
    option.textContent = categoryList[i];
    dropdown.appendChild(option);
  }
}

function getSelectedType() {
  var radios = document.getElementsByName("type");
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) return radios[i].value;
  }
  return "income";
}

function setTodayAsDefaultDate() {
  var today = new Date().toISOString().slice(0, 10);
  document.getElementById("date").value = today;
}

/* ==========================================
   EVENT LISTENERS
   ========================================== */

function attachEventListeners() {
  // Switching between income/expense updates the category dropdown
  var radios = document.getElementsByName("type");
  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener("change", fillCategoryDropdown);
  }

  document.getElementById("transactionForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("cancelEditBtn").addEventListener("click", cancelEdit);
  document.getElementById("filterType").addEventListener("change", renderTransactionTable);
  document.getElementById("searchBox").addEventListener("input", renderTransactionTable);
  document.getElementById("exportBtn").addEventListener("click", exportAsPDF);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllData);
  
  // New event listeners for new features
  document.getElementById("monthFilter").addEventListener("change", handleMonthFilter);
  document.getElementById("resetMonthBtn").addEventListener("click", resetMonthFilter);
  document.getElementById("setWeeklyBudgetBtn").addEventListener("click", handleWeeklyBudgetSubmit);
  document.getElementById("monthBreakdownFilter").addEventListener("change", renderMonthlyBreakdown);
}

/* ==========================================
   ADD / EDIT TRANSACTION
   ========================================== */

function handleFormSubmit(event) {
  event.preventDefault(); // stop the page from refreshing

  var amount = parseFloat(document.getElementById("amount").value);
  var category = document.getElementById("category").value;
  var date = document.getElementById("date").value;
  var description = document.getElementById("description").value.trim();
  var type = getSelectedType();

  if (!amount || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  // Check if adding this expense would exceed weekly budget
  if (type === "expense" && weeklyBudget > 0) {
    var weeklyExpenseAfter = getWeeklyExpenseAmount(date) + amount;
    
    if (weeklyExpenseAfter > weeklyBudget) {
      var exceeded = weeklyExpenseAfter - weeklyBudget;
      var message = "⚠️ WARNING: This expense will exceed your weekly budget!\n\n" +
                    "Weekly Budget: ₹" + weeklyBudget.toLocaleString("en-IN") + "\n" +
                    "Current Week Spending: ₹" + getWeeklyExpenseAmount(date).toLocaleString("en-IN") + "\n" +
                    "This Expense: ₹" + amount.toLocaleString("en-IN") + "\n" +
                    "Total After: ₹" + weeklyExpenseAfter.toLocaleString("en-IN") + "\n\n" +
                    "You will exceed by: ₹" + exceeded.toLocaleString("en-IN") + "\n\n" +
                    "Do you still want to proceed?";
      
      if (!confirm(message)) {
        return; // User clicked Cancel, don't add the transaction
      }
    }
  }

  if (editingId === null) {
    // Adding a brand new transaction
    var newTransaction = {
      id: Date.now(),
      type: type,
      amount: amount,
      category: category,
      date: date,
      description: description
    };
    transactions.push(newTransaction);
  } else {
    // Updating an existing transaction
    var transaction = findTransactionById(editingId);
    transaction.type = type;
    transaction.amount = amount;
    transaction.category = category;
    transaction.date = date;
    transaction.description = description;
    cancelEdit(); // reset the form back to "add" mode
  }

  saveTransactions();
  renderEverything();
  document.getElementById("transactionForm").reset();
  setTodayAsDefaultDate();
  fillCategoryDropdown();
}

function findTransactionById(id) {
  for (var i = 0; i < transactions.length; i++) {
    if (transactions[i].id === id) return transactions[i];
  }
  return null;
}

function getWeeklyExpenseAmount(transactionDate) {
  // Calculate week start and end based on transaction date
  var tDate = new Date(transactionDate);
  var dayOfWeek = tDate.getDay();
  var weekStart = new Date(tDate);
  weekStart.setDate(tDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday

  var weekStartStr = weekStart.toISOString().slice(0, 10);
  var weekEndStr = weekEnd.toISOString().slice(0, 10);

  var weekExpense = 0;
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (t.type === "expense" && t.date >= weekStartStr && t.date <= weekEndStr) {
      weekExpense += t.amount;
    }
  }

  return weekExpense;
}

function startEditingTransaction(id) {
  var transaction = findTransactionById(id);
  if (!transaction) return;

  editingId = id;

  // Fill the form with this transaction's details
  var radios = document.getElementsByName("type");
  for (var i = 0; i < radios.length; i++) {
    radios[i].checked = radios[i].value === transaction.type;
  }
  fillCategoryDropdown();

  document.getElementById("amount").value = transaction.amount;
  document.getElementById("category").value = transaction.category;
  document.getElementById("date").value = transaction.date;
  document.getElementById("description").value = transaction.description;

  document.getElementById("submitBtn").textContent = "Update Transaction";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  editingId = null;
  document.getElementById("transactionForm").reset();
  setTodayAsDefaultDate();
  fillCategoryDropdown();
  document.getElementById("submitBtn").textContent = "Add Transaction";
  document.getElementById("cancelEditBtn").style.display = "none";
}

function deleteTransaction(id) {
  var confirmed = confirm("Are you sure you want to delete this transaction?");
  if (!confirmed) return;

  transactions = transactions.filter(function (t) {
    return t.id !== id;
  });

  saveTransactions();
  renderEverything();
}

/* ==========================================
   RENDERING (updating the page)
   ========================================== */

function renderEverything() {
  renderSummary();
  renderMonthFlowCards();
  renderCategoryChart();
  renderMonthlyBreakdown();
  renderTransactionTable();
  updateBudgetDisplay();
}

function renderSummary() {
  var totalIncome = 0;
  var totalExpense = 0;

  for (var i = 0; i < transactions.length; i++) {
    // Apply month filter if set
    if (monthFilter) {
      var tDate = transactions[i].date.slice(0, 7);
      if (tDate !== monthFilter) continue;
    }

    if (transactions[i].type === "income") {
      totalIncome += transactions[i].amount;
    } else {
      totalExpense += transactions[i].amount;
    }
  }

  var balance = totalIncome - totalExpense;

  document.getElementById("totalIncome").textContent = formatMoney(totalIncome);
  document.getElementById("totalExpense").textContent = formatMoney(totalExpense);
  document.getElementById("balance").textContent = formatMoney(balance);
}

function renderCategoryChart() {
  var chartContainer = document.getElementById("categoryChart");
  var emptyMsg = document.getElementById("chartEmptyMsg");

  // Only look at expenses from the current month
  var now = new Date();
  var totalsByCategory = {};

  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    var tDate = new Date(t.date);

    if (t.type === "expense" && tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) {
      if (!totalsByCategory[t.category]) totalsByCategory[t.category] = 0;
      totalsByCategory[t.category] += t.amount;
    }
  }

  // Clear old bars (but keep the empty message element)
  chartContainer.innerHTML = "";
  chartContainer.appendChild(emptyMsg);

  var categories = Object.keys(totalsByCategory);

  if (categories.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  // Find the highest amount so we can scale the bars (as a percentage)
  var highestAmount = Math.max.apply(null, categories.map(function (c) { return totalsByCategory[c]; }));

  // Sort categories from highest to lowest spend
  categories.sort(function (a, b) {
    return totalsByCategory[b] - totalsByCategory[a];
  });

  for (var j = 0; j < categories.length; j++) {
    var category = categories[j];
    var amount = totalsByCategory[category];
    var percent = (amount / highestAmount) * 100;
    var color = categoryColors[category] || "#7f8c8d";

    var row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      '<span>' + category + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + percent + '%; background:' + color + ';"></div></div>' +
      '<span>' + formatMoney(amount) + '</span>';

    chartContainer.appendChild(row);
  }
}

function renderMonthlyBreakdown() {
  var selectedMonth = document.getElementById("monthBreakdownFilter").value;
  
  var monthIncome = 0;
  var monthExpense = 0;

  for (var i = 0; i < transactions.length; i++) {
    var tDate = transactions[i].date.slice(0, 7);
    if (tDate === selectedMonth) {
      if (transactions[i].type === "income") {
        monthIncome += transactions[i].amount;
      } else {
        monthExpense += transactions[i].amount;
      }
    }
  }

  var monthBalance = monthIncome - monthExpense;

  document.getElementById("breakdownIncome").textContent = formatMoney(monthIncome);
  document.getElementById("breakdownExpense").textContent = formatMoney(monthExpense);
  document.getElementById("breakdownBalance").textContent = formatMoney(monthBalance);
}

function renderTransactionTable() {
  var tableBody = document.getElementById("transactionBody");
  var emptyMsg = document.getElementById("tableEmptyMsg");
  var filterType = document.getElementById("filterType").value;
  var searchText = document.getElementById("searchBox").value.toLowerCase().trim();

  // Filter the transactions based on the dropdown and search box
  var filteredList = transactions.filter(function (t) {
    var matchesType = filterType === "all" || t.type === filterType;
    var matchesSearch = t.description.toLowerCase().indexOf(searchText) !== -1 ||
                         t.category.toLowerCase().indexOf(searchText) !== -1;
    
    // Apply month filter if set
    var matchesMonth = !monthFilter || t.date.slice(0, 7) === monthFilter;
    
    return matchesType && matchesSearch && matchesMonth;
  });

  // Show newest transactions first
  filteredList.sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });

  tableBody.innerHTML = "";

  // Update title based on filter
  var title = "All Transactions";
  if (monthFilter) {
    var monthDate = new Date(monthFilter + "-01");
    title = "Transactions for " + monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  document.getElementById("transactionTitle").textContent = title;

  if (filteredList.length === 0) {
    emptyMsg.style.display = "block";
    document.getElementById("transactionTable").style.display = "none";
    return;
  }

  emptyMsg.style.display = "none";
  document.getElementById("transactionTable").style.display = "table";

  for (var i = 0; i < filteredList.length; i++) {
    var t = filteredList[i];
    var row = document.createElement("tr");

    var sign = t.type === "income" ? "+" : "-";
    var amountClass = t.type === "income" ? "amount-income" : "amount-expense";

    row.innerHTML =
      "<td>" + formatDate(t.date) + "</td>" +
      "<td>" + t.category + "</td>" +
      "<td>" + (t.description || "-") + "</td>" +
      '<td class="' + amountClass + '">' + sign + formatMoney(t.amount) + "</td>" +
      '<td>' +
        '<button class="action-btn edit" data-id="' + t.id + '">Edit</button>' +
        '<button class="action-btn delete" data-id="' + t.id + '">Delete</button>' +
      '</td>';

    tableBody.appendChild(row);
  }

  // Attach click events to the new Edit/Delete buttons
  var editButtons = document.getElementsByClassName("action-btn edit");
  var deleteButtons = document.getElementsByClassName("action-btn delete");

  var editBtns = document.querySelectorAll(".action-btn.edit");
  for (var e = 0; e < editBtns.length; e++) {
    editBtns[e].addEventListener("click", function () {
      startEditingTransaction(Number(this.getAttribute("data-id")));
    });
  }

  var delBtns = document.querySelectorAll(".action-btn.delete");
  for (var d = 0; d < delBtns.length; d++) {
    delBtns[d].addEventListener("click", function () {
      deleteTransaction(Number(this.getAttribute("data-id")));
    });
  }
}

/* ==========================================
   HELPERS
   ========================================== */

function formatMoney(amount) {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatDate(dateString) {
  var d = new Date(dateString);
  var options = { day: "2-digit", month: "short", year: "numeric" };
  return d.toLocaleDateString("en-IN", options);
}

/* ==========================================
   CHARTS - INCOME/EXPENSE/CASHFLOW
   ========================================== */

function renderMonthFlowCards() {
  var now = new Date();
  var currentMonth = now.toISOString().slice(0, 7);
  
  var monthIncome = 0;
  var monthExpense = 0;

  for (var i = 0; i < transactions.length; i++) {
    var tDate = transactions[i].date.slice(0, 7);
    if (tDate === currentMonth) {
      if (transactions[i].type === "income") {
        monthIncome += transactions[i].amount;
      } else {
        monthExpense += transactions[i].amount;
      }
    }
  }

  var monthBalance = monthIncome - monthExpense;

  document.getElementById("monthIncome").textContent = formatMoney(monthIncome);
  document.getElementById("monthExpense").textContent = formatMoney(monthExpense);
  document.getElementById("monthBalance").textContent = formatMoney(monthBalance);
}

/* ==========================================
   MONTH FILTER & WEEKLY BUDGET
   ========================================== */

function handleMonthFilter(event) {
  monthFilter = event.target.value || null;
  renderEverything();
}

function resetMonthFilter() {
  monthFilter = null;
  setDefaultMonthFilter();
  renderEverything();
}

function handleWeeklyBudgetSubmit() {
  var input = document.getElementById("weeklyBudget");
  var budget = parseFloat(input.value);

  if (!budget || budget < 0) {
    alert("Please enter a valid weekly budget amount.");
    return;
  }

  weeklyBudget = budget;
  saveWeeklyBudget();
  input.value = budget;
  updateBudgetDisplay();
  alert("Weekly budget set to ₹" + budget.toLocaleString("en-IN"));
}

function updateBudgetDisplay() {
  var statusDiv = document.getElementById("budgetStatus");
  
  if (weeklyBudget <= 0) {
    statusDiv.innerHTML = "<p style='color: #999;'>No weekly budget set yet.</p>";
    return;
  }

  // Get current week expenses
  var now = new Date();
  var dayOfWeek = now.getDay();
  var firstDay = new Date(now);
  firstDay.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
  var lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6); // Sunday

  var weekStart = firstDay.toISOString().slice(0, 10);
  var weekEnd = lastDay.toISOString().slice(0, 10);

  var weekExpense = 0;
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (t.type === "expense" && t.date >= weekStart && t.date <= weekEnd) {
      weekExpense += t.amount;
    }
  }

  var remaining = weeklyBudget - weekExpense;
  var percentage = (weekExpense / weeklyBudget) * 100;
  var statusColor = remaining >= 0 ? "#27ae60" : "#e74c3c";
  var statusText = remaining >= 0 ? "✓ Within Budget" : "✗ Over Budget";

  var weekDisplay = firstDay.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
                    " - " + lastDay.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  statusDiv.innerHTML =
    "<div style='background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid " + statusColor + ";'>" +
    "<p style='margin: 5px 0; font-weight: bold;'>Week: " + weekDisplay + "</p>" +
    "<p style='margin: 5px 0;'>Spent: <strong>₹" + weekExpense.toLocaleString("en-IN") + "</strong> / ₹" + weeklyBudget.toLocaleString("en-IN") + "</p>" +
    "<p style='margin: 5px 0; color: " + statusColor + "; font-weight: bold;'>" + statusText + " - Remaining: ₹" + Math.abs(remaining).toLocaleString("en-IN") + "</p>" +
    "<div style='background: #ddd; height: 8px; border-radius: 4px; margin-top: 10px;'>" +
    "<div style='background: " + statusColor + "; height: 100%; border-radius: 4px; width: " + Math.min(percentage, 100) + "%;'></div>" +
    "</div>" +
    "</div>";
}

/* ==========================================
   EXPORT / CLEAR DATA
   ========================================== */

function exportAsPDF() {
  if (transactions.length === 0) {
    alert("No transactions to export.");
    return;
  }

  // jsPDF is loaded from a CDN in index.html and attaches itself as window.jspdf
  var doc = new jspdf.jsPDF();

  // ---- Title ----
  doc.setFontSize(18);
  doc.setTextColor(44, 62, 80);
  doc.text("Personal Finance Report", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  var today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  doc.text("Generated on " + today, 14, 27);

  // ---- Summary numbers ----
  var totalIncome = 0;
  var totalExpense = 0;
  for (var i = 0; i < transactions.length; i++) {
    if (transactions[i].type === "income") {
      totalIncome += transactions[i].amount;
    } else {
      totalExpense += transactions[i].amount;
    }
  }
  var balance = totalIncome - totalExpense;

  // Note: jsPDF's built-in font can't render the ₹ symbol, so we use "Rs." here.
  doc.setFontSize(11);
  doc.setTextColor(39, 174, 96);
  doc.text("Total Income:  Rs. " + totalIncome.toLocaleString("en-IN"), 14, 38);
  doc.setTextColor(231, 76, 60);
  doc.text("Total Expense: Rs. " + totalExpense.toLocaleString("en-IN"), 14, 45);
  doc.setTextColor(44, 62, 80);
  doc.text("Balance:       Rs. " + balance.toLocaleString("en-IN"), 14, 52);

  // ---- Transaction table (newest first) ----
  var sortedList = transactions.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });

  var tableRows = sortedList.map(function (t) {
    return [
      formatDate(t.date),
      t.type === "income" ? "Income" : "Expense",
      t.category,
      t.description || "-",
      (t.type === "income" ? "+" : "-") + "Rs. " + t.amount.toLocaleString("en-IN")
    ];
  });

  doc.autoTable({
    head: [["Date", "Type", "Category", "Description", "Amount"]],
    body: tableRows,
    startY: 60,
    theme: "striped",
    headStyles: { fillColor: [44, 62, 80] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 4: { halign: "right" } }
  });

  doc.save("transactions.pdf");
}

function clearAllData() {
  var confirmed = confirm("This will delete ALL your transactions. Are you sure?");
  if (!confirmed) return;

  transactions = [];
  localStorage.removeItem("transactions");
  renderEverything();
}