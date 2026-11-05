// Interface web do encurtador. JavaScript puro, sem build: o Express serve este arquivo como está.

const STORAGE_KEY = 'encurtador:links';

const form = document.querySelector('#create-form');
const urlInput = document.querySelector('#url');
const urlCount = document.querySelector('#url-count');
const aliasInput = document.querySelector('#alias');
const aliasPrefix = document.querySelector('#alias-prefix');
const expiresInput = document.querySelector('#expires');
const submitButton = document.querySelector('#submit');
const formError = document.querySelector('#form-error');

const resultSection = document.querySelector('#result');
const shortLink = document.querySelector('#short-link');
const copyButton = document.querySelector('#copy-button');
const compareText = document.querySelector('#compare-text');
const barLong = document.querySelector('#bar-long');
const barShort = document.querySelector('#bar-short');
const resultExpiry = document.querySelector('#result-expiry');

const listEl = document.querySelector('#links-list');
const emptyState = document.querySelector('#empty-state');
const listError = document.querySelector('#list-error');
const refreshButton = document.querySelector('#refresh-button');

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

let links = loadLinks();
let currentResult = null; // { code, shortUrl } do último link criado nesta sessão
let refreshing = false;

/* ---------- API ---------- */

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Todas as respostas de erro da API seguem { error: { code, message, details? } }.
async function api(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(response.status, error?.message ?? 'Algo deu errado.', error?.details);
  }
  return body;
}

/* ---------- Armazenamento local ---------- */

function loadLinks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLinks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Armazenamento cheio ou bloqueado: a lista só deixa de persistir.
  }
}

/* ---------- Utilitários ---------- */

// Monta elementos com textContent (nunca innerHTML): as URLs vêm de usuários.
function el(tag, { className, text, attrs } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

const formatDate = (iso) => dateFormat.format(new Date(iso));
const stripProtocol = (url) => url.replace(/^https?:\/\//, '');
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function describeExpiry(expiresAt) {
  if (!expiresAt) return { expired: false, text: 'Não expira.' };
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return { expired: true, text: `Expirou em ${formatDate(expiresAt)}.` };
  }
  return { expired: false, text: `Expira em ${formatDate(expiresAt)}.` };
}

// Valor no formato que o <input type="datetime-local"> espera (horário local).
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const flashTimers = new WeakMap();

function flash(button, label) {
  const original = button.dataset.label ?? button.textContent;
  button.dataset.label = original;
  button.textContent = label;
  clearTimeout(flashTimers.get(button));
  flashTimers.set(
    button,
    setTimeout(() => {
      button.textContent = original;
    }, 1800),
  );
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    flash(button, 'Copiado');
  } catch {
    flash(button, 'Copie manualmente');
  }
}

/* ---------- Formulário ---------- */

function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.textContent = busy ? 'Encurtando…' : 'Encurtar link';
}

function clearFormError() {
  formError.hidden = true;
  formError.textContent = '';
  for (const field of [urlInput, aliasInput, expiresInput]) field.removeAttribute('aria-invalid');
}

function showFormError(message, field) {
  formError.textContent = message;
  formError.hidden = false;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

function fieldFor(name) {
  return { url: urlInput, alias: aliasInput, expiresAt: expiresInput }[name] ?? null;
}

function handleCreateError(error, alias) {
  if (!(error instanceof ApiError)) {
    console.error(error);
    showFormError('Algo deu errado. Tente de novo.');
    return;
  }
  if (error.status === 409) {
    showFormError(`O endereço "${alias}" já está em uso. Escolha outro.`, aliasInput);
    return;
  }
  if (error.status === 429) {
    showFormError('Você criou muitos links em pouco tempo. Aguarde um minuto e tente de novo.');
    return;
  }
  if (error.status === 400 && Array.isArray(error.details) && error.details.length > 0) {
    const [first] = error.details;
    showFormError(first.message, fieldFor(first.field));
    return;
  }
  showFormError(error.message);
}

urlInput.addEventListener('input', () => {
  const length = urlInput.value.trim().length;
  urlCount.textContent = length > 0 ? `${length} caracteres` : '';
  clearFormError();
});
aliasInput.addEventListener('input', clearFormError);
expiresInput.addEventListener('input', clearFormError);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError();

  const url = urlInput.value.trim();
  if (!url) {
    showFormError('Cole o link que você quer encurtar.', urlInput);
    return;
  }

  const payload = { url };

  const alias = aliasInput.value.trim();
  if (alias) payload.alias = alias;

  if (expiresInput.value) {
    const date = new Date(expiresInput.value); // datetime-local é interpretado como horário local
    if (Number.isNaN(date.getTime())) {
      showFormError('Informe uma data de expiração válida.', expiresInput);
      return;
    }
    payload.expiresAt = date.toISOString();
  }

  setBusy(true);
  try {
    const link = await api('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    onCreated(link);
  } catch (error) {
    handleCreateError(error, alias);
  } finally {
    setBusy(false);
  }
});

function onCreated(link) {
  links.unshift({
    code: link.code,
    shortUrl: link.shortUrl,
    originalUrl: link.originalUrl,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    stats: { totalClicks: 0, lastAccessedAt: null },
  });
  saveLinks();
  renderLinks();
  showResult(link);

  form.reset();
  urlCount.textContent = '';
  expiresInput.min = toLocalInputValue(new Date());
  copyButton.focus();
}

/* ---------- Resultado ---------- */

function showResult(link) {
  currentResult = { code: link.code, shortUrl: link.shortUrl };

  shortLink.textContent = stripProtocol(link.shortUrl);
  shortLink.href = link.shortUrl;

  const longLength = link.originalUrl.length;
  const shortLength = link.shortUrl.length;
  const widest = Math.max(longLength, shortLength);
  const longPercent = (longLength / widest) * 100;
  const shortPercent = (shortLength / widest) * 100;

  compareText.textContent = `De ${longLength} para ${shortLength} caracteres.`;
  resultExpiry.textContent = describeExpiry(link.expiresAt).text;

  // A barra do link curto começa do tamanho do original e encolhe até o tamanho real.
  barLong.style.width = `${longPercent}%`;
  barShort.style.transition = 'none';
  barShort.style.width = `${longPercent}%`;
  resultSection.hidden = false;
  void barShort.offsetWidth; // força o navegador a aplicar a largura inicial antes da animação
  barShort.style.transition = '';
  barShort.style.width = `${shortPercent}%`;
}

copyButton.addEventListener('click', () => {
  if (currentResult) copyText(currentResult.shortUrl, copyButton);
});

/* ---------- Lista de links ---------- */

function renderLinks() {
  listEl.replaceChildren(...links.map(buildRow));
  emptyState.hidden = links.length > 0;
  refreshButton.hidden = links.length === 0;
}

function buildRow(link) {
  const stats = link.stats ?? { totalClicks: 0, lastAccessedAt: null };
  const expiry = describeExpiry(link.expiresAt);
  const shown = stripProtocol(link.shortUrl);

  const main = el(
    'div',
    { className: 'row-main' },
    el('a', {
      className: 'row-short',
      text: shown,
      attrs: { href: link.shortUrl, target: '_blank', rel: 'noopener noreferrer' },
    }),
    el('span', {
      className: 'row-original',
      text: truncate(link.originalUrl, 70),
      attrs: { title: link.originalUrl },
    }),
    el('span', {
      className: expiry.expired ? 'row-note is-expired' : 'row-note',
      text: `Criado em ${formatDate(link.createdAt)}. ${expiry.text}`,
    }),
  );

  const clicks = el(
    'div',
    { className: 'row-clicks' },
    el(
      'p',
      {},
      el('span', { className: 'clicks-number', text: String(stats.totalClicks) }),
      el('span', {
        className: 'clicks-label',
        text: stats.totalClicks === 1 ? 'clique' : 'cliques',
      }),
    ),
    el('p', {
      className: 'clicks-last',
      text: stats.lastAccessedAt
        ? `Último acesso em ${formatDate(stats.lastAccessedAt)}`
        : 'Sem acessos ainda',
    }),
  );

  const copy = el('button', {
    className: 'btn btn-quiet btn-small',
    text: 'Copiar',
    attrs: { type: 'button', 'aria-label': `Copiar ${shown}` },
  });
  copy.addEventListener('click', () => copyText(link.shortUrl, copy));

  const remove = el('button', {
    className: 'btn btn-danger btn-small',
    text: 'Apagar',
    attrs: { type: 'button', 'aria-label': `Apagar ${shown}` },
  });
  remove.addEventListener('click', () => onDeleteClick(link.code, remove));

  return el(
    'li',
    { className: 'row' },
    main,
    clicks,
    el('div', { className: 'row-actions' }, copy, remove),
  );
}

/* Apagar exige dois cliques: o primeiro arma o botão, o segundo confirma. */

const armedTimers = new WeakMap();

function disarm(button) {
  clearTimeout(armedTimers.get(button));
  delete button.dataset.armed;
  button.textContent = 'Apagar';
  button.classList.remove('is-armed');
}

function onDeleteClick(code, button) {
  if (button.dataset.armed === 'true') {
    disarm(button);
    removeLink(code, button);
    return;
  }
  button.dataset.armed = 'true';
  button.textContent = 'Confirmar exclusão';
  button.classList.add('is-armed');
  armedTimers.set(button, setTimeout(() => disarm(button), 4000));
}

async function removeLink(code, button) {
  listError.hidden = true;
  button.disabled = true;
  try {
    await api(`/api/links/${encodeURIComponent(code)}`, { method: 'DELETE' });
  } catch (error) {
    // 404 significa que o link já não existe: o resultado final é o mesmo.
    if (error.status !== 404) {
      button.disabled = false;
      listError.textContent = `Não foi possível apagar o link. ${error.message}`;
      listError.hidden = false;
      return;
    }
  }

  links = links.filter((link) => link.code !== code);
  saveLinks();
  renderLinks();
  if (currentResult?.code === code) resultSection.hidden = true;
}

/* ---------- Cliques ---------- */

async function refreshStats() {
  if (refreshing || links.length === 0) return;
  refreshing = true;
  refreshButton.disabled = true;

  try {
    const outcomes = await Promise.all(
      links.map(async ({ code }) => {
        try {
          return { code, stats: await api(`/api/links/${encodeURIComponent(code)}/stats`) };
        } catch (error) {
          return { code, missing: error.status === 404 };
        }
      }),
    );

    for (const outcome of outcomes) {
      const link = links.find((item) => item.code === outcome.code);
      if (!link) continue;

      if (outcome.stats) {
        link.stats = {
          totalClicks: outcome.stats.totalClicks,
          lastAccessedAt: outcome.stats.lastAccessedAt,
        };
        link.expiresAt = outcome.stats.expiresAt;
      } else if (outcome.missing) {
        // O link foi removido fora desta tela (ex.: banco recriado): sai da lista.
        links = links.filter((item) => item.code !== outcome.code);
      }
    }

    saveLinks();
    renderLinks();
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', refreshStats);

// Ao voltar para esta aba (por exemplo, depois de abrir um link curto), atualiza os cliques.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshStats();
});

/* ---------- Início ---------- */

aliasPrefix.textContent = `${window.location.host}/`;
expiresInput.min = toLocalInputValue(new Date());
renderLinks();
refreshStats();
