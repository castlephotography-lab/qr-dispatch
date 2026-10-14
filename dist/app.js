(() => {
  'use strict';

  const TIMES = [
    { label: '8:00', period: 'AM' },
    { label: '9:00', period: 'AM' },
    { label: '10:00', period: 'AM' },
    { label: '11:00', period: 'AM' },
    { label: '1:00', period: 'PM' },
    { label: '2:00', period: 'PM' },
    { label: '3:00', period: 'PM' }
  ];
  const STORAGE_KEY = 'qr-dispatch:v1:schedule';
  const PRINT_CAPACITY = { qr: 4, code128: 6, both: 3 };

  const scheduleGrid = document.querySelector('#schedule-grid');
  const workinList = document.querySelector('#workin-list');
  const workinsPanel = document.querySelector('#workins');
  const addWorkinButton = document.querySelector('#add-workin');
  const formatSelect = document.querySelector('#format-select');
  const clearButton = document.querySelector('#clear-button');
  const printButton = document.querySelector('#print-button');
  const printRoot = document.querySelector('#print-root');
  const notice = document.querySelector('#notice');
  const entryCount = document.querySelector('#entry-count');
  const workinCount = document.querySelector('#workin-count');
  const saveState = document.querySelector('#save-state');
  const systemState = document.querySelector('#system-state');
  const systemStateText = document.querySelector('#system-state-text');

  let storageAvailable = false;
  let staleState = null;

  function localDateStamp(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function emptySchedule() {
    return TIMES.map(() => ['', '', '', '']);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function buildSchedule() {
    const fragment = document.createDocumentFragment();

    TIMES.forEach((time, rowIndex) => {
      const row = createElement('div', 'appointment-row');
      row.dataset.time = `${time.label} ${time.period}`;

      const timeLabel = createElement('div', 'time-label');
      timeLabel.append(createElement('strong', '', time.label), createElement('span', '', time.period));
      row.append(timeLabel);

      for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
        const wrapper = createElement('label', 'field-wrap');
        const number = createElement('span', 'field-number', String(columnIndex + 1).padStart(2, '0'));
        const input = createElement('input', 'entry-input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.id = `scheduled-${rowIndex}-${columnIndex}`;
        input.dataset.row = String(rowIndex);
        input.dataset.column = String(columnIndex);
        input.setAttribute('aria-label', `${time.label} ${time.period}, position ${columnIndex + 1}`);
        wrapper.append(number, input);
        row.append(wrapper);
      }

      fragment.append(row);
    });

    scheduleGrid.append(fragment);
  }

  function addWorkin(value = '', shouldFocus = false) {
    const item = createElement('div', 'workin-item field-wrap');
    const input = createElement('input', 'workin-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = value;
    input.setAttribute('aria-label', `Work-in ${workinList.children.length + 1}`);

    const removeButton = createElement('button', 'remove-workin', '×');
    removeButton.type = 'button';
    removeButton.tabIndex = -1;
    removeButton.title = 'Remove work-in';
    removeButton.setAttribute('aria-label', 'Remove work-in');
    removeButton.addEventListener('click', () => {
      item.remove();
      relabelWorkins();
      handleChange();
    });

    item.append(input, removeButton);
    workinList.append(item);
    relabelWorkins();
    if (shouldFocus) input.focus();
  }

  function relabelWorkins() {
    [...workinList.querySelectorAll('.workin-input')].forEach((input, index) => {
      input.setAttribute('aria-label', `Work-in ${index + 1}`);
    });
  }

  function readState() {
    const schedule = emptySchedule();
    document.querySelectorAll('.entry-input').forEach((input) => {
      schedule[Number(input.dataset.row)][Number(input.dataset.column)] = input.value;
    });

    return {
      date: localDateStamp(),
      mode: formatSelect.value,
      schedule,
      workins: [...workinList.querySelectorAll('.workin-input')].map((input) => input.value)
    };
  }

  function applyState(state) {
    const schedule = Array.isArray(state?.schedule) ? state.schedule : emptySchedule();
    document.querySelectorAll('.entry-input').forEach((input) => {
      input.value = schedule[Number(input.dataset.row)]?.[Number(input.dataset.column)] ?? '';
    });

    formatSelect.value = ['qr', 'code128', 'both'].includes(state?.mode) ? state.mode : 'qr';
    workinList.replaceChildren();
    (Array.isArray(state?.workins) ? state.workins : []).forEach((value) => addWorkin(String(value ?? '')));
    handleChange(false);
  }

  function testStorage() {
    try {
      const key = `${STORAGE_KEY}:test`;
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
      saveState.textContent = 'Local saving unavailable';
      saveState.classList.add('warning');
      showNotice('This browser is blocking local storage. Entries will not survive a refresh.', 'error');
    }
  }

  function restoreState() {
    if (!storageAvailable) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return;
      if (saved.date === localDateStamp()) {
        applyState(saved);
      } else if (hasAnyData(saved)) {
        staleState = saved;
        showStaleNotice(saved.date);
      }
    } catch (error) {
      showNotice('Saved entries could not be read. The current sheet was left blank.', 'error');
    }
  }

  function hasAnyData(state) {
    const scheduled = Array.isArray(state?.schedule) ? state.schedule.flat() : [];
    const workins = Array.isArray(state?.workins) ? state.workins : [];
    return [...scheduled, ...workins].some((value) => String(value ?? '').length > 0);
  }

  function save() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readState()));
      saveState.textContent = 'Saved locally';
      saveState.classList.remove('warning');
    } catch (error) {
      saveState.textContent = 'Save failed';
      saveState.classList.add('warning');
      showNotice('Local saving failed. Keep this tab open until printing is complete.', 'error');
    }
  }

  function showNotice(message, type = 'warning') {
    notice.replaceChildren();
    notice.textContent = message;
    notice.className = `notice${type === 'error' ? ' error' : ''}`;
    notice.hidden = false;
  }

  function hideNotice() {
    notice.hidden = true;
    notice.replaceChildren();
  }

  function showStaleNotice(date) {
    notice.replaceChildren();
    notice.className = 'notice';
    notice.append(document.createTextNode(`Saved entries are from ${date}. They were not loaded into today’s sheet.`));

    const restoreButton = createElement('button', '', 'Use saved entries');
    restoreButton.type = 'button';
    restoreButton.tabIndex = -1;
    restoreButton.addEventListener('click', () => {
      const saved = staleState;
      staleState = null;
      applyState(saved);
      save();
      hideNotice();
      document.querySelector('.entry-input')?.focus();
    });

    const discardButton = createElement('button', '', 'Start blank');
    discardButton.type = 'button';
    discardButton.tabIndex = -1;
    discardButton.addEventListener('click', () => {
      staleState = null;
      localStorage.removeItem(STORAGE_KEY);
      save();
      hideNotice();
      document.querySelector('.entry-input')?.focus();
    });

    notice.append(restoreButton, discardButton);
    notice.hidden = false;
  }

  function textByteLength(value) {
    return new TextEncoder().encode(value).length;
  }

  function validate() {
    const mode = formatSelect.value;
    const inputs = [...document.querySelectorAll('.entry-input, .workin-input')];
    const values = inputs.map((input) => input.value);
    const frequency = new Map();
    values.filter((value) => value.length > 0).forEach((value) => frequency.set(value, (frequency.get(value) || 0) + 1));
    let duplicateCount = 0;
    let capacityCount = 0;
    let errorCount = 0;

    inputs.forEach((input) => {
      const wrapper = input.closest('.field-wrap');
      const value = input.value;
      const issues = [];
      let isError = false;

      wrapper.classList.remove('has-warning', 'has-error');
      input.removeAttribute('title');

      if (!value.length) return;
      if ((frequency.get(value) || 0) > 1) {
        issues.push('Duplicate entry');
        duplicateCount += 1;
      }
      if ((mode === 'qr' || mode === 'both') && textByteLength(value) > 280) {
        issues.push('Dense QR: verify the printed code with the warehouse scanner');
        capacityCount += 1;
      }
      if ((mode === 'qr' || mode === 'both') && textByteLength(value) > 2200) {
        issues.push('Too much data for a practical printed QR code');
        isError = true;
        errorCount += 1;
      }
      if ((mode === 'code128' || mode === 'both') && [...value].some((character) => character.codePointAt(0) > 255)) {
        issues.push('Code 128 supports Latin-1 characters only');
        isError = true;
        errorCount += 1;
      } else if ((mode === 'code128' || mode === 'both') && value.length > 48) {
        issues.push('Code 128 may be too dense at this print width');
        capacityCount += 1;
      }

      if (issues.length) {
        wrapper.classList.add(isError ? 'has-error' : 'has-warning');
        input.title = issues.join('. ');
      }
    });

    return { duplicateCount, capacityCount, errorCount };
  }

  function updateSummary(validation) {
    const state = readState();
    const scheduled = state.schedule.flat().filter((value) => value.length > 0).length;
    const workins = state.workins.filter((value) => value.length > 0).length;
    entryCount.textContent = String(scheduled + workins);
    workinCount.textContent = String(workins);

    if (staleState) return;
    if (validation.errorCount) {
      showNotice(`${validation.errorCount} ${validation.errorCount === 1 ? 'entry cannot' : 'entries cannot'} be encoded in the selected format. Hover over the marked field for details.`, 'error');
    } else if (validation.duplicateCount || validation.capacityCount) {
      const messages = [];
      if (validation.duplicateCount) messages.push('Duplicate entries are marked but will still print');
      if (validation.capacityCount) messages.push('A long entry may produce a code that is difficult to scan at the selected size');
      showNotice(`${messages.join('. ')}.`);
    } else if (notice.dataset.persistent !== 'true') {
      hideNotice();
    }
  }

  function handleChange(shouldSave = true) {
    const validation = validate();
    updateSummary(validation);
    if (shouldSave) save();
  }

  function svgElement(markup) {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (svg.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) throw new Error('Invalid generated SVG');
    svg.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
    svg.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      });
    });
    return document.importNode(svg, true);
  }

  function makeQrSvg(value) {
    const qr = qrcode(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    return svgElement(qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }));
  }

  function makeCode128Svg(value) {
    const markup = bwipjs.toSVG({
      bcid: 'code128',
      text: value,
      scale: 3,
      height: 13,
      includetext: false,
      paddingwidth: 5,
      paddingheight: 2,
      backgroundcolor: 'FFFFFF'
    });
    return svgElement(markup);
  }

  function identifierClass(value) {
    if (value.length <= 3) return 'identifier short';
    if (value.length <= 12) return 'identifier';
    if (value.length <= 24) return 'identifier long';
    return 'identifier xlong';
  }

  function createPrintItem(value, mode) {
    if (!value.length) return createElement('div', 'print-item blank');
    const item = createElement('div', 'print-item');
    item.dataset.value = value;

    if (mode === 'qr' || mode === 'both') {
      const symbol = createElement('div', 'symbol qr');
      symbol.append(makeQrSvg(value));
      item.append(symbol);
    }
    if (mode === 'code128' || mode === 'both') {
      const symbol = createElement('div', 'symbol code128');
      symbol.append(makeCode128Svg(value));
      item.append(symbol);
    }

    item.append(createElement('div', identifierClass(value), value));
    const checks = createElement('div', 'status-checks');
    ['AUDITED', 'SHIPPED'].forEach((label) => {
      const checkLabel = createElement('span', 'check-label');
      checkLabel.append(createElement('i', 'check-box'), document.createTextNode(label));
      checks.append(checkLabel);
    });
    item.append(checks);
    return item;
  }

  function createPrintSection(block, mode) {
    const section = createElement('section', 'print-section');
    const heading = createElement('h2', `section-heading${block.workin ? ' workin-heading' : ''}`, block.title);
    const grid = createElement('div', 'print-grid');
    block.values.forEach((value) => grid.append(createPrintItem(value, mode)));
    section.append(heading, grid);
    return section;
  }

  function collectPrintBlocks(state) {
    const blocks = [];
    state.schedule.forEach((values, index) => {
      const normalized = [0, 1, 2, 3].map((column) => String(values?.[column] ?? ''));
      if (normalized.some((value) => value.length > 0)) {
        blocks.push({ title: `${TIMES[index].label} ${TIMES[index].period}`, values: normalized, workin: false });
      }
    });

    const populatedWorkins = state.workins.filter((value) => value.length > 0);
    for (let index = 0; index < populatedWorkins.length; index += 4) {
      const values = populatedWorkins.slice(index, index + 4);
      while (values.length < 4) values.push('');
      blocks.push({
        title: index === 0 ? 'WORK-INS' : 'WORK-INS — CONTINUED',
        values,
        workin: true
      });
    }
    return blocks;
  }

  function renderPrint() {
    const validation = validate();
    if (validation.errorCount) {
      updateSummary(validation);
      return false;
    }

    const state = readState();
    const blocks = collectPrintBlocks(state);
    printRoot.replaceChildren();
    printRoot.dataset.mode = state.mode;
    printRoot.dataset.entries = String(state.schedule.flat().filter(Boolean).length + state.workins.filter(Boolean).length);

    if (!blocks.length) {
      showNotice('Enter at least one appointment before printing.');
      return false;
    }

    try {
      const capacity = PRINT_CAPACITY[state.mode];
      for (let index = 0; index < blocks.length; index += capacity) {
        const page = createElement('div', `print-page mode-${state.mode}`);
        blocks.slice(index, index + capacity).forEach((block) => page.append(createPrintSection(block, state.mode)));
        printRoot.append(page);
      }
      printRoot.dataset.ready = 'true';
      return true;
    } catch (error) {
      console.error(error);
      showNotice(`A code could not be generated: ${error.message}`, 'error');
      printRoot.dataset.ready = 'false';
      return false;
    }
  }

  function clearForNewDay() {
    if (!window.confirm('Clear every scheduled and work-in entry for a new day? This cannot be undone.')) return;
    applyState({ date: localDateStamp(), mode: formatSelect.value, schedule: emptySchedule(), workins: [] });
    staleState = null;
    save();
    document.querySelector('.entry-input')?.focus();
  }

  function updateConnectionState() {
    if (!navigator.onLine) {
      systemState.className = 'system-state offline';
      systemStateText.textContent = 'Working offline';
    } else if ('serviceWorker' in navigator) {
      systemState.className = 'system-state ready';
      systemStateText.textContent = 'Offline ready';
    } else {
      systemState.className = 'system-state';
      systemStateText.textContent = 'Online';
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      systemStateText.textContent = location.protocol === 'file:' ? 'Use a web server for offline mode' : 'Offline cache unavailable';
      return;
    }
    try {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      updateConnectionState();
    } catch (error) {
      systemState.className = 'system-state offline';
      systemStateText.textContent = 'Offline cache failed';
      console.error('Service worker registration failed', error);
    }
  }

  buildSchedule();
  testStorage();
  restoreState();
  handleChange(false);

  scheduleGrid.addEventListener('input', () => handleChange());
  workinList.addEventListener('input', () => handleChange());
  formatSelect.addEventListener('change', () => handleChange());
  addWorkinButton.addEventListener('click', () => {
    workinsPanel.open = true;
    addWorkin('', true);
    handleChange();
  });
  clearButton.addEventListener('click', clearForNewDay);
  printButton.addEventListener('click', () => {
    if (!renderPrint()) return;
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  });
  window.addEventListener('beforeprint', renderPrint);
  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);

  window.QRDispatch = {
    renderPrint,
    readState,
    applyState,
    emptySchedule,
    addWorkin,
    storageKey: STORAGE_KEY
  };

  updateConnectionState();
  registerServiceWorker();
  requestAnimationFrame(() => document.querySelector('.entry-input')?.focus());
})();
