// DOM Elements
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const mealsContainer = document.getElementById("meals");
const resultHeading = document.getElementById("result-heading");
const errorContainer = document.getElementById("error-container");
const loader = document.getElementById("loader");
const themeToggle = document.getElementById("theme-toggle");

const categoryFilter = document.getElementById("category-filter");
const areaFilter = document.getElementById("area-filter");
const ingredientFilter = document.getElementById("ingredient-filter");

const autocompleteList = document.getElementById("autocomplete-list");
const mealModal = document.getElementById("meal-modal");
const modalClose = document.getElementById("modal-close");

const BASE_URL = "https://www.themealdb.com/api/json/v1/1/";
const SEARCH_URL = `${BASE_URL}search.php?s=`;
const LOOKUP_URL = `${BASE_URL}lookup.php?i=`;
const LIST_CATEGORIES = `${BASE_URL}list.php?c=list`;
const LIST_AREAS = `${BASE_URL}list.php?a=list`;
const LIST_INGREDIENTS = `${BASE_URL}list.php?i=list`;

let mealsData = [];
let displayedMeals = 0;

// Populate filters on load
async function populateFilters() {
  try {
    const [cRes, aRes, iRes] = await Promise.all([
      fetch(LIST_CATEGORIES),
      fetch(LIST_AREAS),
      fetch(LIST_INGREDIENTS),
    ]);
    const [cData, aData, iData] = await Promise.all([
      cRes.json(),
      aRes.json(),
      iRes.json(),
    ]);
    cData.meals.forEach(c => categoryFilter.innerHTML += `<option value="${c.strCategory}">${c.strCategory}</option>`);
    aData.meals.forEach(a => areaFilter.innerHTML += `<option value="${a.strArea}">${a.strArea}</option>`);
    iData.meals.forEach(i => ingredientFilter.innerHTML += `<option value="${i.strIngredient}">${i.strIngredient}</option>`);
  } catch (err) {
    console.error("Filter loading error", err);
  }
}
populateFilters();

// Search
searchBtn.addEventListener("click", searchMeals);
searchInput.addEventListener("keypress", e => { if (e.key === "Enter") searchMeals(); });
searchInput.addEventListener("input", showAutocomplete);

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.innerHTML = document.body.classList.contains("dark") ? '<i class="fas fa-sun"></i> Light Mode' : '<i class="fas fa-moon"></i> Dark Mode';
});

// Autocomplete click
autocompleteList.addEventListener("click", e => {
  if (e.target.tagName === "LI") {
    searchInput.value = e.target.textContent;
    searchMeals();
    autocompleteList.classList.add("hidden");
  }
});

// Search function
async function searchMeals() {
  const term = searchInput.value.trim();
  if (!term && !categoryFilter.value && !areaFilter.value && !ingredientFilter.value) {
    return showError("Please enter a search term or select a filter.");
  }

  showLoader(true);
  try {
    const res = await fetch(`${SEARCH_URL}${term}`);
    const data = await res.json();
    showLoader(false);
    mealsData = data.meals || [];
    displayedMeals = 0;
    applyFiltersAndDisplay();
  } catch {
    showLoader(false);
    showError("Something went wrong. Please try again.");
  }
}

function applyFiltersAndDisplay() {
  let meals = mealsData.slice();
  if (categoryFilter.value) meals = meals.filter(m => m.strCategory === categoryFilter.value);
  if (areaFilter.value) meals = meals.filter(m => m.strArea === areaFilter.value);
  if (ingredientFilter.value) meals = meals.filter(m => Object.values(m).includes(ingredientFilter.value));
  if (!meals.length) return showError("No recipes found.");
  displayMeals(meals, true);
  errorContainer.classList.add("hidden");
  resultHeading.textContent = `Results:`;
}

// Display meals
function displayMeals(meals, reset = false) {
  if (reset) { mealsContainer.innerHTML = ""; displayedMeals = 0; }
  const nextBatch = meals.slice(displayedMeals, displayedMeals + 6);
  displayedMeals += 6;
  mealsContainer.innerHTML += nextBatch.map(m => `
    <div class="meal" data-meal-id="${m.idMeal}">
      <img src="${m.strMealThumb}" alt="${m.strMeal}" loading="lazy">
      <div class="meal-info">
        <h3>${m.strMeal}</h3>
        ${m.strCategory ? `<div class="meal-category">${m.strCategory}</div>` : ""}
      </div>
    </div>`).join('');
}

// Infinite scroll
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && mealsData.length > displayedMeals) {
    applyFiltersAndDisplay();
  }
});

// Modal meal click
mealsContainer.addEventListener("click", async e => {
  const mealEl = e.target.closest(".meal");
  if (!mealEl) return;

  const mealId = mealEl.dataset.mealId;

  try {
    showLoader(true);
    const res = await fetch(`${LOOKUP_URL}${mealId}`);
    const data = await res.json();
    showLoader(false);
    const meal = data.meals[0];
    if (!meal) return showError("Meal not found");

    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      if (meal[`strIngredient${i}`] && meal[`strIngredient${i}`].trim() !== "") {
        ingredients.push({ ingredient: meal[`strIngredient${i}`], measure: meal[`strMeasure${i}`] || "" });
      }
    }

    const modalContent = mealModal.querySelector(".meal-details-content");
    modalContent.dataset.mealId = meal.idMeal;
    modalContent.innerHTML = `
      <h2>${meal.strMeal}</h2>
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy">
      <div class="meal-details-category"><span>${meal.strCategory || "Uncategorized"}</span></div>
      <div class="meal-details-instructions"><h3>Instructions</h3><p>${meal.strInstructions}</p></div>
      <ul class="ingredients-list">
        ${ingredients.map(i => `<li><i class="fas fa-check-circle"></i>${i.measure} ${i.ingredient}</li>`).join("")}
      </ul>
      ${meal.strYoutube ? `<a href="${meal.strYoutube}" target="_blank" class="youtube-link"><i class="fab fa-youtube"></i> Watch Video</a>` : ""}
      <button class="favorite-btn">${isFavorite(meal.idMeal) ? "Remove from Favorites" : "Add to Favorites"}</button>
    `;
    mealModal.classList.remove("hidden");
  } catch (err) {
    showLoader(false);
    showError("Failed to load meal details.");
    console.error(err);
  }
});

// Modal close
modalClose.addEventListener("click", () => mealModal.classList.add("hidden"));

// Favorites handling
mealModal.addEventListener("click", e => {
  if (!e.target.classList.contains("favorite-btn")) return;

  const modalContent = mealModal.querySelector(".meal-details-content");
  const mealId = modalContent.dataset.mealId;
  if (!mealId) return;

  let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (favorites.includes(mealId)) {
    favorites = favorites.filter(id => id !== mealId);
    e.target.textContent = "Add to Favorites";
  } else {
    favorites.push(mealId);
    e.target.textContent = "Remove from Favorites";
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
});

// Loader & Error functions
function showLoader(show) { loader.classList.toggle("hidden", !show); }
function showError(msg) { errorContainer.textContent = msg; errorContainer.classList.remove("hidden"); resultHeading.textContent = ""; mealsContainer.innerHTML = ""; }

// Favorites check
function isFavorite(id) { const fav = JSON.parse(localStorage.getItem("favorites") || "[]"); return fav.includes(id); }

// Autocomplete
function showAutocomplete() {
  const val = searchInput.value.toLowerCase();
  if (!val) return autocompleteList.classList.add("hidden");
  const suggestions = mealsData.filter(m => m.strMeal.toLowerCase().includes(val)).slice(0, 5);
  if (!suggestions.length) return autocompleteList.classList.add("hidden");
  autocompleteList.innerHTML = suggestions.map(m => `<li>${m.strMeal}</li>`).join('');
  autocompleteList.classList.remove("hidden");
}
