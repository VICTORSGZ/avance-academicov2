(() => {
  const state = {
    courses: normalizeCourses(window.MALLA_BASE || []),
    selectedCode: null,
    hoveredCode: null,
    filters: {
      text: '',
      status: 'todos',
      semester: 'todos'
    }
  };

  const grid = document.getElementById('mallaGrid');
  const selectedInfo = document.getElementById('selectedInfo');
  const filterText = document.getElementById('filterText');
  const filterStatus = document.getElementById('filterStatus');
  const filterSemester = document.getElementById('filterSemester');
  const btnClearFilters = document.getElementById('btnClearFilters');

  document.addEventListener('DOMContentLoaded', () => {
    bindMenu();
    bindFilters();
    renderAll();
  });

  function normalizeCourses(items) {
    return items.map(item => ({
      codigo: String(item.codigo || '').trim(),
      nombre: String(item.nombre || '').trim(),
      semestre: Number(item.semestre || 1),
      creditos: Number(item.creditos || 0),
      area: String(item.area || 'General').trim(),
      periodicidad: String(item.periodicidad || 'Ambos').trim(),
      prerequisitos: Array.isArray(item.prerequisitos)
        ? item.prerequisitos.map(x => String(x).trim()).filter(Boolean)
        : String(item.prerequisitos || '').split(',').map(x => x.trim()).filter(Boolean),
      estadoInicial: normalizeBaseStatus(item.estadoInicial || item.estado || 'pendiente')
    })).filter(item => item.codigo && item.nombre);
  }

  function normalizeBaseStatus(value) {
    const text = String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (['aprobado', 'aprobada', 'completado', 'completada', 'finalizado', 'finalizada'].includes(text)) return 'aprobado';
    if (['inscrito', 'inscrita', 'cursando', 'en curso', 'curso'].includes(text)) return 'inscrito';

    // Pendiente queda como estado base. Visualmente se calcula como disponible o bloqueado.
    return 'pendiente';
  }

  function bindMenu() {
    document.querySelectorAll('.menu-btn[data-target]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn[data-target]').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        const target = document.getElementById(button.dataset.target);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target?.classList.add('pulse');
        setTimeout(() => target?.classList.remove('pulse'), 750);
      });
    });

    document.getElementById('btnReset')?.addEventListener('click', () => {
      state.courses.forEach(c => c.estadoInicial = String(c.estadoInicialOriginal || c.estadoInicial || 'pendiente'));
      state.selectedCode = null;
      state.hoveredCode = null;
      renderMalla();
      updateSummary();
      selectedInfo.textContent = 'Selecciona un ramo para ver sus relaciones.';
    });
  }

  function bindFilters() {
    filterText?.addEventListener('input', () => {
      state.filters.text = filterText.value.trim().toLowerCase();
      renderMalla();
    });

    filterStatus?.addEventListener('change', () => {
      state.filters.status = filterStatus.value;
      renderMalla();
    });

    filterSemester?.addEventListener('change', () => {
      state.filters.semester = filterSemester.value;
      renderMalla();
    });

    btnClearFilters?.addEventListener('click', () => {
      state.filters = { text: '', status: 'todos', semester: 'todos' };
      if (filterText) filterText.value = '';
      if (filterStatus) filterStatus.value = 'todos';
      if (filterSemester) filterSemester.value = 'todos';
      renderMalla();
    });
  }

  function renderAll() {
    if (!state.courses.length) {
      grid.innerHTML = '<div class="empty">No hay datos de malla cargados. Ejecuta convertir_excel.bat y vuelve a abrir la página.</div>';
      return;
    }

    state.courses.forEach(c => {
      if (!c.estadoInicialOriginal) c.estadoInicialOriginal = c.estadoInicial;
    });

    populateSemesterFilter();
    renderMalla();
    updateSummary();
  }

  function populateSemesterFilter() {
    if (!filterSemester) return;
    const maxSemester = Math.max(...state.courses.map(c => c.semestre));
    const current = filterSemester.value || 'todos';
    filterSemester.innerHTML = '<option value="todos">Todos</option>';

    for (let semester = 1; semester <= maxSemester; semester++) {
      const option = document.createElement('option');
      option.value = String(semester);
      option.textContent = `Semestre ${semester}`;
      filterSemester.appendChild(option);
    }

    filterSemester.value = current;
  }

  function courseByCode(code) {
    return state.courses.find(c => c.codigo === code);
  }

  function approvedCodes() {
    return new Set(state.courses.filter(c => c.estadoInicial === 'aprobado').map(c => c.codigo));
  }

  function isAvailable(course) {
    if (course.estadoInicial === 'aprobado' || course.estadoInicial === 'inscrito') return false;
    const approved = approvedCodes();
    return course.prerequisitos.every(code => approved.has(code));
  }

  function visualStatus(course) {
    if (course.estadoInicial === 'aprobado') return 'approved';
    if (course.estadoInicial === 'inscrito') return 'enrolled';
    return isAvailable(course) ? 'available' : 'blocked';
  }

  function statusText(course) {
    const status = visualStatus(course);
    return {
      approved: 'Aprobado',
      enrolled: 'Inscrito',
      available: 'Disponible para tomar',
      blocked: 'Bloqueado por prerrequisitos'
    }[status] || 'Sin estado';
  }

  function renderMalla() {
    const maxSemester = Math.max(...state.courses.map(c => c.semestre));
    grid.innerHTML = '';

    for (let semester = 1; semester <= maxSemester; semester++) {
      if (state.filters.semester !== 'todos' && Number(state.filters.semester) !== semester) continue;

      const courses = state.courses
        .filter(c => c.semestre === semester)
        .filter(matchesFilters);

      if (!courses.length && hasActiveFilters()) continue;

      const column = document.createElement('div');
      column.className = 'semester';
      column.innerHTML = `<h3>Semestre ${semester}</h3>`;

      courses.forEach(course => column.appendChild(createCourseCard(course)));
      grid.appendChild(column);
    }

    if (!grid.children.length) {
      grid.innerHTML = '<div class="empty">No hay ramos que coincidan con los filtros seleccionados.</div>';
    }

    applyHighlights();
  }

  function hasActiveFilters() {
    return state.filters.text || state.filters.status !== 'todos' || state.filters.semester !== 'todos';
  }

  function matchesFilters(course) {
    const text = `${course.codigo} ${course.nombre} ${course.area} ${course.periodicidad}`.toLowerCase();
    const status = visualStatus(course);

    if (state.filters.text && !text.includes(state.filters.text)) return false;
    if (state.filters.status !== 'todos' && status !== state.filters.status) return false;
    return true;
  }

  function createCourseCard(course) {
    const card = document.createElement('article');
    card.className = `course ${visualStatus(course)}`;
    card.dataset.code = course.codigo;
    card.title = tooltip(course);

    card.innerHTML = `
      <span class="course-code">${escapeHtml(course.codigo)}</span>
      <span class="course-name">${escapeHtml(course.nombre)}</span>
      <div class="course-meta">
        <span class="badge status-badge">${escapeHtml(statusText(course))}</span>
        <span class="badge">${course.creditos} cr.</span>
        <span class="badge">${escapeHtml(shortPeriod(course.periodicidad))}</span>
      </div>
    `;

    card.addEventListener('click', () => handleCourseClick(course));
    card.addEventListener('mouseenter', () => {
      state.hoveredCode = course.codigo;
      applyHighlights();
    });
    card.addEventListener('mouseleave', () => {
      state.hoveredCode = null;
      applyHighlights();
    });

    return card;
  }

  function handleCourseClick(course) {
    state.selectedCode = course.codigo;

    if (course.estadoInicial === 'aprobado') {
      course.estadoInicial = 'pendiente';
    } else if (course.estadoInicial === 'inscrito' || isAvailable(course)) {
      course.estadoInicial = 'aprobado';
    }

    renderMalla();
    updateSummary();
    updateSelectedInfo(course);
  }

  function updateSelectedInfo(course) {
    const dependents = state.courses.filter(c => c.prerequisitos.includes(course.codigo)).map(c => c.codigo);
    const prereqs = course.prerequisitos.length ? course.prerequisitos.join(', ') : 'sin prerrequisitos';
    const deps = dependents.length ? dependents.join(', ') : 'sin dependientes directos';
    selectedInfo.textContent = `${course.codigo}: ${statusText(course)}. Prerrequisitos: ${prereqs}. Habilita: ${deps}.`;
  }

  function applyHighlights() {
    const cards = [...document.querySelectorAll('.course')];
    cards.forEach(card => card.classList.remove('selected', 'highlight-prereq', 'highlight-dependent', 'dimmed'));

    if (state.selectedCode) {
      const selected = document.querySelector(`.course[data-code="${cssEscape(state.selectedCode)}"]`);
      selected?.classList.add('selected');
    }

    const focusCode = state.hoveredCode || state.selectedCode;
    if (!focusCode) return;

    const focused = courseByCode(focusCode);
    if (!focused) return;

    const prereqSet = new Set(focused.prerequisitos);
    const dependentSet = new Set(state.courses.filter(c => c.prerequisitos.includes(focusCode)).map(c => c.codigo));

    cards.forEach(card => {
      const code = card.dataset.code;
      if (code === focusCode) card.classList.add('selected');
      else if (prereqSet.has(code)) card.classList.add('highlight-prereq');
      else if (dependentSet.has(code)) card.classList.add('highlight-dependent');
      else if (state.hoveredCode) card.classList.add('dimmed');
    });
  }

  function updateSummary() {
    const approved = state.courses.filter(c => visualStatus(c) === 'approved');
    const enrolled = state.courses.filter(c => visualStatus(c) === 'enrolled');
    const available = state.courses.filter(c => visualStatus(c) === 'available');
    const blocked = state.courses.filter(c => visualStatus(c) === 'blocked');
    const totalCredits = state.courses.reduce((sum, c) => sum + c.creditos, 0);
    const approvedCredits = approved.reduce((sum, c) => sum + c.creditos, 0);
    const progress = totalCredits ? Math.round((approvedCredits / totalCredits) * 100) : 0;

    document.getElementById('progressCircle').style.setProperty('--progress', progress);
    document.getElementById('progressText').textContent = `${progress}%`;
    document.getElementById('completedText').textContent = `${approved.length} / ${state.courses.length}`;
    document.getElementById('creditsText').textContent = `${approvedCredits} / ${totalCredits}`;
    document.getElementById('countApproved').textContent = approved.length;
    document.getElementById('countAvailable').textContent = available.length;
    document.getElementById('countEnrolled').textContent = enrolled.length;
    document.getElementById('countBlocked').textContent = blocked.length;
  }

  function tooltip(course) {
    const prereqs = course.prerequisitos.length ? course.prerequisitos.join(', ') : 'Sin prerrequisitos';
    const dependents = state.courses.filter(c => c.prerequisitos.includes(course.codigo)).map(c => c.codigo);
    return `${course.codigo} - ${course.nombre}\nEstado: ${statusText(course)}\nPrerrequisitos: ${prereqs}\nHabilita: ${dependents.length ? dependents.join(', ') : 'Sin dependientes directos'}`;
  }

  function shortPeriod(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('primer')) return '1° sem.';
    if (text.includes('segundo')) return '2° sem.';
    return 'Ambos Semestres';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
})();
