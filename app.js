/* ================================================
   app.js — Rick & Morty Universe Explorer
   API: https://rickandmortyapi.com/
   ================================================ */

"use strict";

// ─── CONSTANTES ────────────────────────────────
const BASE_URL  = "https://rickandmortyapi.com/api";
const ENDPOINT  = `${BASE_URL}/character`;

// ─── ESTADO DE LA APLICACION ───────────────────
const state = {
  currentPage   : 1,
  totalPages    : 1,
  searchQuery   : "",
  filterStatus  : "",
  filterGender  : "",
  debounceTimer : null,
};

// ─── REFERENCIAS AL DOM ────────────────────────
const cardsGrid   = document.getElementById("cards-grid");
const loader      = document.getElementById("loader");
const errorMsg    = document.getElementById("error-msg");
const errorText   = document.getElementById("error-text");
const retryBtn    = document.getElementById("retry-btn");
const btnPrev     = document.getElementById("btn-prev");
const btnNext     = document.getElementById("btn-next");
const pageInfo    = document.getElementById("page-info");
const searchInput = document.getElementById("search-input");

const statTotal   = document.getElementById("stat-total");
const statAlive   = document.getElementById("stat-alive");
const statDead    = document.getElementById("stat-dead");
const statPages   = document.getElementById("stat-pages");

// ─── UTILIDADES ────────────────────────────────

/**
 * Construye la URL de consulta segun el estado actual.
 * Usa template literals y desestructuracion del estado.
 */
const buildURL = () => {
  const { currentPage, searchQuery, filterStatus, filterGender } = state;

  const params = new URLSearchParams({
    page  : currentPage,
    name  : searchQuery,
    status: filterStatus,
    gender: filterGender,
  });

  // Eliminar parametros vacios para no ensuciar la URL
  [...params.keys()].forEach(key => {
    if (!params.get(key)) params.delete(key);
  });

  return `${ENDPOINT}?${params.toString()}`;
};

/**
 * Determina la clase CSS segun el estado del personaje.
 * Funcion de flecha con valor por defecto.
 */
const statusClass = (status = "") => status.toLowerCase();

/**
 * Trunca texto si supera la longitud maxima.
 */
const truncate = (text, max = 20) =>
  text.length > max ? `${text.slice(0, max)}...` : text;

// ─── FETCH DE DATOS ────────────────────────────

/**
 * Consulta la API con async/await.
 * Lanza un error si la respuesta no es exitosa.
 */
const fetchCharacters = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("No se encontraron personajes con esos filtros.");
    }
    throw new Error(`Error HTTP ${response.status}: No se pudo conectar con la API.`);
  }

  const data = await response.json();
  return data;
};

/**
 * Actualiza las estadisticas del header una sola vez al inicio.
 * Usa async/await para obtener datos adicionales.
 */
const fetchStatusCounts = async () => {
  const [resAlive, resDead] = await Promise.all([
    fetch(`${ENDPOINT}?status=alive`),
    fetch(`${ENDPOINT}?status=dead`),
  ]);

  if (!resAlive.ok || !resDead.ok) return;

  const [aliveData, deadData] = await Promise.all([
    resAlive.json(),
    resDead.json(),
  ]);

  // Desestructuracion de objetos anidados
  const { info: { count: aliveCount } } = aliveData;
  const { info: { count: deadCount }  } = deadData;

  statAlive.textContent = aliveCount.toLocaleString();
  statDead.textContent  = deadCount.toLocaleString();
};

// ─── CONSTRUCCION DE TARJETAS ──────────────────

/**
 * buildCard: funcion de flecha que recibe un personaje
 * y retorna un elemento <article> completo.
 * Aplica desestructuracion de objeto.
 */
const buildCard = (character) => {
  // Desestructuracion del objeto personaje
  const {
    id,
    name,
    status,
    species,
    gender,
    origin,
    location,
    image,
  } = character;

  // Desestructuracion anidada del objeto origin y location
  const { name: originName }   = origin;
  const { name: locationName } = location;

  const article = document.createElement("article");
  article.className = "card";
  article.style.animationDelay = `${(id % 20) * 40}ms`;

  article.innerHTML = `
    <span class="card-id">#${id}</span>

    <div class="card-img-wrap">
      <img
        src="${image}"
        alt="Imagen de ${name}"
        loading="lazy"
        width="300"
        height="220"
      />
    </div>

    <div class="card-body">
      <h2 class="card-name" title="${name}">${name}</h2>

      <span class="status-pill ${statusClass(status)}">
        ${status}
      </span>

      <div class="card-info">
        <div class="info-row">
          <span class="info-label">Especie</span>
          <span class="info-value">${species}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Genero</span>
          <span class="info-value">${gender}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Origen</span>
          <span class="info-value" title="${originName}">${truncate(originName, 22)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ubicacion</span>
          <span class="info-value" title="${locationName}">${truncate(locationName, 22)}</span>
        </div>
      </div>
    </div>
  `;

  return article;
};

// ─── RENDERIZADO ───────────────────────────────

/**
 * renderCards: usa filter() para excluir personajes sin imagen,
 * luego map() para convertir cada objeto en un nodo DOM,
 * y forEach() para insertar cada nodo en el grid.
 */
const renderCards = (characters) => {
  cardsGrid.innerHTML = "";

  // filter() — solo personajes con imagen valida
  const withImage = characters.filter(
    ({ image }) => image && !image.includes("null")
  );

  // map() — transforma cada objeto en un elemento DOM
  const cardElements = withImage.map(buildCard);

  // forEach() — inserta cada tarjeta en el grid
  cardElements.forEach(card => cardsGrid.appendChild(card));
};

/**
 * Actualiza los valores del header con los datos de la respuesta.
 */
const updateStats = ({ info: { count, pages } }) => {
  statTotal.textContent = count.toLocaleString();
  statPages.textContent = pages;
  state.totalPages      = pages;
};

/**
 * Actualiza el estado de los botones de paginacion.
 */
const updatePagination = ({ info: { prev, next } }) => {
  btnPrev.disabled = !prev;
  btnNext.disabled = !next;
  pageInfo.textContent = `Pagina ${state.currentPage} de ${state.totalPages}`;
};

// ─── VISIBILIDAD DE SECCIONES ──────────────────
const showLoader  = () => { loader.classList.remove("hidden"); cardsGrid.classList.add("hidden"); errorMsg.classList.add("hidden"); };
const hideLoader  = () => { loader.classList.add("hidden"); cardsGrid.classList.remove("hidden"); };
const showError   = (msg) => { hideLoader(); errorMsg.classList.remove("hidden"); errorText.textContent = msg; };

// ─── CARGA PRINCIPAL ───────────────────────────

/**
 * loadPage: funcion principal async/await.
 * Orquesta el fetch, procesamiento y renderizado.
 */
const loadPage = async () => {
  showLoader();

  try {
    const url  = buildURL();
    const data = await fetchCharacters(url);

    // Desestructuracion del resultado
    const { results, info } = data;

    updateStats({ info });
    updatePagination({ info });
    renderCards(results);

  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
};

// ─── EVENTOS ───────────────────────────────────

// Busqueda con debounce
searchInput.addEventListener("input", (e) => {
  clearTimeout(state.debounceTimer);

  state.debounceTimer = setTimeout(() => {
    state.searchQuery = e.target.value.trim();
    state.currentPage = 1;
    loadPage();
  }, 450);
});

// Paginacion
btnPrev.addEventListener("click", () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    loadPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

btnNext.addEventListener("click", () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    loadPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Reintentar en caso de error
retryBtn.addEventListener("click", loadPage);

// Filtros de estado y genero
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const { filter, value } = btn.dataset;

    // Actualizar clase activa solo dentro del mismo grupo
    btn.closest("nav").querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Guardar filtro en el estado
    if (filter === "status") state.filterStatus = value;
    if (filter === "gender") state.filterGender = value;

    state.currentPage = 1;
    loadPage();
  });
});

// ─── INICIO ────────────────────────────────────
loadPage();
fetchStatusCounts();
